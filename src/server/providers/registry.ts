import type { JobPayload, JobType } from "../jobs/types";
import type { ProviderAdapter } from "./types";
import { createFakeProviderForJob } from "./fake";
import { createGoogleTtsProvider } from "./google";
import { createOpenAiImageProvider, createOpenAiTextProvider } from "./openai";
import { createXaiVideoProvider } from "./xai";

export type ProviderMode = "fake" | "real";

export interface ResolveProviderAdapterInput {
  jobType: JobType;
  provider: string;
  model: string;
  mode?: ProviderMode;
}

export interface ResolvedProviderAdapter {
  adapter: ProviderAdapter<JobPayload>;
  mode: ProviderMode;
  configuredProvider: string;
  configuredModel: string;
  runtimeProvider: string;
  runtimeModel: string;
  fallbackReason?: string;
}

export function resolveProviderAdapter(input: ResolveProviderAdapterInput): ResolvedProviderAdapter {
  const mode = input.mode ?? providerModeFromEnv();
  const configuredProvider = input.provider.toLowerCase();

  if (mode === "fake" || configuredProvider === "fake") {
    const adapter = createFakeProviderForJob(input.jobType) as ProviderAdapter<JobPayload>;

    return {
      adapter,
      mode: "fake",
      configuredProvider: input.provider,
      configuredModel: input.model,
      runtimeProvider: adapter.provider,
      runtimeModel: adapter.model,
      fallbackReason: configuredProvider === "fake" ? undefined : "PROVIDER_MODE/VOCTA_PROVIDER_MODE is not set to real."
    };
  }

  const adapter = createRealProviderAdapter(input.jobType, configuredProvider, input.model);

  return {
    adapter: adapter as ProviderAdapter<JobPayload>,
    mode: "real",
    configuredProvider: input.provider,
    configuredModel: input.model,
    runtimeProvider: adapter.provider,
    runtimeModel: adapter.model
  };
}

export function providerModeFromEnv(): ProviderMode {
  return process.env.VOCTA_PROVIDER_MODE === "real" || process.env.PROVIDER_MODE === "real" ? "real" : "fake";
}

function createRealProviderAdapter(jobType: JobType, provider: string, model: string) {
  if (jobType === "prompt" && provider === "openai") {
    return createOpenAiTextProvider(model);
  }

  if (jobType === "image" && provider === "openai") {
    return createOpenAiImageProvider(model);
  }

  if (jobType === "video" && provider === "xai") {
    return createXaiVideoProvider(model);
  }

  if (jobType === "audio" && provider === "google") {
    return createGoogleTtsProvider(model);
  }

  throw new Error(`No real provider adapter registered for ${provider}/${model} ${jobType} jobs.`);
}
