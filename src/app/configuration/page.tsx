import { AppShell } from "@/components/workspace/app-shell";
import { ModelStackEditor } from "@/features/model-stack/model-stack-editor";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function ConfigurationPage() {
  const project = await prisma.project.findFirst({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      modelStack: true
    }
  });

  return (
    <AppShell activeScreen="configuration">
      <ModelStackEditor
        project={project ? { id: project.id, title: project.title } : null}
        initialModelStack={project?.modelStack ? {
          projectId: project.modelStack.projectId,
          textProvider: project.modelStack.textProvider,
          textModel: project.modelStack.textModel,
          imageProvider: project.modelStack.imageProvider,
          imageModel: project.modelStack.imageModel,
          videoProvider: project.modelStack.videoProvider,
          videoModel: project.modelStack.videoModel,
          voiceProvider: project.modelStack.voiceProvider,
          voiceModel: project.modelStack.voiceModel,
          defaultVoiceId: project.modelStack.defaultVoiceId ?? "",
          providerSettings: project.modelStack.providerSettings && typeof project.modelStack.providerSettings === "object" && !Array.isArray(project.modelStack.providerSettings)
            ? project.modelStack.providerSettings as Record<string, unknown>
            : {}
        } : null}
      />
    </AppShell>
  );
}

