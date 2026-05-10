import { AppShell } from "@/components/workspace/app-shell";
import { listProjects, prisma } from "@/server/db";
import { ProjectsWorkspace } from "@/features/projects/projects-workspace";
import { getWorkspaceContext } from "@/features/projects/workspace-context";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { teamId } = await getWorkspaceContext();
  const projects = await listProjects(prisma, teamId);

  return (
    <AppShell activeScreen="projects">
      <ProjectsWorkspace
        initialProjects={projects.map((project) => ({
          ...project,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString()
        }))}
      />
    </AppShell>
  );
}
