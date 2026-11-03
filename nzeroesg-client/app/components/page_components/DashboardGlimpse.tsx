/**
 * A coded glimpse of the workspace Overview using real figures from the
 * fictional demo dataset (58 shipments; total 120,629.144 kg CO2e; mode shares
 * from the demo analysis; CS-1042 is its highest-impact shipment). It renders
 * inside .surface-workspace, so it uses the workspace tokens and surface
 * treatment (neutral panels, hairline borders, sage accent) rather than the
 * public ones. It does not render the workspace itself.
 */
const modes = [
  {
    name: "Plane",
    share: 63.7,
    shipments: 12,
    kg: "76,854.3",
    color: "var(--chart-plane)",
  },
  {
    name: "Ship",
    share: 23.8,
    shipments: 18,
    kg: "28,696.0",
    color: "var(--chart-ship)",
  },
  {
    name: "Train",
    share: 7.7,
    shipments: 14,
    kg: "9,267.4",
    color: "var(--chart-train)",
  },
  {
    name: "Truck",
    share: 4.8,
    shipments: 14,
    kg: "5,811.4",
    color: "var(--chart-truck)",
  },
] as const;

export default function DashboardGlimpse() {
  return (
    <figure className="surface-workspace relative overflow-hidden rounded-lg border border-border bg-background text-foreground">
      <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
        <span className="text-sm font-medium">Overview</span>
        <span className="label-ui rounded-md border border-border bg-muted px-2 py-1 text-muted-foreground">
          Fictional demo dataset
        </span>
      </div>

      <div className="p-4 md:p-5">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="label-ui text-muted-foreground">Total emissions</p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-mono text-[clamp(2rem,5vw,2.75rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
              120,629.1
            </span>
            <span className="font-mono text-base font-medium text-muted-foreground">
              kg CO₂e
            </span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            58 shipments · 573,300 kg freight weight
          </p>

          <div
            className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-sm"
            role="img"
            aria-label={`Emissions by mode: ${modes.map((m) => `${m.name.toLowerCase()} ${m.share}%`).join(", ")}`}
          >
            {modes.map((mode) => (
              <span
                key={mode.name}
                style={{ flex: mode.share, background: mode.color }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
            {modes.map((mode) => (
              <li key={mode.name} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-[2px]"
                  style={{ background: mode.color }}
                />
                {mode.name}{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {mode.share}%
                </span>
              </li>
            ))}
          </ul>
          <table className="sr-only">
            <caption>Emissions by transport mode, demo dataset</caption>
            <thead>
              <tr>
                <th scope="col">Mode</th>
                <th scope="col">Shipments</th>
                <th scope="col">kg CO₂e</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {modes.map((mode) => (
                <tr key={mode.name}>
                  <th scope="row">{mode.name}</th>
                  <td>{mode.shipments}</td>
                  <td>{mode.kg}</td>
                  <td>{mode.share}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card px-5 py-4 text-[15px]">
          <p className="label-ui mb-2 text-muted-foreground">
            Highest-impact shipment
          </p>
          <strong className="font-semibold">CS-1042</strong> Shanghai → Madrid ·
          plane ·{" "}
          <span className="font-mono tabular-nums">9,300.9 kg CO₂e</span> ·
          Iberia Air Cargo
        </div>
      </div>

      <figcaption className="border-t border-border bg-card px-5 py-3 text-xs leading-relaxed text-muted-foreground">
        Fictional demo dataset. Factor set prototype-2026.1, a screening
        estimate. Illustrative layout, not a live workspace.
      </figcaption>
    </figure>
  );
}
