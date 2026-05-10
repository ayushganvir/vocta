import { z } from "zod";

export const mvpEntityTypes = ["character", "place", "object"] as const;

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

export const entityMetadataSchema = z.object({
  speakerOnly: z.boolean().default(false),
  voiceId: z.string().trim().optional().default(""),
  voiceLabel: z.string().trim().optional().default(""),
  voiceNotes: z.string().trim().optional().default(""),
  defaultEmotion: z.string().trim().optional().default(""),
  speakingRate: z
    .union([z.number(), z.string()])
    .optional()
    .default("")
    .transform((value) => {
      if (value === "") return "";
      const parsed = typeof value === "number" ? value : Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : "";
    }),
  pitch: z
    .union([z.number(), z.string()])
    .optional()
    .default("")
    .transform((value) => {
      if (value === "") return "";
      const parsed = typeof value === "number" ? value : Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : "";
    }),
  sampleText: z.string().trim().optional().default("")
});

export const entityWriteSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1),
  type: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.toLowerCase()),
  description: nullableText,
  visualPromptBlock: nullableText,
  notes: nullableText,
  selectedReferenceAssetId: nullableText,
  metadata: entityMetadataSchema.default({
    speakerOnly: false,
    voiceId: "",
    voiceLabel: "",
    voiceNotes: "",
    defaultEmotion: "",
    speakingRate: "",
    pitch: "",
    sampleText: ""
  })
});

export const entityPatchSchema = entityWriteSchema.partial().extend({
  projectId: z.string().min(1)
});

export type EntityWriteInput = z.infer<typeof entityWriteSchema>;
export type EntityPatchInput = z.infer<typeof entityPatchSchema>;
export type EntityMetadata = z.infer<typeof entityMetadataSchema>;

export type EntityRecord = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  description: string | null;
  visualPromptBlock: string | null;
  notes: string | null;
  selectedReferenceAssetId: string | null;
  metadata: EntityMetadata;
  mappedPanelCount: number;
  updatedAt: string;
};

export function normalizeEntityMetadata(value: unknown): EntityMetadata {
  return entityMetadataSchema.parse(value ?? {});
}

export function isVisualEntity(entity: Pick<EntityRecord, "metadata" | "type">) {
  return !entity.metadata.speakerOnly;
}

export function getReferenceWarning(entity: Pick<EntityRecord, "metadata" | "selectedReferenceAssetId" | "type">) {
  if (!isVisualEntity(entity) || entity.selectedReferenceAssetId) {
    return null;
  }

  return "Hard warning: visual generation should not run until a reference is selected.";
}
