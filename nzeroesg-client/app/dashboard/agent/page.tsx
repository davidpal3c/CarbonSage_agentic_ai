import { PageHeader } from "@/app/dashboard/workspace-ui";

export default function AgentPage() {
  return (
    <section className="px-4 pt-5 sm:px-5 lg:px-6">
      <PageHeader
        title="Ask CarbonSage"
        description="Explore your workspace, compare freight decisions, and review the sources and calculations behind its answers, and see where the evidence runs out."
        className="mb-3"
      />
    </section>
  );
}
