import type {
  AudioJobPayload,
  ImageJobPayload,
  JobPayload,
  PromptJobPayload,
  VideoJobPayload
} from "../jobs/types";
import { getProviderCapabilityMatrix } from "./capabilities";
import {
  createFakeAudioProvider,
  createFakeImageProvider,
  createFakeTextProvider,
  createFakeVideoProvider
} from "./fake";
import { createGoogleTtsProvider } from "./google";
import { createOpenAiImageProvider, createOpenAiTextProvider } from "./openai";
import { createXaiVideoProvider } from "./xai";
import type { ProviderAdapter, ProviderBuiltRequest, ProviderKind } from "./types";

export type ProviderHealthStatus = "ok" | "warning" | "failed";
export type ProviderHealthMode = "dry_run" | "live";
export type ProviderHealthCredentialStatus = "configured" | "missing" | "not_required" | "unknown";
export type ProviderHealthAdapterStatus = "available" | "unsupported" | "build_failed";

export interface ProviderHealthCheckInput {
  provider: string;
  kind: ProviderKind;
  model?: string;
  live?: boolean;
}

export interface ProviderHealthCheckResult {
  status: ProviderHealthStatus;
  provider: string;
  kind: ProviderKind;
  model: string | null;
  mode: ProviderHealthMode;
  credentialStatus: ProviderHealthCredentialStatus;
  adapterStatus: ProviderHealthAdapterStatus;
  requestPreview: unknown;
  costLabel: "none" | "lowest_possible" | "unknown";
  riskLabel: "no_external_call" | "local_only" | "external_call_unsupported";
  notes: string[];
  error?: string;
}

type HealthAdapter = ProviderAdapter<JobPayload, ProviderBuiltRequest, unknown>;

export async function checkProviderHealth(input: ProviderHealthCheckInput): Promise<ProviderHealthCheckResult> {
  const provider = input.provider.trim().toLowerCase();
  const kind = input.kind;
  const mode: ProviderHealthMode = input.live === true ? "live" : "dry_run";
  const model = input.model?.trim() || defaultModel(provider, kind);
  const credentialStatus = credentialStatusForProvider(provider);
  const notes: string[] = [];

  if (!model) {
    return {
      status: "failed",
      provider,
      kind,
      model: null,
      mode,
      credentialStatus,
      adapterStatus: "unsupported",
      requestPreview: null,
      costLabel: "unknown",
      riskLabel: mode === "live" ? "external_call_unsupported" : "no_external_call",
      notes: [`No default model is registered for ${provider}/${kind}.`],
      error: `Unsupported provider health-check target: ${provider}/${kind}.`
    };
  }

  const adapter = createHealthAdapter(provider, kind, model);

  if (!adapter) {
    return {
      status: "failed",
      provider,
      kind,
      model,
      mode,
      credentialStatus,
      adapterStatus: "unsupported",
      requestPreview: null,
      costLabel: "unknown",
      riskLabel: mode === "live" ? "external_call_unsupported" : "no_external_call",
      notes: [`No adapter is registered for ${provider}/${kind} health checks.`],
      error: `Unsupported provider health-check target: ${provider}/${kind}.`
    };
  }

  const payload = buildHealthPayload(kind);
  const validation = adapter.validateInput(payload);

  notes.push(...validation.warnings);

  if (!validation.valid) {
    return {
      status: "failed",
      provider,
      kind,
      model,
      mode,
      credentialStatus,
      adapterStatus: "build_failed",
      requestPreview: null,
      costLabel: "unknown",
      riskLabel: mode === "live" && provider !== "fake" ? "external_call_unsupported" : "no_external_call",
      notes,
      error: validation.errors.join(" ")
    };
  }

  let request: ProviderBuiltRequest;

  try {
    request = adapter.buildRequest(payload);
  } catch (error) {
    return {
      status: "failed",
      provider,
      kind,
      model,
      mode,
      credentialStatus,
      adapterStatus: "build_failed",
      requestPreview: null,
      costLabel: "unknown",
      riskLabel: mode === "live" && provider !== "fake" ? "external_call_unsupported" : "no_external_call",
      notes,
      error: error instanceof Error ? error.message : "Provider request build failed."
    };
  }

  const requestPreview = sanitizeRequestPreview(adapter.redactPayload(request));

  if (credentialStatus === "missing") {
    notes.push(`Credentials are missing for ${provider}; no live provider call can be made.`);
  }

  if (mode === "dry_run") {
    notes.push("Dry run only: no external call was made and no generation jobs or assets were created.");

    return {
      status: credentialStatus === "missing" ? "warning" : "ok",
      provider,
      kind,
      model,
      mode,
      credentialStatus,
      adapterStatus: "available",
      requestPreview,
      costLabel: "none",
      riskLabel: provider === "fake" ? "local_only" : "no_external_call",
      notes
    };
  }

  if (provider !== "fake") {
    notes.push("Live health checks for real providers are not implemented; no external call was made.");

    return {
      status: "warning",
      provider,
      kind,
      model,
      mode,
      credentialStatus,
      adapterStatus: "available",
      requestPreview,
      costLabel: "lowest_possible",
      riskLabel: "external_call_unsupported",
      notes,
      error: `Live health check is unsupported for ${provider}/${kind}.`
    };
  }

  try {
    await adapter.execute(request);
    notes.push("Live fake health check executed locally without external calls or persistence.");

    return {
      status: "ok",
      provider,
      kind,
      model,
      mode,
      credentialStatus,
      adapterStatus: "available",
      requestPreview,
      costLabel: "none",
      riskLabel: "local_only",
      notes
    };
  } catch (error) {
    return {
      status: "failed",
      provider,
      kind,
      model,
      mode,
      credentialStatus,
      adapterStatus: "available",
      requestPreview,
      costLabel: "none",
      riskLabel: "local_only",
      notes,
      error: error instanceof Error ? error.message : "Live fake health check failed."
    };
  }
}

