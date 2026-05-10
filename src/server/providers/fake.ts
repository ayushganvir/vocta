import { redactPayload } from "./redaction";
import type { ProviderAdapter, ProviderKind, ProviderRequest, ProviderResponse } from "./types";

function fakeAsset(kind: ProviderKind) {
  if (kind === "image") {
    return { assetType: "image" as const, fileName: "fake-image.png", mimeType: "image/png" };
  }

  if (kind === "video") {
    return { assetType: "video" as const, fileName: "fake-video.mp4", mimeType: "video/mp4" };
  }

  if (kind === "audio") {
    return { assetType: "audio" as const, fileName: "fake-audio.wav", mimeType: "audio/wav" };
  }

  return { assetType: "reference" as const, fileName: "fake-response.json", mimeType: "application/json" };
}

export function createFakeProvider(kind: ProviderKind): ProviderAdapter {
  return {
    provider: "fake",
    model: `fake-${kind}`,
    kind,
    capabilities: [
      "text-json",
      "image-9-16",
      "image-references",
      "video-prompt-only",
      "video-image-to-video",
      "video-first-last-frame",
      "video-duration",
      "audio-pace",
      "audio-emotion",
      "audio-wav",
      "audio-mp3"
    ],
    async execute(request: ProviderRequest): Promise<ProviderResponse> {
      return {
        provider: "fake",
        model: `fake-${kind}`,
        summary: {
          promptPreview: request.prompt.slice(0, 120),
          referenceCount: request.references?.length ?? 0
        },
        assets: [fakeAsset(kind)],
        tokenUsage: kind === "text" ? { input: 100, output: 50 } : undefined,
        costEstimateUsd: 0
      };
    },
    redactPayload
  };
}

