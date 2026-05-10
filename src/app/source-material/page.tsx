import { AppShell } from "@/components/workspace/app-shell";
import { listSourceMaterials, prisma } from "@/server/db";
import { SourceMaterialWorkspace } from "@/features/source-material/source-material-workspace";
import { getWorkspaceContext } from "@/features/projects/workspace-context";
import { listStoryAnalysisDrafts } from "@/server/ai/story-analysis/draft";

export const dynamic = "force-dynamic";

type SourceMaterialPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourceMaterialPage({ searchParams }: SourceMaterialPageProps) {
  const params = (await searchParams) ?? {};
  const requestedProjectId = typeof params.projectId === "string" ? params.projectId : null;
  const { teamId } = await getWorkspaceContext();
  const projects = await prisma.project.findMany({
    where: { teamId },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      aspectRatio: true
    }
  });
  const selectedProject =
    projects.find((project) => project.id === requestedProjectId) ??
    projects.find((project) => project.status === "DRAFT") ??
    projects[0];
  const sourceMaterials = selectedProject ? await listSourceMaterials(prisma, selectedProject.id) : [];
  const storyAnalysisDrafts = selectedProject ? await listStoryAnalysisDrafts(prisma, selectedProject.id) : [];

  return (
    <AppShell activeScreen="source-material">
      <SourceMaterialWorkspace
        projects={projects}
        initialProjectId={selectedProject?.id ?? ""}
        initialSourceMaterials={sourceMaterials.map((material) => ({
          ...material,
          createdAt: material.createdAt.toISOString(),
          updatedAt: material.updatedAt.toISOString(),
          fileAsset: material.fileAsset
            ? {
                id: material.fileAsset.id,
                fileUrl: material.fileAsset.fileUrl,
                previewUrl: material.fileAsset.previewUrl,
                mimeType: material.fileAsset.mimeType,
                width: material.fileAsset.width,
                height: material.fileAsset.height,
                metadata: material.fileAsset.metadata
              }
            : null
        }))}
        initialStoryAnalysisDrafts={storyAnalysisDrafts}
      />
    </AppShell>
  );
}