function createHealthAdapter(provider: string, kind: ProviderKind, model: string): HealthAdapter | null {
  if (provider === "fake") {
    if (kind === "text") return createFakeTextProvider() as HealthAdapter;
    if (kind === "image") return createFakeImageProvider() as HealthAdapter;
    if (kind === "video") return createFakeVideoProvider() as HealthAdapter;
    return createFakeAudioProvider() as HealthAdapter;
  }

  if (provider === "openai" && kind === "text") {
    return createOpenAiTextProvider(model) as HealthAdapter;
  }

  if (provider === "openai" && kind === "image") {
    return createOpenAiImageProvider(model) as HealthAdapter;
  }

  if (provider === "google" && kind === "audio") {
    return createGoogleTtsProvider(model) as HealthAdapter;
  }

  if (provider === "xai" && kind === "video") {
    return createXaiVideoProvider(model) as HealthAdapter;
  }

  return null;
}

function defaultModel(provider: string, kind: ProviderKind) {
  if (provider === "fake") return `fake-${kind}`;

  return getProviderCapabilityMatrix().find((item) => item.provider === provider && item.kind === kind)?.defaultModel ?? "";
}

function credentialStatusForProvider(provider: string): ProviderHealthCredentialStatus {
  if (provider === "fake") return "not_required";
  if (provider === "openai") return process.env.OPENAI_KEY || process.env.OPENAI_API_KEY ? "configured" : "missing";
  if (provider === "google") return process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY ? "configured" : "missing";
  if (provider === "xai") return process.env.XAI_API_KEY ? "configured" : "missing";
  return "unknown";
}

function buildHealthPayload(kind: ProviderKind): JobPayload {
  const base = {
    projectId: "health-check",
    panelId: "health-check-panel",
    requestedAt: new Date(0).toISOString(),
    generationJobId: "health-check-job"
  };

  if (kind === "text") {
    return {
      ...base,
      jobType: "prompt",
      outputKind: "image",
      promptLayers: [
        {
          source: "user",
          label: "Health check",
          content: "Return the word ok.",
          orderIndex: 0
        }
      ]
    } satisfies PromptJobPayload;
  }

  if (kind === "image") {
    return {
      ...base,
      jobType: "image",
      prompt: "Health check image request.",
      aspectRatio: "9:16"
    } satisfies ImageJobPayload;
  }

  if (kind === "video") {
    return {
      ...base,
      jobType: "video",
      prompt: "Health check video request.",
      aspectRatio: "9:16",
      resolution: "480p",
      sourceMode: "text_to_video",
      durationSeconds: 1
    } satisfies VideoJobPayload;
  }

  return {
    ...base,
    jobType: "audio",
    narration: "Health check.",
    voiceId: "en-US-Neural2-J",
    voiceLabel: "Health check voice",
    speakingRate: 1,
    pitch: 0,
    format: "wav"
  } satisfies AudioJobPayload;
}

function sanitizeRequestPreview(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRequestPreview(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        key.toLowerCase() === "url" && typeof item === "string" ? sanitizeUrl(item) : sanitizeRequestPreview(item)
      ])
    );
  }

  return value;
}

function sanitizeUrl(value: string) {
  try {
    const url = new URL(value);
    let changed = false;

    for (const key of [...url.searchParams.keys()]) {
      if (/^(key|api[-_]?key|token|access_token|client_secret|signature|sig)$/i.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
        changed = true;
      }
    }

    return changed ? url.toString() : value;
  } catch {
    return value;
  }
}
