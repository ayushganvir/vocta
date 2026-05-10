import { AppShell } from "@/components/workspace/app-shell";
import { JobsWorkspace } from "@/features/jobs/jobs-workspace";

export default function JobsPage() {
  return (
    <AppShell activeScreen="jobs">
      <JobsWorkspace />
    </AppShell>
  );
}
