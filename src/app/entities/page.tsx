import { AppShell } from "@/components/workspace/app-shell";
import { EntitiesEditor } from "@/features/entities/entities-editor";
import { getEntitiesPageData } from "@/features/entities/data";

export const dynamic = "force-dynamic";

export default async function EntitiesPage() {
  const { project, entities } = await getEntitiesPageData();

  return (
    <AppShell activeScreen="entities">
      <EntitiesEditor project={project} initialEntities={entities} />
    </AppShell>
  );
}
