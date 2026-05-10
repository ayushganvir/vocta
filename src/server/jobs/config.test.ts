import { describe, expect, it } from "vitest";
import { defaultConcurrency, getQueueConcurrency, getQueueKeyForJobType, jobQueueByType, queueNames } from "./config";

describe("job queue config", () => {
  it("uses the MVP default queue concurrency", () => {
    expect(defaultConcurrency).toEqual({
      prompt: 10,
      image: 5,
      video: 2,
      audio: 3,
      export: 1
    });
  });

  it("routes every job type to the expected queue", () => {
    expect(jobQueueByType).toEqual({
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
    });
    expect(getQueueKeyForJobType("style_bible_draft")).toBe("prompt");
    expect(getQueueKeyForJobType("video")).toBe("video");
  });

  it("allows positive env overrides and ignores invalid values", () => {
    expect(
      getQueueConcurrency({
        VOCTA_PROMPT_CONCURRENCY: "12",
        VOCTA_IMAGE_CONCURRENCY: "0",
        VOCTA_VIDEO_CONCURRENCY: "not-a-number",
        VOCTA_AUDIO_CONCURRENCY: "4",
        VOCTA_EXPORT_CONCURRENCY: "2"
      })
    ).toEqual({
      prompt: 12,
      image: 5,
      video: 2,
      audio: 4,
      export: 2
    });
  });

  it("defines stable BullMQ queue names", () => {
    expect(queueNames).toEqual({
      prompt: "vocta.prompt",
      image: "vocta.image",
      video: "vocta.video",
      audio: "vocta.audio",
      export: "vocta.export"
    });
  });
});
