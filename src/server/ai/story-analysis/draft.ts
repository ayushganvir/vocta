import { GenerationJobType, JobStatus, Prisma, SourceMaterialType } from "@prisma/client";

import type { DbClient } from "@/server/db";
import { createGenerationJob, updateGenerationJobStatus } from "@/server/db";
import { createFakeTextProvider, runProvider } from "@/server/providers/fake";
import type { StoryAnalysisJobPayload, StoryAnalysisJobResult } from "@/server/jobs/types";
import {
  storyAnalysisDraftSchema,
  type StoryAnalysisDraft
} from "@/features/story-analysis/schema";

type AnalyzeStoryInput = {
  projectId: string;
  sourceMaterialIds?: string[];
  requestedByUserId: string;
  notes?: string;
};

type AppliedMetadata = {
  entityIds?: string[];
  styleFields?: string[];
  sceneIds?: string[];
};

export async function analyzeStoryDraft(db: DbClient, input: AnalyzeStoryInput) {
  const sourceMaterials = await db.sourceMaterial.findMany({
    where: {
      projectId: input.projectId,
      type: SourceMaterialType.SCRIPT,
      ...(input.sourceMaterialIds?.length ? { id: { in: input.sourceMaterialIds } } : {})
    },
    orderBy: { createdAt: "asc" }
  });

  if (sourceMaterials.length === 0) {
    throw new Error("Add at least one script source before analyzing story.");
  }

  const scriptText = sourceMaterials
    .map((source) => [source.title, source.bodyText].filter(Boolean).join("\n"))
    .join("\n\n")
    .trim();

  if (!scriptText) {
    throw new Error("Script source material must include text before analysis.");
  }

  const job = await createGenerationJob(db, {
    projectId: input.projectId,
    type: GenerationJobType.STORY_ANALYSIS,
    provider: "fake",
    model: "fake-text",
    createdById: input.requestedByUserId,
    requestPayload: {
      providerMode: "fake",
      sourceMaterialIds: sourceMaterials.map((source) => source.id),
      notes: input.notes ?? null
    }
  });

  await updateGenerationJobStatus(db, job.id, JobStatus.RUNNING);

  try {
    const provider = createFakeTextProvider();
    const providerPayload = {
      jobType: "story_analysis",
      projectId: input.projectId,
      generationJobId: job.id,
      requestedByUserId: input.requestedByUserId,
      requestedAt: new Date().toISOString(),
      sourceMaterialIds: sourceMaterials.map((source) => source.id),
      scriptText,
      notes: input.notes
    } satisfies StoryAnalysisJobPayload;
    const result = await runProvider(provider, providerPayload) as StoryAnalysisJobResult;
    const draft = normalizeStoryAnalysisResult(result, sourceMaterials.map((source) => source.id));
    const completed = await updateGenerationJobStatus(db, job.id, JobStatus.COMPLETED, {
      responsePayloadSummary: draft as unknown as Prisma.InputJsonValue,
      logs: [
        {
          level: "info",
          message: "Fake story analysis completed.",
          createdAt: new Date().toISOString()
        }
      ]
    });

    return {
      ...completed,
      draft
    };
  } catch (error) {
    await updateGenerationJobStatus(db, job.id, JobStatus.FAILED, {
      errorPayload: {
        message: error instanceof Error ? error.message : "Story analysis failed."
      }
    });
    throw error;
  }
}

export async function listStoryAnalysisDrafts(db: DbClient, projectId: string) {
  const jobs = await db.generationJob.findMany({
    where: {
      projectId,
      type: GenerationJobType.STORY_ANALYSIS,
      status: JobStatus.COMPLETED
    },
    orderBy: { completedAt: "desc" },
    take: 5
  });

  return jobs
    .map((job) => {
      const parsed = storyAnalysisDraftSchema.safeParse(job.responsePayloadSummary);
      if (!parsed.success) return null;

      return {
        id: job.id,
        projectId: job.projectId,
        status: job.status,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() ?? null,
        draft: parsed.data,
        applied: parseAppliedMetadata(job.logs)
      };
    })
    .filter((draft): draft is NonNullable<typeof draft> => Boolean(draft));
}

export async function getStoryAnalysisDraftJob(db: DbClient, projectId: string, jobId: string) {
  const job = await db.generationJob.findFirst({
    where: {
      id: jobId,
      projectId,
      type: GenerationJobType.STORY_ANALYSIS,
      status: JobStatus.COMPLETED
    }
  });

  if (!job) {
    throw new Error("Story analysis draft not found.");
  }

  const parsed = storyAnalysisDraftSchema.safeParse(job.responsePayloadSummary);
  if (!parsed.success) {
    throw new Error("Story analysis draft is invalid.");
  }

  return {
    job,
    draft: parsed.data,
    applied: parseAppliedMetadata(job.logs)
  };
}

export function normalizeStoryAnalysisResult(
  result: StoryAnalysisJobResult,
  sourceMaterialIds: string[]
): StoryAnalysisDraft {
  const sceneIdByOrderIndex = new Map<number, string>();
  const scenes = result.suggestedScenes
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((scene, index) => {
      const id = `scene-${index + 1}`;
      sceneIdByOrderIndex.set(scene.orderIndex, id);
      return {
        id,
        title: scene.title,
        synopsis: scene.synopsis,
        orderIndex: index + 1,
        panels: [] as StoryAnalysisDraft["scenes"][number]["panels"]
      };
    });

  for (const [index, panel] of result.suggestedPanels.entries()) {
    const sceneId = sceneIdByOrderIndex.get(panel.sceneOrderIndex) ?? scenes[0]?.id;
    const scene = scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) continue;

    scene.panels.push({
      id: `${scene.id}-panel-${scene.panels.length + 1}`,
      sceneId: scene.id,
      title: panel.title || `Panel ${index + 1}`,
      narration: panel.narration,
      visualIntent: panel.visualIntent,
      motionIntent: panel.motionIntent
    });
  }

  for (const scene of scenes) {
    if (scene.panels.length === 0) {
      scene.panels.push({
        id: `${scene.id}-panel-1`,
        sceneId: scene.id,
        title: `${scene.title} Beat`,
        narration: scene.synopsis,
        visualIntent: "Establish the scene conflict in a clear vertical composition.",
        motionIntent: "Slow push-in."
      });
    }
  }

  return storyAnalysisDraftSchema.parse({
    version: 1,
    provider: "fake",
    model: result.model,
    generatedAt: result.completedAt,
    sourceMaterialIds,
    storySummary: result.storySummary,
    entitySuggestions: result.suggestedEntities.map((entity, index) => ({
      id: `entity-${index + 1}`,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      visualPrompt: entity.visualPrompt
    })),
    styleSuggestions: result.styleSuggestions,
    scenes,
    warnings: result.warnings
  });
}

function parseAppliedMetadata(logs: Prisma.JsonValue): Required<AppliedMetadata> {
  const fallback = { entityIds: [], styleFields: [], sceneIds: [] };
  if (!Array.isArray(logs)) return fallback;

  return logs.reduce<Required<AppliedMetadata>>((current, item) => {
    if (!item || typeof item !== "object" || !("storyAnalysisApplied" in item)) {
      return current;
    }

    const value = (item as { storyAnalysisApplied?: AppliedMetadata }).storyAnalysisApplied;
    return {
      entityIds: [...new Set([...current.entityIds, ...(value?.entityIds ?? [])])],
      styleFields: [...new Set([...current.styleFields, ...(value?.styleFields ?? [])])],
      sceneIds: [...new Set([...current.sceneIds, ...(value?.sceneIds ?? [])])]
    };
  }, fallback);
}
