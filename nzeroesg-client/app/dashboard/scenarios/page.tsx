import Link from "next/link";
import { Route } from "lucide-react";

import {
  buttonPrimary,
  EmptyNotice,
  PageHeader,
  WorkspacePage,
} from "@/app/dashboard/workspace-ui";

export default function ScenariosPage() {
  return (
    <WorkspacePage>
      <PageHeader
        title="Scenarios"
        description="Compare sourcing and freight alternatives without losing the evidence behind the baseline."
      />

      <EmptyNotice
        icon={<Route aria-hidden="true" className="h-4 w-4" />}
        label="Coming soon"
        title="Guided scenario modelling"
        action={
          <Link href="/dashboard/agent" className={buttonPrimary}>
            Ask CarbonSage
          </Link>
        }
      >
        The next iteration will turn agent-proposed alternatives into saved,
        comparable simulations. Freight comparisons remain available through Ask
        CarbonSage in the meantime.
      </EmptyNotice>
    </WorkspacePage>
  );
}
