import { redactPayload } from "./redaction";
import type { JobPayload, JobResult, JobType } from "../jobs/types";
import type { ProviderAdapter, ProviderBuiltRequest, ProviderCapability, ProviderKind } from "./types";
export { runProvider } from "./run";

interface FakeRawResponse {
  ok: true;
  generatedAt: string;
  body: Record<string, unknown>;
}

const fakeCapabilities = [
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
] as const satisfies ProviderCapability[];

const textJobTypes = new Set<JobType>([
  "story_analysis",
  "style_bible_draft",
  "entity_extraction",
  "panel_split",
  "entity_mapping",
  "prompt",
  "export"
]);

function nowIso() {
  return new Date().toISOString();
}

function encodeTextBytes(value: string) {
  return new TextEncoder().encode(value);
}

function getPromptLikeText(input: JobPayload) {
  if ("prompt" in input) {
    return input.prompt;
  }

  if ("scriptText" in input) {
    return input.scriptText;
  }

  if ("text" in input) {
    return input.text;
  }

  if ("sourceText" in input) {
    return input.sourceText;
  }

  if ("narration" in input) {
    return input.narration;
  }

  return `${input.jobType} for project ${input.projectId}`;
}

function createBaseResult(input: JobPayload, kind: ProviderKind): Omit<JobResult, "jobType"> {
  return {
    provider: "fake",
    model: `fake-${kind}`,
    completedAt: nowIso(),
    summary: `Fake ${input.jobType} completed for project ${input.projectId}.`,
    warnings: [],
    metadata: {
      fake: true,
      requestedAt: input.requestedAt
    },
    costEstimate: {
      currency: "USD",
      amount: 0,
      billableUnits: {}
    }
  } as Omit<JobResult, "jobType">;
}

function createAsset(input: JobPayload, kind: Exclude<ProviderKind, "text">) {
  const promptPreview = getPromptLikeText(input).slice(0, 180);

  if (kind === "image") {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920"><rect width="1080" height="1920" fill="#1f2937"/><rect x="96" y="128" width="888" height="1664" rx="48" fill="#f8fafc"/><text x="140" y="240" font-family="Arial" font-size="52" fill="#111827">Vocta fake image</text><text x="140" y="340" font-family="Arial" font-size="34" fill="#374151">${promptPreview.replace(/[<>&]/g, "")}</text></svg>`;
    return {
      assetType: "image" as const,
      fileName: `${input.projectId}-${input.jobType}-fake.svg`,
      mimeType: "image/svg+xml",
      bytes: encodeTextBytes(svg),
      metadata: {
        width: 1080,
        height: 1920,
        aspectRatio: "9:16",
        promptPreview
      }
    };
  }

  if (kind === "video") {
    return {
      assetType: "video" as const,
      fileName: `${input.projectId}-${input.jobType}-fake.mp4`,
      mimeType: "video/mp4",
      bytes: encodeTextBytes(`FAKE_MP4_PLACEHOLDER\n${promptPreview}\n`),
      metadata: {
        durationSeconds: "durationSeconds" in input && input.durationSeconds ? input.durationSeconds : 6,
        aspectRatio: "aspectRatio" in input ? input.aspectRatio : "9:16",
        resolution: "resolution" in input ? input.resolution ?? "720p" : "720p",
        sourceMode: "sourceMode" in input ? input.sourceMode ?? "text_to_video" : "text_to_video",
        sourceImageAssetIds: "sourceImageAssetIds" in input ? input.sourceImageAssetIds ?? [] : [],
        promptPreview
      }
    };
  }

  return {
    assetType: "audio" as const,
    fileName: `${input.projectId}-${input.jobType}-fake.${"format" in input ? input.format : "wav"}`,
    mimeType: "format" in input && input.format === "mp3" ? "audio/mpeg" : "audio/wav",
    bytes: encodeTextBytes(`FAKE_AUDIO_PLACEHOLDER\n${promptPreview}\n`),
      metadata: {
        durationSeconds: Math.max(2, Math.ceil(promptPreview.length / 18)),
        transcript: promptPreview,
        speakerEntityId: "speakerEntityId" in input ? input.speakerEntityId ?? null : null,
        voiceId: "voiceId" in input ? input.voiceId ?? "fake-narrator" : "fake-narrator",
        voiceLabel: "voiceLabel" in input ? input.voiceLabel ?? null : null,
        voiceNotes: "voiceNotes" in input ? input.voiceNotes ?? null : null,
        pace: "pace" in input ? input.pace ?? "normal" : "normal",
        emotion: "emotion" in input ? input.emotion ?? null : null,
        speakingRate: "speakingRate" in input ? input.speakingRate ?? null : null,
        pitch: "pitch" in input ? input.pitch ?? null : null
      }
    };
  }

