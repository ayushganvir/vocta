import { AppShell } from "@/components/workspace/app-shell";
import { WorkspaceRoute } from "@/components/workspace/screens";

export default function StyleBiblePage() {
  return (
    <AppShell activeScreen="style-bible">
      <WorkspaceRoute screen="style-bible" />
    </AppShell>
  );
}
