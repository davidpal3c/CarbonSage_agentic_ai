/**
 * A coded glimpse of the workspace overview using real figures from the
 * fictional demo dataset (58 shipments; total 120,629.144 kg CO2e; mode shares
 * from the demo analysis; CS-1042 is its highest-impact shipment). It shares
 * the public tokens, but does not render the workspace itself.
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
    <figure className="border-[1.5px] border-foreground bg-card text-card-foreground">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="label-mono text-accent">Workspace · Overview</span>
        <span className="label-mono text-muted-foreground">Demo data</span>
      </div>

      <div className="px-5 pb-6 pt-5 md:px-7">
        <p className="label-mono mb-3 text-muted-foreground">
          Current baseline
        </p>
        <p className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="font-mono text-[clamp(2.25rem,6vw,3.5rem)] font-medium leading-none tracking-[-0.04em] tabular-nums">
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
          className="mt-6 flex h-3.5 gap-0.5"
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
                className="inline-block h-2.5 w-2.5"
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

        <div className="mt-6 border-t border-border pt-4 text-[15px]">
          <span className="label-mono mr-2 inline-block bg-foreground px-1.5 py-1 text-[11px] text-background">
            Highest impact
          </span>
          <strong className="font-semibold">CS-1042</strong> Shanghai → Madrid ·
          plane ·{" "}
          <span className="font-mono tabular-nums">9,300.9 kg CO₂e</span> ·
          Iberia Air Cargo
        </div>
      </div>

      <figcaption className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted-foreground md:px-7">
        Fictional demo dataset. Factor set prototype-2026.1, a screening
        estimate. Illustrative layout, not a live workspace.
      </figcaption>
    </figure>
  );
}
