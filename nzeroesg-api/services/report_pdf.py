"""Render the typed workspace report as a paginated PDF with vector charts.

The renderer reads the same payload that backs ``/reports/preview`` and the CSV
export, so every figure here is the one the preview shows. Calculated estimates
(factor-based emissions) and supplier disclosures (documents and details the
workspace holds) are kept in separate, labelled sections; the supplier section
never changes a calculated figure. Sections without data are labelled instead
of omitted.
"""

from __future__ import annotations

import io
import os
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any
from xml.sax.saxutils import escape

import reportlab
from reportlab.graphics.shapes import Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import (
    CondPageBreak,
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

INK = colors.HexColor("#242422")
MUTED = colors.HexColor("#62625c")
RULE = colors.HexColor("#dcdcd6")
PANEL = colors.HexColor("#f2f2ef")
ACCENT = colors.HexColor("#3f5f48")
MODE_COLORS = {
    "plane": colors.HexColor("#202326"),
    "truck": colors.HexColor("#a8472a"),
    "train": colors.HexColor("#b07f1f"),
    "ship": colors.HexColor("#3f8f8a"),
}
FALLBACK_MODE_COLOR = colors.HexColor("#62625c")

PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 18 * mm
CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN
MAX_TEXT = 160

_FONT_DIR = os.path.join(os.path.dirname(reportlab.__file__), "fonts")
_FONTS = {"Body": "Vera.ttf", "Body-Bold": "VeraBd.ttf", "Body-Italic": "VeraIt.ttf"}
_glyphs: frozenset[int] | None = None


def _register_fonts() -> frozenset[int]:
    """Embed the Vera family bundled with ReportLab and return its code points."""

    global _glyphs
    if _glyphs is None:
        for name, filename in _FONTS.items():
            pdfmetrics.registerFont(TTFont(name, os.path.join(_FONT_DIR, filename)))
        pdfmetrics.registerFontFamily(
            "Body", normal="Body", bold="Body-Bold", italic="Body-Italic", boldItalic="Body-Bold"
        )
        _glyphs = frozenset(pdfmetrics.getFont("Body").face.charToGlyph)
    return _glyphs


def _text(value: object, limit: int = MAX_TEXT) -> str:
    """Printable text the embedded font can draw, clipped to ``limit`` characters."""

    glyphs = _register_fonts()
    cleaned = "".join(
        char if ord(char) in glyphs and (char.isprintable() or char == " ") else "?"
        for char in " ".join(str(value).split())
    )
    return cleaned if len(cleaned) <= limit else cleaned[: limit - 1].rstrip() + "…"


def _para(value: object, style: ParagraphStyle, limit: int = MAX_TEXT) -> Paragraph:
    return Paragraph(escape(_text(value, limit)), style)


def _num(value: object, digits: int = 2) -> str:
    try:
        return f"{float(value):,.{digits}f}"  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return "n/a"


def _signed(value: object) -> str:
    number = float(value)  # type: ignore[arg-type]
    return f"{'+' if number > 0 else ''}{number:,.2f}"


def _title_case(value: object) -> str:
    return _text(value, 40).capitalize()


def _styles() -> dict[str, ParagraphStyle]:
    _register_fonts()
    base = ParagraphStyle("base", fontName="Body", fontSize=9, leading=13, textColor=INK)
    return {
        "base": base,
        "title": ParagraphStyle(
            "title", parent=base, fontName="Body-Bold", fontSize=22, leading=26, spaceAfter=3
        ),
        "meta": ParagraphStyle("meta", parent=base, fontSize=9, textColor=MUTED),
        "h2": ParagraphStyle(
            "h2",
            parent=base,
            fontName="Body-Bold",
            fontSize=13,
            leading=17,
            spaceBefore=16,
            spaceAfter=2,
        ),
        "tag": ParagraphStyle(
            "tag",
            parent=base,
            fontName="Body-Bold",
            fontSize=7,
            leading=10,
            textColor=ACCENT,
            spaceAfter=5,
        ),
        "muted": ParagraphStyle("muted", parent=base, fontSize=8.5, textColor=MUTED),
        "cell": ParagraphStyle("cell", parent=base, fontSize=8, leading=10.5),
        "cell_bold": ParagraphStyle("cell_bold", parent=base, fontName="Body-Bold", fontSize=8),
        "cell_right": ParagraphStyle("cell_right", parent=base, fontSize=8, alignment=TA_RIGHT),
        "head": ParagraphStyle(
            "head", parent=base, fontName="Body-Bold", fontSize=7.5, textColor=MUTED, leading=10
        ),
        "head_right": ParagraphStyle(
            "head_right",
            parent=base,
            fontName="Body-Bold",
            fontSize=7.5,
            textColor=MUTED,
            leading=10,
            alignment=TA_RIGHT,
        ),
        "figure": ParagraphStyle(
            "figure", parent=base, fontName="Body-Bold", fontSize=13, leading=17
        ),
        "figure_label": ParagraphStyle("figure_label", parent=base, fontSize=8, textColor=MUTED),
    }


def _table(
    rows: Sequence[Sequence[Any]],
    widths: Sequence[float],
    *,
    header: bool = True,
    extra: Sequence[tuple[Any, ...]] = (),
) -> Table:
    table = Table(list(rows), colWidths=list(widths), repeatRows=1 if header else 0)
    style: list[tuple[Any, ...]] = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), PANEL),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, INK),
        ]
    table.setStyle(TableStyle(style + list(extra)))
    return table


