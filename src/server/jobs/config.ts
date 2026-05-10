import type { JobType } from "./types";

export type QueueKey = "prompt" | "image" | "video" | "audio" | "export";

export const queueNames = {
  prompt: "vocta.prompt",
  image: "vocta.image",
  video: "vocta.video",
  audio: "vocta.audio",
  export: "vocta.export"
} as const satisfies Record<QueueKey, string>;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export const defaultConcurrency = {
  prompt: 10,
  image: 5,
  video: 2,
  audio: 3,
  export: 1
} as const satisfies Record<QueueKey, number>;

export const jobQueueByType = {
  story_analysis: "prompt",
  style_bible_draft: "prompt",
  entity_extraction: "prompt",
  panel_split: "prompt",
  entity_mapping: "prompt",
  prompt: "prompt",
  image: "image",
  video: "video",
  audio: "audio",
  export: "export"
} as const satisfies Record<JobType, QueueKey>;

export type JobQueueByType = typeof jobQueueByType;

export type QueueJobType<TQueueKey extends QueueKey> = {
  [TJobType in JobType]: JobQueueByType[TJobType] extends TQueueKey ? TJobType : never;
}[JobType];

const concurrencyEnvKeys = {
  prompt: "VOCTA_PROMPT_CONCURRENCY",
  image: "VOCTA_IMAGE_CONCURRENCY",
  video: "VOCTA_VIDEO_CONCURRENCY",
  audio: "VOCTA_AUDIO_CONCURRENCY",
  export: "VOCTA_EXPORT_CONCURRENCY"
} as const satisfies Record<QueueKey, string>;

function parseConcurrency(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getQueueConcurrency(input: Record<string, string | undefined> = process.env): Record<QueueKey, number> {
  return {
    prompt: parseConcurrency(input[concurrencyEnvKeys.prompt], defaultConcurrency.prompt),
    image: parseConcurrency(input[concurrencyEnvKeys.image], defaultConcurrency.image),
    video: parseConcurrency(input[concurrencyEnvKeys.video], defaultConcurrency.video),
    audio: parseConcurrency(input[concurrencyEnvKeys.audio], defaultConcurrency.audio),
    export: parseConcurrency(input[concurrencyEnvKeys.export], defaultConcurrency.export)
  };
}

export function getQueueKeyForJobType(jobType: JobType): QueueKey {
  return jobQueueByType[jobType];
}
