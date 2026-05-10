import { describe, expect, it } from "vitest";

import { resolveProviderAdapter } from "./registry";

describe("provider registry", () => {
  it("uses fake adapters by default while preserving configured provider metadata", () => {
    const resolved = resolveProviderAdapter({
      jobType: "video",
      provider: "xai",
      model: "grok-imagine-video"
    });

    expect(resolved.mode).toBe("fake");
    expect(resolved.configuredProvider).toBe("xai");
    expect(resolved.configuredModel).toBe("grok-imagine-video");
    expect(resolved.runtimeProvider).toBe("fake");
    expect(resolved.adapter.kind).toBe("video");
    expect(resolved.fallbackReason).toContain("PROVIDER_MODE");
  });

  it("resolves real OpenAI, xAI, and Google adapters when real mode is requested", () => {
    const image = resolveProviderAdapter({
      jobType: "image",
      provider: "openai",
      model: "gpt-image-1",
      mode: "real"
    });
    const video = resolveProviderAdapter({
      jobType: "video",
      provider: "xai",
      model: "grok-imagine-video",
      mode: "real"
    });
    const audio = resolveProviderAdapter({
      jobType: "audio",
      provider: "google",
      model: "google-tts",
      mode: "real"
    });

    expect(image.runtimeProvider).toBe("openai");
    expect(image.adapter.kind).toBe("image");
    expect(video.runtimeProvider).toBe("xai");
    expect(video.adapter.kind).toBe("video");
    expect(audio.runtimeProvider).toBe("google");
    expect(audio.adapter.kind).toBe("audio");
  });

  it("fails loudly for unsupported real provider routes", () => {
    expect(() =>
      resolveProviderAdapter({
        jobType: "story_analysis",
        provider: "openai",
        model: "gpt-4.1",
        mode: "real"
      })
    ).toThrow("No real provider adapter registered");
  });
});
