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
