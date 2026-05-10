import { AppShell } from "@/components/workspace/app-shell";
import { WorkspaceRoute } from "@/components/workspace/screens";

export default function ProjectsPage() {
  return (
    <AppShell activeScreen="projects">
      <WorkspaceRoute screen="projects" />
    </AppShell>
  );
}
