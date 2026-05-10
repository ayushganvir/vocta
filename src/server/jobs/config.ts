export const queueNames = {
  prompt: "vocta.prompt",
  image: "vocta.image",
  video: "vocta.video",
  audio: "vocta.audio",
  export: "vocta.export"
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export const defaultConcurrency = {
  prompt: 10,
  image: 5,
  video: 2,
  audio: 3,
  export: 1
} as const;

