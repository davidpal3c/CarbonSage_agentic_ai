/**
 * The evidence trail: shipment, calculated footprint, supplier source, cited
 * answer. Values come from the fictional demo dataset (CS-1002; factor set
 * prototype-2026.1: 8 t x 4,400 km x 0.022 kg CO2e per t-km = 774.4 kg).
 */
export const evidenceSteps = [
  {
    title: "Shipment CS-1002",
    summary: "Vancouver → Toronto · 8,000 kg · 4,400 km · train",
    detail:
      "A dated shipment from the fictional demo dataset, linked to its supplier, Northstar Logistics.",
  },
  {
    title: "774.4 kg CO₂e",
    summary: "8 t × 4,400 km × 0.022 kg per t·km",
    detail:
      "Calculated by a deterministic tool with a versioned factor (prototype-2026.1), a screening estimate rather than audited accounting.",
  },
  {
    title: "Supplier source",
    summary: "northstar-logistics-disclosure.txt",
    detail:
      "The disclosure “reports a rail-intermodal option for lanes over 800 km.” Its file and location stay attached to every use.",
  },
  {
    title: "Cited answer",
    summary: "Rail-intermodal option reported for lanes over 800 km",
    detail:
      "The answer quotes the passage, names the file, and keeps the supplier's own estimate labelled as the supplier's.",
  },
] as const;

/** Trail geometry as fractions of the hero plate (780 x 800 artwork). */
const trailPoints: ReadonlyArray<readonly [number, number]> = [
  [0.1, 0.92],
  [0.3, 0.78],
  [0.52, 0.64],
  [0.7, 0.48],
  [0.78, 0.32],
];

/** One numbered node per evidence step; the first point only starts the line. */
export const trailNodes = trailPoints.slice(1);

export const PLATE_WIDTH = 780;
export const PLATE_HEIGHT = 800;

/** A stepped, surveyed line: horizontal to the midpoint, vertical, horizontal. */
export function trailPath(): string {
  const [first, ...rest] = trailPoints.map(
    ([x, y]) => [x * PLATE_WIDTH, y * PLATE_HEIGHT] as const,
  );
  let d = `M${first[0]} ${first[1]}`;
  let previousX = first[0];
  for (const [x, y] of rest) {
    d += `H${(previousX + x) / 2}V${y}H${x}`;
    previousX = x;
  }
  return d;
}
