"use client";

import { useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ShipmentAnalysis } from "@/app/dashboard/workspace-data-store";

export type CarbonChartSeries = {
  key: string;
  label: string;
  unit?: string | null;
  color?: string;
};

const CHART_COLORS = [
  "var(--chart-plane)",
  "var(--chart-truck)",
  "var(--chart-train)",
  "var(--chart-ship)",
];

const MODE_COLORS: Record<string, string> = {
  plane: "var(--chart-plane)",
  truck: "var(--chart-truck)",
  train: "var(--chart-train)",
  ship: "var(--chart-ship)",
};

function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function tooltipValue(value: unknown, unit?: string | null) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? "—");
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(numeric);
  return unit ? `${formatted} ${unit}` : formatted;
}

const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.75rem",
  color: "var(--primary)",
  fontSize: "0.75rem",
};

export function StructuredDataChart({
  title,
  description,
  kind,
  data,
  xKey,
  series,
  height = 260,
}: {
  title: string;
  description: string;
  kind: "bar" | "line";
  data: Array<Record<string, string | number | boolean | null>>;
  xKey: string;
  series: CarbonChartSeries[];
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const common = {
    data,
    margin: { top: 8, right: 12, bottom: 4, left: 0 },
    accessibilityLayer: true,
  };

  return (
    <figure role="img" aria-label={description}>
      <figcaption className="sr-only">{title}</figcaption>
      <div style={{ height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {kind === "line" ? (
            <LineChart {...common}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey={xKey}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickFormatter={compactNumber}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [
                  tooltipValue(
                    value,
                    series.find((item) => item.key === name)?.unit,
                  ),
                  series.find((item) => item.key === name)?.label ?? name,
                ]}
              />
              {series.length > 1 ? <Legend /> : null}
              {series.map((item, index) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  name={item.label}
                  stroke={
                    item.color ?? CHART_COLORS[index % CHART_COLORS.length]
                  }
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={!reduceMotion}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart {...common}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey={xKey}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickFormatter={compactNumber}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => [
                  tooltipValue(
                    value,
                    series.find((item) => item.key === name)?.unit,
                  ),
                  series.find((item) => item.key === name)?.label ?? name,
                ]}
              />
              {series.length > 1 ? <Legend /> : null}
              {series.map((item, index) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.label}
                  fill={item.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                  radius={series.length === 1 ? [5, 5, 0, 0] : 0}
                  stackId={series.length > 1 ? "emissions" : undefined}
                  isAnimationActive={!reduceMotion}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

function trendRows(analysis: ShipmentAnalysis) {
  return analysis.timeline.map((period) => ({
    period: period.period,
    total_emissions_kg: period.emissions_kg,
    ...Object.fromEntries(
      Object.entries(period.mode_emissions_kg).map(([mode, value]) => [
        `${mode}_emissions_kg`,
        value,
      ]),
    ),
  }));
}

function modeSeries(analysis: ShipmentAnalysis): CarbonChartSeries[] {
  return Object.keys(analysis.mode_breakdown).map((mode) => ({
    key: `${mode}_emissions_kg`,
    label: mode[0].toUpperCase() + mode.slice(1),
    unit: "kg CO2e",
    color: MODE_COLORS[mode],
  }));
}

export function ShipmentTrendChart({
  analysis,
  variant = "bar",
  height = 320,
}: {
  analysis: ShipmentAnalysis;
  variant?: "bar" | "area";
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const data = trendRows(analysis);
  const series = modeSeries(analysis);

  if (variant === "bar") {
    return (
      <StructuredDataChart
        title="Freight emissions over time"
        description={`Stacked ${analysis.filters.granularity} freight emissions by transport mode. Values are available in the adjacent table.`}
        kind="bar"
        data={data}
        xKey="period"
        series={series}
        height={height}
      />
    );
  }

  return (
    <figure role="img" aria-label="Freight emissions trend by transport mode">
      <figcaption className="sr-only">
        Freight emissions trend by transport mode
      </figcaption>
      <div style={{ height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            accessibilityLayer
          >
            <defs>
              {series.map((item) => (
                <linearGradient
                  key={item.key}
                  id={`gradient-${item.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={item.color} stopOpacity={0.5} />
                  <stop
                    offset="95%"
                    stopColor={item.color}
                    stopOpacity={0.04}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="period"
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis
              width={48}
              tickFormatter={compactNumber}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <Tooltip contentStyle={tooltipStyle} />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stackId="emissions"
                stroke={item.color}
                fill={`url(#gradient-${item.key})`}
                strokeWidth={2}
                isAnimationActive={!reduceMotion}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ShipmentHotspotChart({
  hotspots,
  height = 320,
}: {
  hotspots: ShipmentAnalysis["hotspots"];
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const data = hotspots.slice(0, 8).map((hotspot) => ({
    shipment_id: hotspot.shipment_id,
    emissions_kg: hotspot.emissions_kg,
  }));

  return (
    <figure role="img" aria-label="Top shipment emissions hotspots">
      <figcaption className="sr-only">
        Top shipment emissions hotspots
      </figcaption>
      <div style={{ height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 6 }}
            accessibilityLayer
          >
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 3"
              horizontal={false}
            />
            <XAxis
              type="number"
              tickFormatter={compactNumber}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <YAxis
              type="category"
              dataKey="shipment_id"
              width={72}
              tick={{ fill: "var(--muted-foreground)" }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [
                tooltipValue(value, "kg CO2e"),
                "Emissions",
              ]}
            />
            <Bar
              dataKey="emissions_kg"
              name="Emissions"
              fill="var(--accent)"
              radius={[0, 5, 5, 0]}
              isAnimationActive={!reduceMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function ShipmentModeDonutChart({
  analysis,
  height = 210,
}: {
  analysis: ShipmentAnalysis;
  height?: number;
}) {
  const reduceMotion = useReducedMotion();
  const data = Object.entries(analysis.mode_breakdown)
    .map(([mode, values]) => ({
      mode,
      emissions_kg: values.emissions_kg,
    }))
    .sort((left, right) => right.emissions_kg - left.emissions_kg);

  return (
    <figure role="img" aria-label="Freight emissions share by transport mode">
      <figcaption className="sr-only">
        Freight emissions share by transport mode
      </figcaption>
      <div style={{ height }} className="relative w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value) => [
                tooltipValue(value, "kg CO2e"),
                "Emissions",
              ]}
            />
            <Pie
              data={data}
              dataKey="emissions_kg"
              nameKey="mode"
              innerRadius="58%"
              outerRadius="84%"
              paddingAngle={3}
              stroke="var(--card)"
              strokeWidth={3}
              isAnimationActive={!reduceMotion}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.mode}
                  fill={
                    MODE_COLORS[entry.mode] ??
                    CHART_COLORS[index % CHART_COLORS.length]
                  }
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <strong className="text-lg text-primary">
            {compactNumber(analysis.total_emissions_kg)}
          </strong>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            kg CO₂e
          </span>
        </div>
      </div>
    </figure>
  );
}
