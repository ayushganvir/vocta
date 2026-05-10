import { z } from "zod";

export const entityExtractionRequestSchema = z.object({
  projectId: z.string().min(1),
  sourceMaterialIds: z.array(z.string().min(1)).optional(),
  text: z.string().optional()
});

const draftEntitySchema = z.object({
  draftId: z.string().min(1),
  name: z.string().trim().min(1),
  type: z.string().trim().min(1),
  description: z.string().trim().min(1),
  visualPromptBlock: z.string().nullable().optional(),
  duplicateOfEntityId: z.string().nullable().optional(),
  duplicateReason: z.string().nullable().optional(),
  rationale: z.string().optional(),
  sourceTextSnippets: z.array(z.string()).optional(),
  metadata: z
    .object({
      speakerOnly: z.boolean().optional(),
      confidence: z.number().min(0).max(1).optional()
    })
    .optional()
});

export const entityExtractionApplySchema = z.object({
  projectId: z.string().min(1),
  sourceGenerationJobId: z.string().optional().nullable(),
  draftEntities: z.array(draftEntitySchema).min(1)
});

export const entityMappingRequestSchema = z.object({
  projectId: z.string().min(1),
  panelIds: z.array(z.string().min(1)).optional()
});

const mappingSchema = z.object({
  panelId: z.string().min(1),
  suggestedEntityIds: z.array(z.string()).optional(),
  entityIds: z.array(z.string()).optional()
});

export const entityMappingApplySchema = z.object({
  projectId: z.string().min(1),
  mappings: z.array(mappingSchema).min(1)
});

export type EntityExtractionRequest = z.infer<typeof entityExtractionRequestSchema>;
export type EntityExtractionApplyInput = z.infer<typeof entityExtractionApplySchema>;
export type EntityMappingRequest = z.infer<typeof entityMappingRequestSchema>;
export type EntityMappingApplyInput = z.infer<typeof entityMappingApplySchema>;
