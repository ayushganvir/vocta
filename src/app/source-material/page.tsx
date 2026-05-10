import { AppShell } from "@/components/workspace/app-shell";
import { WorkspaceRoute } from "@/components/workspace/screens";

export default function SourceMaterialPage() {
  return (
    <AppShell activeScreen="source-material">
      <WorkspaceRoute screen="source-material" />
    </AppShell>
  );
}
