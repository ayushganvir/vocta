import { redactPayload } from "./redaction";
import type { VideoJobPayload, VideoJobResult } from "../jobs/types";
import type { ProviderAdapter, ProviderBuiltRequest } from "./types";

type XaiVideoRequest = ProviderBuiltRequest & {
  metadata: {
    providerMode: "real";
    configuredProvider: "xai";
    endpointSource: "env" | "default";
  };
};

type XaiVideoRawResponse = Record<string, unknown>;

const defaultXaiVideoEndpoint = "https://api.x.ai/v1/video/generations";

export function createXaiVideoProvider(model: string): ProviderAdapter<VideoJobPayload, XaiVideoRequest, XaiVideoRawResponse, VideoJobResult> {
  return {
    provider: "xai",
    model,
    kind: "video",
    capabilities: [
      "video-prompt-only",
      "video-image-to-video",
      "video-first-last-frame",
      "video-duration"
    ],
    validateInput(input) {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (input.jobType !== "video") errors.push("xAI video provider only accepts video jobs.");
      if (!input.prompt.trim()) errors.push("Video prompt is required.");
      if (input.sourceMode === "image_to_video" && !input.sourceImageAssetIds?.length) {
        warnings.push("image_to_video was requested without source image asset IDs.");
      }
      if (input.sourceMode === "first_last_frame" && (input.sourceImageAssetIds?.length ?? 0) < 2) {
        warnings.push("first_last_frame was requested without both frame asset IDs.");
      }

      return { valid: errors.length === 0, errors, warnings };
    },
    buildRequest(input) {
      const endpoint = process.env.XAI_VIDEO_GENERATION_URL ?? defaultXaiVideoEndpoint;

      return {
        url: endpoint,
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.XAI_API_KEY ?? ""}`,
          "content-type": "application/json"
        },
        body: {
          model,
          prompt: input.prompt,
          duration_seconds: input.durationSeconds,
          aspect_ratio: input.aspectRatio,
          resolution: input.resolution,
          source_mode: input.sourceMode,
          source_image_asset_ids: input.sourceImageAssetIds ?? [],
          reference_asset_ids: input.references?.map((reference) => reference.id) ?? [],
          metadata: {
            projectId: input.projectId,
            panelId: input.panelId,
            generationJobId: input.generationJobId
          }
        },
        metadata: {
          providerMode: "real",
          configuredProvider: "xai",
          endpointSource: process.env.XAI_VIDEO_GENERATION_URL ? "env" : "default"
        }
      };
    },
    async execute(request) {
      if (!process.env.XAI_API_KEY) {
        throw new Error("XAI_API_KEY is required when PROVIDER_MODE=real.");
      }

      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body)
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(`xAI video request failed with ${response.status}: ${JSON.stringify(body)}`);
      }

      return body as XaiVideoRawResponse;
    },
    parseResponse(response, request) {
      const body = request.body;
      const videoUrl = firstString(response, ["video_url", "url", "output_url"]);
      const durationSeconds = numberValue(body.duration_seconds) ?? 6;

      return {
        jobType: "video",
        provider: "xai",
        model,
        completedAt: new Date().toISOString(),
        summary: "xAI video generation completed.",
        warnings: videoUrl ? [] : [{ code: "xai.video_url_missing", message: "No video URL was found in the xAI response.", severity: "warning" }],
        metadata: {
          providerMode: "real",
          rawResponseKeys: Object.keys(response),
          videoUrl
        },
        assets: [
          {
            assetType: "video",
            fileName: `${String(body.generationJobId ?? "xai-video")}.mp4`,
            mimeType: "video/mp4",
            metadata: {
              remoteUrl: videoUrl,
              durationSeconds,
              aspectRatio: body.aspect_ratio,
              resolution: body.resolution,
              sourceMode: body.source_mode
            }
          }
        ],
        durationSeconds,
        costEstimate: {
          currency: "USD",
          amount: 0,
          billableUnits: {}
        }
      };
    },
    estimateCost() {
      return {
        currency: "USD",
        amount: 0,
        billableUnits: {}
      };
    },
    redactPayload
  };
}

function firstString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
