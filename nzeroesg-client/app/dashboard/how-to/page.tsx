import Link from "next/link";
import {
  Bot,
  Database,
  Download,
  FileSearch,
  SlidersHorizontal,
  Upload,
} from "lucide-react";

import {
  buttonPrimary,
  buttonSecondary,
  IconTile,
  PageHeader,
  WorkspacePage,
} from "@/app/dashboard/workspace-ui";

const steps = [
  {
    title: "Choose your workspace data",
    description:
      "Load the fictional simulation dataset for a guided start, or bring CSV/XLSX shipment records and PDF/TXT supplier documents.",
    icon: Database,
  },
  {
    title: "Ask a decision question",
    description:
      "Ask CarbonSage about supplier claims, freight emissions, missing information, or a lower-emission alternative.",
    icon: Bot,
  },
  {
    title: "Inspect the evidence",
    description:
      "Open citations, chart values, calculation details, and source artifacts before carrying a result into a decision.",
    icon: FileSearch,
  },
  {
    title: "Explore the simulation views",
    description:
      "Use Shipments and Suppliers for normalized records and supporting detail. Scenario workflows will be added after the core agent journey is settled.",
    icon: SlidersHorizontal,
  },
  {
    title: "Export what you need",
    description:
      "Download available source artifacts, normalized workspace data, or a decision report for review outside CarbonSage.",
    icon: Download,
  },
];

export default function HowToPage() {
  return (
    <WorkspacePage>
      <PageHeader
        eyebrow="Workspace guide"
        title="How to use CarbonSage"
        description="Start with the agent, keep the source trail visible, and use the workspace pages when you need to inspect or manage the underlying information."
      />

      <ol className="divide-y divide-border rounded-lg border border-border bg-card">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex gap-3 px-4 py-3">
              <IconTile>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </IconTile>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-primary">
                  <span className="mr-2 font-normal text-muted-foreground">
                    Step {index + 1}
                  </span>
                  {step.title}
                </h2>
                <p className="mt-0.5 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/dashboard/agent" className={buttonPrimary}>
          Ask CarbonSage
        </Link>
        <Link href="/dashboard/integrations" className={buttonSecondary}>
          <Upload aria-hidden="true" className="h-4 w-4" />
          Choose data
        </Link>
      </div>
    </WorkspacePage>
  );
}
