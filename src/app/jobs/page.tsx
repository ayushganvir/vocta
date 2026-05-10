import { AppShell } from "@/components/workspace/app-shell";
import { WorkspaceRoute } from "@/components/workspace/screens";

export default function JobsPage() {
  return (
    <AppShell activeScreen="jobs">
      <WorkspaceRoute screen="jobs" />
    </AppShell>
  );
}
