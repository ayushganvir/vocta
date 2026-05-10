import { AppShell } from "@/components/workspace/app-shell";
import { ExportWorkspace } from "@/features/export/export-workspace";

export const dynamic = "force-dynamic";

export default function ExportPage() {
  return (
    <AppShell activeScreen="export">
      <ExportWorkspace />
    </AppShell>
  );
}
