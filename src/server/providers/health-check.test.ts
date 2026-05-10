import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkProviderHealth } from "./health-check";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.OPENAI_KEY = "";
  process.env.OPENAI_API_KEY = "";
  process.env.GOOGLE_TTS_API_KEY = "";
  process.env.GOOGLE_API_KEY = "";
  process.env.XAI_API_KEY = "";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("provider health checks", () => {
  it("dry-runs OpenAI image checks without making a network call", async () => {
    const result = await checkProviderHealth({
      provider: "openai",
      kind: "image"
    });

    expect(result.status).toBe("warning");
    expect(result.mode).toBe("dry_run");
    expect(result.credentialStatus).toBe("missing");
    expect(result.adapterStatus).toBe("available");
    expect(result.costLabel).toBe("none");
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.requestPreview).toMatchObject({
      method: "POST",
      headers: {
        authorization: "[REDACTED]"
      },
      body: {
        model: "gpt-image-1",
        n: 1,
        quality: "low",
        size: "1024x1536"
      }
    });
  });

  it("redacts credential-bearing dry-run request previews", async () => {
    process.env.GOOGLE_API_KEY = "google-health-check-secret";

    const result = await checkProviderHealth({
      provider: "google",
      kind: "audio"
    });

    const preview = result.requestPreview as { url: string };

    expect(result.status).toBe("ok");
    expect(result.credentialStatus).toBe("configured");
    expect(preview.url).toContain("key=%5BREDACTED%5D");
    expect(preview.url).not.toContain("google-health-check-secret");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns unsupported results for unregistered provider and kind pairs", async () => {
    const result = await checkProviderHealth({
      provider: "openai",
      kind: "audio"
    });

    expect(result.status).toBe("failed");
    expect(result.adapterStatus).toBe("unsupported");
    expect(result.requestPreview).toBeNull();
    expect(result.error).toContain("Unsupported provider health-check target");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("does not call real providers for unsupported live health checks", async () => {
    process.env.OPENAI_API_KEY = "sk-health-check";

    const result = await checkProviderHealth({
      provider: "openai",
      kind: "text",
      live: true
    });

    expect(result.status).toBe("warning");
    expect(result.mode).toBe("live");
    expect(result.credentialStatus).toBe("configured");
    expect(result.error).toContain("Live health check is unsupported");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("supports live fake checks locally", async () => {
    const result = await checkProviderHealth({
      provider: "fake",
      kind: "video",
      live: true
    });

    expect(result.status).toBe("ok");
    expect(result.mode).toBe("live");
    expect(result.credentialStatus).toBe("not_required");
    expect(result.riskLabel).toBe("local_only");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