function parseTextResult(input: JobPayload, base: Omit<JobResult, "jobType">): JobResult {
  if (input.jobType === "story_analysis") {
    return {
      ...base,
      jobType: "story_analysis",
      storySummary: `A concise fake story summary based on ${input.sourceMaterialIds.length} source item(s).`,
      suggestedEntities: [
        {
          name: "Aarav",
          type: "character",
          description: "A determined protagonist with a clear emotional arc.",
          visualPrompt: "consistent young protagonist, expressive face, practical clothing"
        },
        {
          name: "Flooded Temple",
          type: "place",
          description: "A cinematic, waterlogged sacred space with strong vertical composition.",
          visualPrompt: "ancient flooded temple, reflective water, shafts of light"
        }
      ],
      suggestedScenes: [
        { title: "Opening Hook", synopsis: "The central conflict is introduced quickly.", orderIndex: 0 },
        { title: "Escalation", synopsis: "The protagonist confronts a concrete obstacle.", orderIndex: 1 }
      ],
      suggestedPanels: [
        {
          sceneOrderIndex: 0,
          title: "Hook Beat",
          narration: input.scriptText.slice(0, 220),
          visualIntent: "A strong first vertical frame that establishes character and location.",
          motionIntent: "Slow push-in with controlled atmosphere."
        }
      ],
      styleSuggestions: {
        visualStyle: "cinematic vertical short, grounded fantasy realism",
        colorPalette: ["deep teal", "warm gold", "soft mist"],
        lightingStyle: "dramatic shafts of motivated light",
        cameraStyle: "slow push-ins, low-angle reveals"
      }
    };
  }

  if (input.jobType === "style_bible_draft") {
    return {
      ...base,
      jobType: "style_bible_draft",
      draft: {
        visualStyle: "cinematic vertical realism with clear silhouettes",
        colorPalette: ["storm blue", "temple gold", "moss green", "skin-warm highlights"],
        lightingStyle: "high contrast, practical motivated light",
        cameraStyle: "vertical close-ups, measured push-ins, occasional overhead reveals",
        negativePrompt: "avoid distorted hands, duplicate faces, unreadable text",
        brandNotes: "Keep assets consistent, editorial, and production-ready."
      },
      rationale: ["Uses strong contrast for mobile legibility.", "Keeps reusable style fields optional."]
    };
  }

  if (input.jobType === "entity_extraction") {
    return {
      ...base,
      jobType: "entity_extraction",
      draftEntities: [
        {
          name: "Narrator",
          type: "speaker",
          description: "Default voiceover speaker for the project.",
          rationale: "A speaker entity helps preserve voice settings even without an image reference."
        },
        {
          name: "Key Location",
          type: "place",
          description: "Primary location inferred from the source material.",
          visualPrompt: "distinct production location, consistent geometry and lighting",
          rationale: "Recurring location terms appeared in the source text."
        }
      ]
    };
  }

  if (input.jobType === "panel_split") {
    return {
      ...base,
      jobType: "panel_split",
      draftPanels: [
        {
          title: "Setup",
          narration: input.sourceText.slice(0, 180),
          visualIntent: "Establish the subject and stakes in a readable vertical composition.",
          motionIntent: "Slow push-in.",
          orderIndex: 0,
          estimatedDurationSeconds: 6
        },
        {
          title: "Turn",
          narration: input.sourceText.slice(180, 360) || input.sourceText.slice(0, 120),
          visualIntent: "Show the key change or reveal.",
          motionIntent: "Subtle camera drift.",
          orderIndex: 1,
          estimatedDurationSeconds: 6
        }
      ]
    };
  }

  if (input.jobType === "entity_mapping") {
    return {
      ...base,
      jobType: "entity_mapping",
      mappings: input.panelIds.map((panelId) => ({
        panelId,
        entityIds: input.entities.slice(0, 3).map((entity) => entity.id),
        confidence: 0.72,
        rationale: "Fake provider matched the first available reusable entities for review.",
        missingReferenceWarnings: input.entities
          .filter((entity) => !entity.hasReferenceAsset)
          .slice(0, 3)
          .map((entity) => `${entity.name} has no selected reference asset.`)
      }))
    };
  }

  if (input.jobType === "prompt") {
    const sortedLayers = [...input.promptLayers].sort((a, b) => a.orderIndex - b.orderIndex);
    return {
      ...base,
      jobType: "prompt",
      compiledPrompt: sortedLayers.map((layer) => `[${layer.label}] ${layer.content}`).join("\n\n"),
      layerBreakdown: sortedLayers.map((layer) => ({
        label: layer.label,
        included: layer.content.trim().length > 0,
        tokenEstimate: Math.ceil(layer.content.length / 4)
      })),
      negativePrompt: "low quality, inconsistent identity, unreadable text"
    };
  }

  if (input.jobType !== "export") {
    throw new Error(`Text fake provider cannot parse media job type: ${input.jobType}`);
  }

  const exportInput = input as JobPayload<"export">;

  return {
    ...base,
    jobType: "export",
    packagePath: `exports/${exportInput.projectId}/fake-export.zip`,
    manifestPath: `exports/${exportInput.projectId}/manifest.json`,
    csvPath: exportInput.includeCsvManifest ? `exports/${exportInput.projectId}/manifest.csv` : undefined,
    assetCount: exportInput.panelIds?.length ?? 0
  };
}

