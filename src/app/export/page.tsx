import { AppShell } from "@/components/workspace/app-shell";
import { WorkspaceRoute } from "@/components/workspace/screens";

export default function ExportPage() {
  return (
    <AppShell activeScreen="export">
      <WorkspaceRoute screen="export" />
    </AppShell>
  );
}
