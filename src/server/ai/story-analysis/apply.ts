import { Prisma, PrismaClient } from "@prisma/client";

import { getStoryAnalysisDraftJob } from "./draft";
import type { ApplyStoryDraftPayload, StoryAnalysisDraft } from "@/features/story-analysis/schema";

type ApplyResult = {
  entities: Array<{ id: string; draftId: string; name: string }>;
  styleFields: string[];
  scenes: Array<{ id: string; draftId: string; title: string; panelIds: string[] }>;
};

type StylePatch = Partial<Record<"visualStyle" | "colorPalette" | "lightingStyle" | "cameraStyle" | "negativePromptRules" | "notes", string>>;

const styleFieldMap = {
  visualStyle: "visualStyle",
  colorPalette: "colorPalette",
  lightingStyle: "lightingStyle",
  cameraStyle: "cameraStyle",
  negativePrompt: "negativePromptRules",
  brandNotes: "notes"
} as const;

export async function applyStoryAnalysisDraft(db: PrismaClient, payload: ApplyStoryDraftPayload): Promise<ApplyResult> {
  return db.$transaction(async (tx) => {
    const { job, draft, applied } = await getStoryAnalysisDraftJob(tx, payload.projectId, payload.jobId);
    const result: ApplyResult = { entities: [], styleFields: [], scenes: [] };

    if (payload.apply.section === "entities") {
      const selectedIds = new Set(payload.apply.entityIds ?? draft.entitySuggestions.map((entity) => entity.id));
      for (const entity of draft.entitySuggestions.filter((candidate) => selectedIds.has(candidate.id))) {
        if (applied.entityIds.includes(entity.id)) continue;

        const created = await tx.entity.create({
          data: {
            projectId: payload.projectId,
            name: entity.name,
            type: entity.type,
            description: entity.description,
            visualPromptBlock: entity.visualPrompt,
            sourceGenerationJobId: job.id,
            metadata: {
              storyAnalysisDraftId: entity.id,
              appliedFromJobId: job.id
            }
          }
        });
        result.entities.push({ id: created.id, draftId: entity.id, name: created.name });
      }
    }

    if (payload.apply.section === "style") {
      const selectedFields = payload.apply.fields ?? Object.keys(draft.styleSuggestions);
      const stylePatch = buildStylePatch(draft, selectedFields, applied.styleFields);
      if (Object.keys(stylePatch).length > 0) {
        await tx.styleBible.upsert({
          where: { projectId: payload.projectId },
          update: stylePatch,
          create: {
            projectId: payload.projectId,
            ...stylePatch
          }
        });
        result.styleFields = Object.keys(stylePatch);
      }
    }

    if (payload.apply.section === "scenes") {
      const selectedIds = new Set(payload.apply.sceneIds ?? draft.scenes.map((scene) => scene.id));
      const selectedScenes = draft.scenes.filter((scene) => selectedIds.has(scene.id) && !applied.sceneIds.includes(scene.id));
      const existingSceneCount = await tx.scene.count({ where: { projectId: payload.projectId } });

      for (const [index, scene] of selectedScenes.entries()) {
        const createdScene = await tx.scene.create({
          data: {
            projectId: payload.projectId,
            orderIndex: existingSceneCount + index + 1,
            title: scene.title,
            summary: scene.synopsis,
            narrativePurpose: "Story analysis draft",
            notes: `Applied from story analysis job ${job.id}, draft ${scene.id}.`
          }
        });
        const panelIds: string[] = [];

        for (const [panelIndex, panel] of scene.panels.entries()) {
          const createdPanel = await tx.panel.create({
            data: {
              projectId: payload.projectId,
              sceneId: createdScene.id,
              orderIndex: panelIndex + 1,
              title: panel.title,
              narrationText: panel.narration,
              visualIntent: panel.visualIntent,
              motionIntent: panel.motionIntent,
              notes: `Applied from story analysis job ${job.id}, draft ${panel.id}.`
            }
          });
          panelIds.push(createdPanel.id);
        }

        result.scenes.push({
          id: createdScene.id,
          draftId: scene.id,
          title: createdScene.title,
          panelIds
        });
      }
    }

    await tx.generationJob.update({
      where: { id: job.id },
      data: {
        logs: [
          ...toJsonArray(job.logs),
          {
            level: "info",
            message: "Story analysis draft applied.",
            createdAt: new Date().toISOString(),
            storyAnalysisApplied: {
              entityIds: result.entities.map((entity) => entity.draftId),
              styleFields: result.styleFields.map((field) => reverseStyleField(field)),
              sceneIds: result.scenes.map((scene) => scene.draftId)
            }
          }
        ]
      }
    });

    return result;
  });
}

function buildStylePatch(
  draft: StoryAnalysisDraft,
  selectedFields: string[],
  alreadyAppliedFields: string[]
): StylePatch {
  const patch: StylePatch = {};
  const alreadyApplied = new Set(alreadyAppliedFields);

  for (const field of selectedFields) {
    if (alreadyApplied.has(field)) continue;
    const dbField = styleFieldMap[field as keyof typeof styleFieldMap];
    if (!dbField) continue;

    const value = draft.styleSuggestions[field as keyof StoryAnalysisDraft["styleSuggestions"]];
    if (value === undefined) continue;

    patch[dbField] = Array.isArray(value) ? value.join(", ") : value;
  }

  return patch;
}

function reverseStyleField(dbField: string) {
  const match = Object.entries(styleFieldMap).find(([, value]) => value === dbField);
  return match?.[0] ?? dbField;
}

function toJsonArray(value: Prisma.JsonValue): Prisma.InputJsonArray {
  return Array.isArray(value) ? (value as Prisma.InputJsonArray) : [];
}
