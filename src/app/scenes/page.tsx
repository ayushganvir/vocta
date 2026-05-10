import { AppShell } from "@/components/workspace/app-shell";
import { WorkspaceRoute } from "@/components/workspace/screens";

export default function ScenesPage() {
  return (
    <AppShell activeScreen="scenes">
      <WorkspaceRoute screen="scenes" />
    </AppShell>
  );
}