def _bar_chart(
    bars: Sequence[tuple[str, float, colors.Color, str]],
    *,
    width: float = CONTENT_WIDTH,
    label_width: float = 78,
    value_width: float = 118,
) -> Drawing:
    """Horizontal bars drawn as vector shapes, each with its label and value.

    Every bar carries its own text label, so no meaning rests on colour alone.
    """

    row_height = 24
    top = 4
    height = top + row_height * len(bars) + 4
    drawing = Drawing(width, height)
    plot_width = width - label_width - value_width
    peak = max((value for _, value, _, _ in bars), default=0.0)
    axis_x = label_width
    for index, (label, value, color, caption) in enumerate(bars):
        y = height - top - (index + 1) * row_height + 5
        drawing.add(
            String(
                axis_x - 8,
                y + 4,
                _text(label, 22),
                fontName="Body",
                fontSize=8.5,
                fillColor=INK,
                textAnchor="end",
            )
        )
        length = 0.0 if peak <= 0 or value <= 0 else max(1.5, plot_width * value / peak)
        if length:
            drawing.add(
                Rect(axis_x, y, length, 14, fillColor=color, strokeColor=None, strokeWidth=0)
            )
        drawing.add(
            String(
                axis_x + length + 6,
                y + 4,
                _text(caption, 40),
                fontName="Body-Bold",
                fontSize=8.5,
                fillColor=INK,
            )
        )
    drawing.add(Line(axis_x, 2, axis_x, height - 2, strokeColor=INK, strokeWidth=0.8))
    return drawing


class _NumberedCanvas(pdf_canvas.Canvas):
    """Canvas that prints "Page n of N" and a running footer on every page."""

    footer_label = ""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._saved_pages: list[dict[str, Any]] = []

    def showPage(self) -> None:  # noqa: N802 - ReportLab API
        self._saved_pages.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total = len(self._saved_pages)
        for state in self._saved_pages:
            self.__dict__.update(state)
            self._draw_footer(total)
            super().showPage()
        super().save()

    def _draw_footer(self, total: int) -> None:
        self.setStrokeColor(RULE)
        self.setLineWidth(0.5)
        self.line(MARGIN, 12 * mm, PAGE_WIDTH - MARGIN, 12 * mm)
        self.setFont("Body", 7.5)
        self.setFillColor(MUTED)
        self.drawString(MARGIN, 8 * mm, self.footer_label)
        self.drawRightString(PAGE_WIDTH - MARGIN, 8 * mm, f"Page {self._pageNumber} of {total}")


