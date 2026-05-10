import { describe, expect, it } from "vitest";

import { createOpenAiImageProvider, createOpenAiTextProvider } from "./openai";

describe("OpenAI providers", () => {
  it("builds a low-quality image request without making a live API call", () => {
    const provider = createOpenAiImageProvider("gpt-image-1");
    const request = provider.buildRequest({
      jobType: "image",
      projectId: "project_1",
      panelId: "panel_1",
      requestedAt: "2026-05-10T00:00:00.000Z",
      prompt: "Create a vertical image",
      aspectRatio: "9:16"
    });

    expect(request.url).toBe("https://api.openai.com/v1/images/generations");
    expect(request.body).toMatchObject({
      model: "gpt-image-1",
      n: 1,
      quality: "low",
      size: "1024x1536",
      response_format: "b64_json"
    });
    const redacted = provider.redactPayload(request) as typeof request;
    expect(redacted.headers).toMatchObject({
      authorization: "[REDACTED]"
    });
  });

  it("builds a bounded Responses API prompt request without making a live API call", () => {
    const provider = createOpenAiTextProvider("gpt-4.1");
    const request = provider.buildRequest({
      jobType: "prompt",
      projectId: "project_1",
      panelId: "panel_1",
      requestedAt: "2026-05-10T00:00:00.000Z",
      outputKind: "image",
      promptLayers: [
        { source: "global", label: "Global", content: "Make it cinematic.", orderIndex: 0 },
        { source: "panel", label: "Panel", content: "A narrow alley.", orderIndex: 1 }
      ]
    });

    expect(request.url).toBe("https://api.openai.com/v1/responses");
    expect(request.body).toMatchObject({
      model: "gpt-4.1",
      max_output_tokens: 300
    });
    expect(String(request.body.input)).toContain("[Global]");
  });
});
