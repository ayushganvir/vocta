import { z } from "zod";

export const SCRIPT_TITLE_MAX_LENGTH = 90;
export const SCRIPT_BODY_MAX_LENGTH = 20000;
export const IMAGE_REFERENCE_TITLE_MAX_LENGTH = 90;
export const IMAGE_REFERENCE_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const IMAGE_REFERENCE_ACCEPTED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const optionalTrimmedText = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength)
    .nullish()
    .transform((value) => value || null);

export const createScriptSourcePayloadSchema = z.object({
  projectId: z.string().min(1),
  type: z.literal("SCRIPT"),
  title: z.string().trim().min(2).max(SCRIPT_TITLE_MAX_LENGTH),
  bodyText: z.string().trim().min(1).max(SCRIPT_BODY_MAX_LENGTH)
});

export const createImageReferencePayloadSchema = z.object({
  projectId: z.string().min(1),
  type: z.literal("IMAGE"),
  title: z.string().trim().min(2).max(IMAGE_REFERENCE_TITLE_MAX_LENGTH),
  previewUrl: optionalTrimmedText(2000),
  fileName: optionalTrimmedText(255),
  mimeType: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null),
  sizeBytes: z.number().int().nonnegative().max(IMAGE_REFERENCE_MAX_SIZE_BYTES).optional().nullable()
});

export const createSourceMaterialPayloadSchema = z.discriminatedUnion("type", [
  createScriptSourcePayloadSchema,
  createImageReferencePayloadSchema
]);

export type CreateSourceMaterialPayload = z.infer<typeof createSourceMaterialPayloadSchema>;

export function validateImageMimeType(mimeType: string | null | undefined) {
  if (!mimeType) return true;
  return IMAGE_REFERENCE_ACCEPTED_MIME_TYPES.includes(
    mimeType as (typeof IMAGE_REFERENCE_ACCEPTED_MIME_TYPES)[number]
  );
}

export function buildStubStoragePath(projectId: string, title: string, fileName?: string | null) {
  const safeName = (fileName || title)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return `stub/source-material/${projectId}/${Date.now()}-${safeName || "image-reference"}`;
}
