import type { JobType } from "../jobs/types";
import type { ProviderCapability, ProviderKind } from "./types";
import { providerModeFromEnv } from "./registry";

export interface ProviderCapabilityMatrixItem {
  provider: string;
  kind: ProviderKind;
  defaultModel: string;
  jobTypes: JobType[];
  capabilities: ProviderCapability[];
  realAdapter: boolean;
  enabledInCurrentMode: boolean;
  credentialStatus: "configured" | "missing" | "not_required";
  notes: string[];
}

export function getProviderCapabilityMatrix(): ProviderCapabilityMatrixItem[] {
  const providerMode = providerModeFromEnv();

  return [
    {
      provider: "fake",
      kind: "text",
      defaultModel: "fake-text",
      jobTypes: ["story_analysis", "style_bible_draft", "entity_extraction", "panel_split", "entity_mapping", "prompt", "export"],
      capabilities: ["text-json"],
      realAdapter: false,
      enabledInCurrentMode: providerMode === "fake",
      credentialStatus: "not_required",
      notes: ["Local deterministic provider used for development and no-cost smoke tests."]
    },
    {
      provider: "openai",
      kind: "text",
      defaultModel: "gpt-4.1",
      jobTypes: ["prompt"],
      capabilities: ["text-json", "text-responses"],
      realAdapter: true,
      enabledInCurrentMode: providerMode === "real",
      credentialStatus: openAiConfigured() ? "configured" : "missing",
      notes: ["Uses the Responses API for prompt compilation. Broader story/entity JSON jobs are future work."]
    },
    {
      provider: "openai",
      kind: "image",
      defaultModel: "gpt-image-1",
      jobTypes: ["image"],
      capabilities: ["image-generation", "image-9-16"],
      realAdapter: true,
      enabledInCurrentMode: providerMode === "real",
      credentialStatus: openAiConfigured() ? "configured" : "missing",
      notes: ["Text-to-image is wired. Reference image editing is intentionally not wired yet."]
    },
    {
      provider: "xai",
      kind: "video",
      defaultModel: "grok-imagine-video",
      jobTypes: ["video"],
      capabilities: ["video-prompt-only", "video-image-to-video", "video-first-last-frame", "video-duration"],
      realAdapter: true,
      enabledInCurrentMode: providerMode === "real",
      credentialStatus: process.env.XAI_API_KEY ? "configured" : "missing",
      notes: ["Adapter contract is wired; live endpoint shape still needs capability verification."]
    },
    {
      provider: "google",
      kind: "audio",
      defaultModel: "google-tts",
      jobTypes: ["audio"],
      capabilities: ["audio-pace", "audio-emotion", "audio-wav", "audio-mp3"],
      realAdapter: true,
      enabledInCurrentMode: providerMode === "real",
      credentialStatus: process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY ? "configured" : "missing",
      notes: ["Google TTS maps voice, speaking rate, pitch, and encoding. Emotion remains metadata/prompt guidance."]
    }
  ];
}

function openAiConfigured() {
  return Boolean(process.env.OPENAI_KEY || process.env.OPENAI_API_KEY);
}
