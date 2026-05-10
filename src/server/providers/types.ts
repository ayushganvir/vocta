export type ProviderKind = "text" | "image" | "video" | "audio";

export type ProviderCapability =
  | "text-json"
  | "image-9-16"
  | "image-references"
  | "video-prompt-only"
  | "video-image-to-video"
  | "video-first-last-frame"
  | "video-duration"
  | "audio-pace"
  | "audio-emotion"
  | "audio-wav"
  | "audio-mp3";

export interface ProviderRequest {
  prompt: string;
  references?: Array<{
    id: string;
    urlOrPath: string;
    role: "entity" | "panel" | "firstFrame" | "lastFrame" | "style";
  }>;
  metadata?: Record<string, unknown>;
}

export interface ProviderAssetOutput {
  assetType: "image" | "video" | "audio" | "reference";
  fileName: string;
  mimeType: string;
  bytes?: Uint8Array;
  metadata?: Record<string, unknown>;
}

export interface ProviderResponse {
  provider: string;
  model: string;
  summary: Record<string, unknown>;
  assets: ProviderAssetOutput[];
  tokenUsage?: Record<string, number>;
  costEstimateUsd?: number;
}

export interface ProviderAdapter {
  provider: string;
  model: string;
  kind: ProviderKind;
  capabilities: ProviderCapability[];
  execute(request: ProviderRequest): Promise<ProviderResponse>;
  redactPayload(payload: unknown): unknown;
}

