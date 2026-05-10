import { z } from "zod";

export const storyEntitySuggestionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["character", "place", "object", "speaker"]),
  description: z.string().min(1),
  visualPrompt: z.string().optional()
});

export const storyPanelSuggestionSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string().min(1),
  title: z.string().min(1),
  narration: z.string(),
  visualIntent: z.string().min(1),
  motionIntent: z.string().optional()
});

export const storySceneSuggestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  synopsis: z.string().min(1),
  orderIndex: z.number().int().min(1),
  panels: z.array(storyPanelSuggestionSchema).min(1)
});

export const storyStyleSuggestionsSchema = z.object({
  visualStyle: z.string().optional(),
  colorPalette: z.array(z.string()).optional(),
  lightingStyle: z.string().optional(),
  cameraStyle: z.string().optional(),
  negativePrompt: z.string().optional(),
  brandNotes: z.string().optional()
});

export const storyAnalysisDraftSchema = z.object({
  version: z.literal(1),
  provider: z.literal("fake"),
  model: z.string().min(1),
  generatedAt: z.string().min(1),
  sourceMaterialIds: z.array(z.string().min(1)).min(1),
  storySummary: z.string().min(1),
  entitySuggestions: z.array(storyEntitySuggestionSchema),
  styleSuggestions: storyStyleSuggestionsSchema,
  scenes: z.array(storySceneSuggestionSchema),
  warnings: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      severity: z.enum(["info", "warning", "error"])
    })
  )
});

export const analyzeStoryPayloadSchema = z.object({
  projectId: z.string().min(1),
  sourceMaterialIds: z.array(z.string().min(1)).optional(),
  notes: z.string().optional()
});

export const applyStoryDraftPayloadSchema = z.object({
  projectId: z.string().min(1),
  jobId: z.string().min(1),
  apply: z.discriminatedUnion("section", [
    z.object({
      section: z.literal("entities"),
      entityIds: z.array(z.string().min(1)).optional()
    }),
    z.object({
      section: z.literal("style"),
      fields: z.array(z.enum(["visualStyle", "colorPalette", "lightingStyle", "cameraStyle", "negativePrompt", "brandNotes"])).optional()
    }),
    z.object({
      section: z.literal("scenes"),
      sceneIds: z.array(z.string().min(1)).optional()
    })
  ])
});

export type StoryAnalysisDraft = z.infer<typeof storyAnalysisDraftSchema>;
export type StoryAnalysisDraftEntity = z.infer<typeof storyEntitySuggestionSchema>;
export type StoryAnalysisDraftScene = z.infer<typeof storySceneSuggestionSchema>;
export type ApplyStoryDraftPayload = z.infer<typeof applyStoryDraftPayloadSchema>;
