import { z } from "zod";

export const styleBibleFields = [
  "charactersText",
  "placesText",
  "objectsText",
  "visualStyle",
  "colorPalette",
  "lightingStyle",
  "cameraStyle"
] as const;

const nullableText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null))
  .nullable()
  .optional();

export const styleBiblePatchSchema = z.object({
  projectId: z.string().min(1),
  charactersText: nullableText,
  placesText: nullableText,
  objectsText: nullableText,
  visualStyle: nullableText,
  colorPalette: nullableText,
  lightingStyle: nullableText,
  cameraStyle: nullableText
});

export type StyleBiblePatch = z.infer<typeof styleBiblePatchSchema>;

export type StyleBibleRecord = {
  id: string;
  projectId: string;
  charactersText: string | null;
  placesText: string | null;
  objectsText: string | null;
  visualStyle: string | null;
  colorPalette: string | null;
  lightingStyle: string | null;
  cameraStyle: string | null;
  updatedAt: string;
};

export function getMissingStyleBibleFields(styleBible: Partial<StyleBibleRecord> | null) {
  return styleBibleFields.filter((field) => !styleBible?.[field]?.trim());
}