def _mode_rows(analysis: Mapping[str, Any]) -> list[tuple[str, Mapping[str, Any]]]:
    return sorted(
        analysis.get("mode_breakdown", {}).items(),
        key=lambda item: -float(item[1].get("emissions_kg", 0)),
    )


def _supplier_emissions(analysis: Mapping[str, Any]) -> dict[str, float]:
    totals: dict[str, float] = {}
    for breakdown in analysis.get("mode_breakdown", {}).values():
        for contribution in breakdown.get("suppliers", []):
            name = contribution.get("supplier_name")
            if name:
                totals[name] = totals.get(name, 0.0) + float(contribution["emissions_kg"])
    return totals


def _section(
    title: str, tag: str, styles: Mapping[str, ParagraphStyle], need: float = 35 * mm
) -> list[Any]:
    """Heading and tag, moved to a new page when less than ``need`` remains.

    A conditional break keeps a heading with its content without forcing a long
    table onto one page, which would leave a large gap behind it.
    """

    return [
        CondPageBreak(need),
        Paragraph(escape(title), styles["h2"]),
        Paragraph(escape(tag), styles["tag"]),
    ]


def _bullets(items: Sequence[str], styles: Mapping[str, ParagraphStyle]) -> Any:
    if not items:
        return Paragraph("None recorded.", styles["muted"])
    return ListFlowable(
        [ListItem(_para(item, styles["base"], 600), leftIndent=12) for item in items],
        bulletType="bullet",
        bulletFontName="Body",
        bulletFontSize=7,
        start="•",
        leftIndent=12,
    )


