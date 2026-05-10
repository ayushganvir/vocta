import { z } from "zod";

export const modelStackSchema = z.object({
  projectId: z.string().min(1),
  textProvider: z.string().trim().min(1).default("openai"),
  textModel: z.string().trim().min(1).default("gpt-4.1"),
  imageProvider: z.string().trim().min(1).default("openai"),
  imageModel: z.string().trim().min(1).default("gpt-image-1"),
  videoProvider: z.string().trim().min(1).default("xai"),
  videoModel: z.string().trim().min(1).default("grok-imagine-video"),
  voiceProvider: z.string().trim().min(1).default("google"),
  voiceModel: z.string().trim().min(1).default("google-tts"),
  defaultVoiceId: z.string().trim().nullable().optional(),
  providerSettings: z.record(z.unknown()).optional().default({})
});

export type ModelStackForm = z.infer<typeof modelStackSchema>;

