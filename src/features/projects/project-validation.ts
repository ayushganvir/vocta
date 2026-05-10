import { z } from "zod";

export const PROJECT_TITLE_MIN_LENGTH = 2;
export const PROJECT_TITLE_MAX_LENGTH = 90;
export const PROJECT_DESCRIPTION_MAX_LENGTH = 500;
export const PROJECT_ASPECT_RATIOS = ["9:16", "16:9", "1:1", "4:5"] as const;
export const DEFAULT_PROJECT_ASPECT_RATIO = "9:16";

export const createProjectPayloadSchema = z.object({
  title: z.string().trim().min(PROJECT_TITLE_MIN_LENGTH).max(PROJECT_TITLE_MAX_LENGTH),
  description: z
    .string()
    .trim()
    .max(PROJECT_DESCRIPTION_MAX_LENGTH)
    .optional()
    .transform((value) => value || null),
  aspectRatio: z.enum(PROJECT_ASPECT_RATIOS).default(DEFAULT_PROJECT_ASPECT_RATIO)
});

export const updateProjectPayloadSchema = createProjectPayloadSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one project field is required."
);

export type CreateProjectPayload = z.infer<typeof createProjectPayloadSchema>;
export type UpdateProjectPayload = z.infer<typeof updateProjectPayloadSchema>;

export function slugifyProjectTitle(title: string) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return slug || "untitled-project";
}
