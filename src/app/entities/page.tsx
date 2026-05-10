import { AppShell } from "@/components/workspace/app-shell";
import { WorkspaceRoute } from "@/components/workspace/screens";

export default function EntitiesPage() {
  return (
    <AppShell activeScreen="entities">
      <WorkspaceRoute screen="entities" />
    </AppShell>
  );
}