def render_report_pdf(report: Mapping[str, Any]) -> bytes:
    """Render a ``ReportResponse`` payload (``model_dump(mode="json")``) to PDF bytes."""

    styles = _styles()
    analysis: Mapping[str, Any] = report["shipment_analysis"]
    scenario: Mapping[str, Any] | None = report.get("scenario")
    suppliers: Sequence[Mapping[str, Any]] = report.get("suppliers", [])
    methodology: Mapping[str, Any] = report["methodology"]
    shipment_count = int(analysis.get("shipment_count", 0))
    total_kg = float(analysis.get("total_emissions_kg", 0))
    generated = datetime.fromtimestamp(int(report["generated_at"]), UTC)
    stamp = generated.strftime("%Y-%m-%d %H:%M UTC")
    workspace = _text(report["workspace_id"], 40)

    story: list[Any] = [
        Paragraph("Decision report", styles["title"]),
        Paragraph(
            escape(f"Generated {stamp} · Workspace {workspace}"),
            styles["meta"],
        ),
        Spacer(1, 8),
        Table(
            [
                [
                    Paragraph(
                        "<b>Reading this report.</b> Emissions figures are <b>calculated "
                        "estimates</b>: default freight factors applied to the shipment rows in "
                        "this workspace. Supplier sections list <b>supplier disclosures</b> "
                        "(documents and details held in this workspace); they do not verify or "
                        "adjust the calculated figures.",
                        styles["base"],
                    )
                ]
            ],
            colWidths=[CONTENT_WIDTH],
            style=TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), PANEL),
                    ("LINEBEFORE", (0, 0), (0, -1), 2.5, ACCENT),
                    ("LEFTPADDING", (0, 0), (-1, -1), 9),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 9),
                    ("TOPPADDING", (0, 0), (-1, -1), 7),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ]
            ),
        ),
    ]

    # Key figures and dataset counts.
    document_total = sum(int(supplier.get("document_count", 0)) for supplier in suppliers)
    without_documents = sum(1 for supplier in suppliers if not supplier.get("document_count"))
    figures = [
        ("Shipments", f"{shipment_count:,}"),
        ("Total emissions (kg CO2e)", _num(total_kg)),
        ("Total emissions (t CO2e)", _num(analysis.get("total_emissions_tonnes", 0), 3)),
        ("Suppliers", f"{len(suppliers):,}"),
    ]
    story += _section("Key figures", "CALCULATED ESTIMATE · SUPPLIER COUNT FROM WORKSPACE", styles)
    story.append(
        _table(
            [
                [Paragraph(escape(label), styles["figure_label"]) for label, _ in figures],
                [Paragraph(escape(value), styles["figure"]) for _, value in figures],
            ],
            [CONTENT_WIDTH * f for f in (0.2, 0.34, 0.26, 0.2)],
            header=False,
            extra=[("LINEBELOW", (0, 0), (-1, 0), 0, colors.white)],
        )
    )
    story.append(Spacer(1, 8))
    counts = [
        ("Shipments in workspace", analysis.get("workspace_shipment_count", shipment_count)),
        ("Shipments included in this report", shipment_count),
        ("Shipments filtered out", analysis.get("filtered_out_count", 0)),
        ("Shipments without a date", analysis.get("undated_shipment_count", 0)),
        ("Total weight (kg)", _num(analysis.get("total_weight_kg", 0))),
        ("Suppliers with disclosure documents", len(suppliers) - without_documents),
        ("Suppliers without disclosure documents", without_documents),
        ("Disclosure documents held", document_total),
    ]
    story.append(
        _table(
            [[Paragraph("Dataset", styles["head"]), Paragraph("Count", styles["head_right"])]]
            + [
                [
                    Paragraph(escape(label), styles["cell"]),
                    Paragraph(
                        escape(f"{value:,}" if isinstance(value, int) else str(value)),
                        styles["cell_right"],
                    ),
                ]
                for label, value in counts
            ],
            [CONTENT_WIDTH * 0.7, CONTENT_WIDTH * 0.3],
        )
    )

    # Emissions by mode: chart and table.
    modes = _mode_rows(analysis)
    story += _section(
        "Emissions by mode", "CALCULATED ESTIMATE", styles, (75 if modes else 20) * mm
    )
    if modes:
        bars = [
            (
                _title_case(mode),
                float(values["emissions_kg"]),
                MODE_COLORS.get(mode, FALLBACK_MODE_COLOR),
                f"{_num(values['emissions_kg'])} kg",
            )
            for mode, values in modes
        ]
        story.append(KeepTogether([_bar_chart(bars), Spacer(1, 6)]))
        table_rows = [
            [
                Paragraph("Mode", styles["head"]),
                Paragraph("Shipments", styles["head_right"]),
                Paragraph("Weight kg", styles["head_right"]),
                Paragraph("Emissions kg", styles["head_right"]),
                Paragraph("Share", styles["head_right"]),
            ]
        ]
        for mode, values in modes:
            share = f"{float(values['emissions_kg']) / total_kg * 100:.1f}%" if total_kg else "n/a"
            table_rows.append(
                [
                    _para(_title_case(mode), styles["cell_bold"]),
                    Paragraph(f"{int(values['shipment_count']):,}", styles["cell_right"]),
                    Paragraph(_num(values["weight_kg"]), styles["cell_right"]),
                    Paragraph(_num(values["emissions_kg"]), styles["cell_right"]),
                    Paragraph(share, styles["cell_right"]),
                ]
            )
        story.append(_table(table_rows, [CONTENT_WIDTH * f for f in (0.28, 0.16, 0.2, 0.2, 0.16)]))
    else:
        story.append(
            Paragraph(
                "No shipment data in this workspace, so there are no emissions by mode. "
                "Upload shipments or load the demo data to populate this section.",
                styles["muted"],
            )
        )

    # Scenario comparison.
    story += _section(
        "Scenario comparison", "CALCULATED ESTIMATE", styles, (85 if scenario else 20) * mm
    )
    if scenario:
        baseline_mode = _title_case(scenario["baseline_mode"])
        alternative_mode = _title_case(scenario["alternative_mode"])
        delta = float(scenario["delta_kg"])
        percent = scenario.get("delta_percent")
        chart = _bar_chart(
            [
                (
                    f"Baseline ({baseline_mode})",
                    float(scenario["baseline_total_kg"]),
                    MODE_COLORS.get(str(scenario["baseline_mode"]), FALLBACK_MODE_COLOR),
                    f"{_num(scenario['baseline_total_kg'])} kg",
                ),
                (
                    alternative_mode,
                    float(scenario["alternative_total_kg"]),
                    MODE_COLORS.get(str(scenario["alternative_mode"]), FALLBACK_MODE_COLOR),
                    f"{_num(scenario['alternative_total_kg'])} kg",
                ),
            ],
            label_width=110,
        )
        change = f"{_signed(delta)} kg" + (f" ({_signed(percent)}%)" if percent is not None else "")
        story.append(
            KeepTogether(
                [
                    chart,
                    Spacer(1, 6),
                    _table(
                        [
                            [
                                Paragraph("Current baseline", styles["head"]),
                                Paragraph(alternative_mode, styles["head"]),
                                Paragraph("Change", styles["head"]),
                                Paragraph("Shipments compared", styles["head_right"]),
                            ],
                            [
                                Paragraph(
                                    f"{_num(scenario['baseline_total_kg'])} kg", styles["cell_bold"]
                                ),
                                Paragraph(
                                    f"{_num(scenario['alternative_total_kg'])} kg",
                                    styles["cell_bold"],
                                ),
                                Paragraph(escape(change), styles["cell_bold"]),
                                Paragraph(
                                    f"{int(scenario['shipment_count']):,}", styles["cell_right"]
                                ),
                            ],
                        ],
                        [CONTENT_WIDTH * f for f in (0.28, 0.24, 0.3, 0.18)],
                    ),
                    Spacer(1, 3),
                    Paragraph(
                        "Every shipment is re-calculated as if moved by the alternative mode over "
                        "the same route. This is a modelled comparison, not a quote or a "
                        "statement that the alternative service is available.",
                        styles["muted"],
                    ),
                ]
            )
        )
    else:
        reason = (
            "No shipment data in this workspace, so no scenario could be calculated."
            if not shipment_count
            else "No alternative mode was selected for this report."
        )
        story.append(Paragraph(reason, styles["muted"]))

    # Highest-emitting shipments.
    hotspots: Sequence[Mapping[str, Any]] = analysis.get("hotspots", [])
    story += _section(
        "Highest-emitting shipments",
        "CALCULATED ESTIMATE",
        styles,
        (35 if hotspots else 20) * mm,
    )
    if hotspots:
        rows = [
            [
                Paragraph(label, style)
                for label, style in (
                    ("Shipment", styles["head"]),
                    ("Date", styles["head"]),
                    ("Supplier", styles["head"]),
                    ("Route", styles["head"]),
                    ("Mode", styles["head"]),
                    ("Emissions kg", styles["head_right"]),
                )
            ]
        ]
        for hotspot in hotspots:
            rows.append(
                [
                    _para(hotspot["shipment_id"], styles["cell"], 60),
                    _para(hotspot.get("shipment_date") or "Undated", styles["cell"], 20),
                    _para(hotspot.get("supplier_name") or "Not recorded", styles["cell"]),
                    _para(f"{hotspot['origin']} to {hotspot['destination']}", styles["cell"]),
                    _para(_title_case(hotspot["transport_method"]), styles["cell"]),
                    Paragraph(_num(hotspot["emissions_kg"]), styles["cell_right"]),
                ]
            )
        story.append(_table(rows, [CONTENT_WIDTH * f for f in (0.13, 0.12, 0.24, 0.27, 0.1, 0.14)]))
    else:
        story.append(Paragraph("No shipments to rank.", styles["muted"]))

    # Supplier evidence overview.
    story += _section(
        "Supplier evidence overview",
        "SUPPLIER DISCLOSURES · EMISSIONS COLUMN IS CALCULATED",
        styles,
        (35 if suppliers else 20) * mm,
    )
    if suppliers:
        attributed = _supplier_emissions(analysis)
        rows = [
            [
                Paragraph(label, style)
                for label, style in (
                    ("Supplier", styles["head"]),
                    ("Region", styles["head"]),
                    ("Modes", styles["head"]),
                    ("Certifications", styles["head"]),
                    ("Docs", styles["head_right"]),
                    ("Missing details", styles["head"]),
                    ("Est. kg CO2e", styles["head_right"]),
                )
            ]
        ]
        listed = set()
        for supplier in suppliers:
            name = str(supplier["name"])
            listed.add(name)
            rows.append(
                [
                    _para(name, styles["cell_bold"]),
                    _para(supplier.get("region") or "Not recorded", styles["cell"], 60),
                    _para(", ".join(supplier.get("transport_modes", [])) or "None", styles["cell"]),
                    _para(
                        ", ".join(supplier.get("certifications", [])) or "None declared",
                        styles["cell"],
                    ),
                    Paragraph(f"{int(supplier.get('document_count', 0)):,}", styles["cell_right"]),
                    _para(", ".join(supplier.get("missing_fields", [])) or "None", styles["cell"]),
                    Paragraph(
                        _num(attributed[name]) if name in attributed else "0.00",
                        styles["cell_right"],
                    ),
                ]
            )
        other = sum(value for name, value in attributed.items() if name not in listed)
        if other > 0:
            rows.append(
                [
                    _para("Shipment suppliers not in the supplier list", styles["cell"]),
                    *[Paragraph("", styles["cell"]) for _ in range(5)],
                    Paragraph(_num(other), styles["cell_right"]),
                ]
            )
        story.append(
            _table(rows, [CONTENT_WIDTH * f for f in (0.22, 0.14, 0.12, 0.17, 0.07, 0.15, 0.13)])
        )
        story.append(Spacer(1, 3))
        story.append(
            Paragraph(
                "Certifications, modes and regions are recorded as entered or extracted in "
                "this workspace and are not independently verified here. "
                "A supplier with zero documents has no disclosure to cite.",
                styles["muted"],
            )
        )
    else:
        story.append(
            Paragraph(
                "No suppliers in this workspace, so there are no disclosures to summarise.",
                styles["muted"],
            )
        )

    # Methodology, assumptions, warnings.
    story += _section("Methodology", "CALCULATED ESTIMATE", styles)
    story.append(
        _table(
            [
                [
                    Paragraph("Factor source", styles["cell_bold"]),
                    _para(methodology["factor_source"], styles["cell"], 300),
                ],
                [
                    Paragraph("Factor version", styles["cell_bold"]),
                    _para(methodology["factor_version"], styles["cell"], 120),
                ],
                [
                    Paragraph("Applicability", styles["cell_bold"]),
                    _para(methodology["factor_applicability"], styles["cell"], 600),
                ],
            ],
            [CONTENT_WIDTH * 0.22, CONTENT_WIDTH * 0.78],
            header=False,
        )
    )
    story += _section("Assumptions", "CALCULATED ESTIMATE", styles)
    story.append(_bullets([str(item) for item in methodology.get("assumptions", [])], styles))
    story += _section("Warnings", "DATA QUALITY", styles)
    story.append(_bullets([str(item) for item in methodology.get("warnings", [])], styles))

    class Canvas(_NumberedCanvas):
        footer_label = f"CarbonSage decision report · Workspace {workspace} · {stamp}"

    buffer = io.BytesIO()
    SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=20 * mm,
        title="CarbonSage decision report",
        author="CarbonSage",
        subject=f"Freight emissions report generated {stamp}",
        creator="CarbonSage",
    ).build(story, canvasmaker=Canvas)
    return buffer.getvalue()
