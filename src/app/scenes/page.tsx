import { AppShell } from "@/components/workspace/app-shell";
import { ScenesWorkspace } from "@/features/scenes/scenes-workspace";

export const dynamic = "force-dynamic";

export default function ScenesPage() {
  return (
    <AppShell activeScreen="scenes">
      <ScenesWorkspace />
    </AppShell>
  );
}
