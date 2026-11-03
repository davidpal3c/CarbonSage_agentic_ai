/**
 * A coded glimpse of the workspace Overview using real figures from the
 * fictional demo dataset (58 shipments; total 120,629.144 kg CO2e; mode shares
 * from the demo analysis; CS-1042 is its highest-impact shipment). It renders
 * inside .surface-workspace, so it uses the workspace tokens and surface
 * treatment (neutral panels, hairline borders, sage accent) rather than the
 * public ones: a compact metric strip, a mode-mix bar and the leading
 * shipment, as the Overview shows them. It does not render the workspace itself.
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
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5">
        <span className="text-sm font-medium">Overview</span>
        <span className="label-ui rounded-md border border-border bg-muted px-2 py-1 text-muted-foreground">
          Fictional demo dataset
        </span>
      </div>

      <div className="space-y-3 p-3 md:p-4">
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-[1.6fr_1fr_1fr]">
            <div className="col-span-2 bg-card px-4 py-3 sm:col-span-1">
              <dt className="text-xs text-muted-foreground">Total emissions</dt>
              <dd className="mt-0.5 font-mono text-[clamp(1.5rem,4vw,1.875rem)] font-medium leading-tight tracking-[-0.03em] tabular-nums">
                120,629.1{" "}
                <span className="text-sm tracking-normal text-muted-foreground">
                  kg CO₂e
                </span>
              </dd>
            </div>
            <div className="bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">Shipments</dt>
              <dd className="mt-0.5 font-mono text-xl font-medium leading-tight tabular-nums">
                58
              </dd>
            </div>
            <div className="bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">Freight weight</dt>
              <dd className="mt-0.5 font-mono text-xl font-medium leading-tight tabular-nums">
                573,300{" "}
                <span className="text-xs text-muted-foreground">kg</span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Aggregate emissions mix</p>
          <div
            className="flex h-3 gap-0.5 overflow-hidden rounded-sm"
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
          <p className="mt-3 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">Highest impact </span>
            <strong className="font-semibold">CS-1042</strong> Shanghai → Madrid
            · plane ·{" "}
            <span className="font-mono tabular-nums">9,300.9 kg CO₂e</span>
          </p>
        </div>
      </div>

      <figcaption className="border-t border-border bg-card px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Fictional demo dataset. Factor set prototype-2026.1, a screening
        estimate. Illustrative layout, not a live workspace.
      </figcaption>
    </figure>
  );
}
