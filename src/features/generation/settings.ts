import { z } from "zod";

export const generationAspectRatios = ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3"] as const;
export const videoResolutions = ["480p", "720p", "1080p"] as const;
export const videoSourceModes = ["text_to_video", "image_to_video", "first_last_frame"] as const;
export const audioFormats = ["wav", "mp3"] as const;
export const audioPaces = ["slow", "normal", "fast"] as const;

const nullableString = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional();

const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((value) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  });

export const audioSettingsSchema = z.object({
  speakerEntityId: nullableString,
  voiceId: nullableString,
  voiceLabel: nullableString,
  voiceNotes: nullableString,
  emotion: nullableString,
  pace: z.enum(audioPaces).optional().default("normal"),
  speakingRate: optionalNumber,
  pitch: optionalNumber,
  format: z.enum(audioFormats).optional().default("wav")
});

export const videoSettingsSchema = z.object({
  durationSeconds: z
    .union([z.number().int().positive(), z.string()])
    .optional()
    .nullable()
    .transform((value) => {
      if (value === null || value === undefined || value === "") return null;
      const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }),
  aspectRatio: z.enum(generationAspectRatios).optional().default("9:16"),
  resolution: z.enum(videoResolutions).optional().default("720p"),
  sourceMode: z.enum(videoSourceModes).optional().default("text_to_video")
});

export type AudioSettings = z.infer<typeof audioSettingsSchema>;
export type VideoSettings = z.infer<typeof videoSettingsSchema>;

export const emptyAudioSettings: AudioSettings = {
  speakerEntityId: null,
  voiceId: null,
  voiceLabel: null,
  voiceNotes: null,
  emotion: null,
  pace: "normal",
  speakingRate: null,
  pitch: null,
  format: "wav"
};

export const emptyVideoSettings: VideoSettings = {
  durationSeconds: null,
  aspectRatio: "9:16",
  resolution: "720p",
  sourceMode: "text_to_video"
};

export function normalizeAudioSettings(value: unknown): AudioSettings {
  return audioSettingsSchema.parse(value ?? {});
}

export function normalizeVideoSettings(value: unknown): VideoSettings {
  return videoSettingsSchema.parse(value ?? {});
}

