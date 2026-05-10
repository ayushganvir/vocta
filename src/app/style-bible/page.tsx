import { AppShell } from "@/components/workspace/app-shell";
import { getStyleBiblePageData } from "@/features/style-bible/data";
import { StyleBibleEditor } from "@/features/style-bible/style-bible-editor";

export const dynamic = "force-dynamic";

export default async function StyleBiblePage() {
  const { project, styleBible } = await getStyleBiblePageData();

  return (
    <AppShell activeScreen="style-bible">
      <StyleBibleEditor project={project} initialStyleBible={styleBible} />
    </AppShell>
  );
}