function parseMediaResult(input: JobPayload, kind: Exclude<ProviderKind, "text">, base: Omit<JobResult, "jobType">): JobResult {
  const asset = createAsset(input, kind);
  const assetContract = {
    assetType: asset.assetType,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    sizeBytes: asset.bytes.byteLength,
    metadata: asset.metadata
  };

  if (input.jobType === "image") {
    return {
      ...base,
      jobType: "image",
      assets: [assetContract]
    };
  }

  if (input.jobType === "video") {
    return {
      ...base,
      jobType: "video",
      assets: [assetContract],
      durationSeconds: Number(asset.metadata.durationSeconds)
    };
  }

  return {
    ...base,
    jobType: "audio",
    assets: [assetContract],
    durationSeconds: Number(asset.metadata.durationSeconds),
    transcript: String(asset.metadata.transcript)
  };
}

function createFakeProvider(kind: ProviderKind): ProviderAdapter<JobPayload, ProviderBuiltRequest, FakeRawResponse, JobResult> {
  return {
    provider: "fake",
    model: `fake-${kind}`,
    kind,
    capabilities: fakeCapabilities,
    validateInput(input) {
      const errors: string[] = [];
      const promptLikeText = getPromptLikeText(input);

      if (!input.projectId.trim()) {
        errors.push("projectId is required.");
      }

      if (!input.requestedAt.trim()) {
        errors.push("requestedAt is required.");
      }

      if (!promptLikeText.trim()) {
        errors.push(`${input.jobType} requires non-empty source text or prompt content.`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings: []
      };
    },
    buildRequest(input) {
      const body = {
        payload: input,
        prompt: getPromptLikeText(input),
        metadata: input.metadata ?? {}
      };

      return {
        url: `fake://provider/${kind}`,
        method: "POST",
        headers: {
          authorization: "Bearer fake-provider-token",
          "content-type": "application/json"
        },
        body,
        metadata: {
          providerMode: "fake"
        }
      };
    },
    async execute(request) {
      return {
        ok: true,
        generatedAt: nowIso(),
        body: request.body
      };
    },
    parseResponse(response, request) {
      const input = request.body.payload as JobPayload;
      const base = createBaseResult(input, kind);

      if (kind === "text") {
        return parseTextResult(input, base);
      }

      return parseMediaResult(input, kind, base);
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

export function createFakeTextProvider() {
  return createFakeProvider("text");
}

export function createFakeImageProvider() {
  return createFakeProvider("image");
}

export function createFakeVideoProvider() {
  return createFakeProvider("video");
}

export function createFakeAudioProvider() {
  return createFakeProvider("audio");
}

export function createFakeProviderForJob(jobType: JobType) {
  if (jobType === "image") {
    return createFakeImageProvider();
  }

  if (jobType === "video") {
    return createFakeVideoProvider();
  }

  if (jobType === "audio") {
    return createFakeAudioProvider();
  }

  if (textJobTypes.has(jobType)) {
    return createFakeTextProvider();
  }

  throw new Error(`No fake provider registered for job type: ${jobType}`);
}
