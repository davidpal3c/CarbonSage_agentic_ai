import { WorkspaceSectionPage } from "@/app/dashboard/WorkspaceSectionPage";

export default async function ArtifactsPage({
  searchParams,
}: {
  searchParams: Promise<{ artifact?: string | string[] }>;
}) {
  const artifact = (await searchParams).artifact;
  return (
    <WorkspaceSectionPage
      section="artifacts"
      focusedArtifactId={Array.isArray(artifact) ? artifact[0] : artifact}
    />
  );
}
