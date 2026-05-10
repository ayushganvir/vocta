import type { JobCostEstimate, JobPayload, JobResult } from "../jobs/types";

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
  assetType: "image" | "video" | "audio" | "reference" | "export";
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

export interface ProviderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProviderBuiltRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ProviderAdapter<
  TInput extends JobPayload = JobPayload,
  TBuiltRequest extends ProviderBuiltRequest = ProviderBuiltRequest,
  TRawResponse = unknown,
  TResult extends JobResult = JobResult
> {
  provider: string;
  model: string;
  kind: ProviderKind;
  capabilities: ProviderCapability[];
  validateInput(input: TInput): ProviderValidationResult;
  buildRequest(input: TInput): TBuiltRequest;
  execute(request: TBuiltRequest): Promise<TRawResponse>;
  parseResponse(response: TRawResponse, request: TBuiltRequest): Promise<TResult> | TResult;
  estimateCost(input: TInput): JobCostEstimate;
  redactPayload(payload: unknown): unknown;
}
