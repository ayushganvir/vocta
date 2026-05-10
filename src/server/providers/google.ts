import { redactPayload } from "./redaction";
import type { AudioJobPayload, AudioJobResult } from "../jobs/types";
import type { ProviderAdapter, ProviderBuiltRequest } from "./types";

type GoogleTtsRequest = ProviderBuiltRequest & {
  metadata: {
    providerMode: "real";
    configuredProvider: "google";
  };
};

type GoogleTtsRawResponse = {
  audioContent?: string;
  [key: string]: unknown;
};

export function createGoogleTtsProvider(model: string): ProviderAdapter<AudioJobPayload, GoogleTtsRequest, GoogleTtsRawResponse, AudioJobResult> {
  return {
    provider: "google",
    model,
    kind: "audio",
    capabilities: ["audio-pace", "audio-emotion", "audio-wav", "audio-mp3"],
    validateInput(input) {
      const errors: string[] = [];

      if (input.jobType !== "audio") errors.push("Google TTS provider only accepts audio jobs.");
      if (!input.narration.trim()) errors.push("Narration text is required.");
      if (!input.voiceId?.trim()) errors.push("Google TTS requires a resolved voiceId.");

      return { valid: errors.length === 0, errors, warnings: [] };
    },
    buildRequest(input) {
      const apiKey = process.env.GOOGLE_TTS_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";
      const audioEncoding = input.format === "mp3" ? "MP3" : "LINEAR16";

      return {
        url: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: {
          input: { text: input.narration },
          voice: {
            name: input.voiceId,
            languageCode: inferLanguageCode(input.voiceId)
          },
          audioConfig: {
            audioEncoding,
            speakingRate: input.speakingRate,
            pitch: input.pitch
          },
          metadata: {
            projectId: input.projectId,
            panelId: input.panelId,
            generationJobId: input.generationJobId,
            speakerEntityId: input.speakerEntityId,
            voiceLabel: input.voiceLabel,
            voiceNotes: input.voiceNotes,
            pace: input.pace,
            emotion: input.emotion
          }
        },
        metadata: {
          providerMode: "real",
          configuredProvider: "google"
        }
      };
    },
    async execute(request) {
      if (!process.env.GOOGLE_TTS_API_KEY && !process.env.GOOGLE_API_KEY) {
        throw new Error("GOOGLE_TTS_API_KEY or GOOGLE_API_KEY is required when VOCTA_PROVIDER_MODE=real.");
      }

      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(request.body)
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(`Google TTS request failed with ${response.status}: ${JSON.stringify(body)}`);
      }

      return body as GoogleTtsRawResponse;
    },
    parseResponse(response, request) {
      const metadata = request.body.metadata && typeof request.body.metadata === "object"
        ? request.body.metadata as Record<string, unknown>
        : {};
      const audioEncoding = metadata.format === "mp3" ? "MP3" : request.body.audioConfig && typeof request.body.audioConfig === "object"
        ? (request.body.audioConfig as Record<string, unknown>).audioEncoding
        : "LINEAR16";
      const format = audioEncoding === "MP3" ? "mp3" : "wav";
      const narration = request.body.input && typeof request.body.input === "object"
        ? String((request.body.input as Record<string, unknown>).text ?? "")
        : "";

      return {
        jobType: "audio",
        provider: "google",
        model,
        completedAt: new Date().toISOString(),
        summary: "Google TTS synthesis completed.",
        warnings: response.audioContent ? [] : [{ code: "google.audio_content_missing", message: "No audioContent field was found in the Google TTS response.", severity: "warning" }],
        metadata: {
          providerMode: "real",
          rawResponseKeys: Object.keys(response),
          hasAudioContent: Boolean(response.audioContent)
        },
        assets: [
          {
            assetType: "audio",
            fileName: `${String(metadata.generationJobId ?? "google-tts")}.${format}`,
            mimeType: format === "mp3" ? "audio/mpeg" : "audio/wav",
            metadata: {
              transcript: narration,
              durationSeconds: Math.max(2, Math.ceil(narration.length / 18)),
              speakerEntityId: metadata.speakerEntityId ?? null,
              voiceId: voiceName(request.body),
              voiceLabel: metadata.voiceLabel ?? null,
              voiceNotes: metadata.voiceNotes ?? null,
              pace: metadata.pace ?? "normal",
              emotion: metadata.emotion ?? null,
              speakingRate: audioConfigNumber(request.body, "speakingRate"),
              pitch: audioConfigNumber(request.body, "pitch")
            }
          }
        ],
        durationSeconds: Math.max(2, Math.ceil(narration.length / 18)),
        transcript: narration,
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

function inferLanguageCode(voiceId: string | undefined) {
  if (!voiceId) return "en-US";
  const match = voiceId.match(/^([a-z]{2}-[A-Z]{2})-/);
  return match?.[1] ?? "en-US";
}

function voiceName(body: Record<string, unknown>) {
  const voice = body.voice;
  if (!voice || typeof voice !== "object" || Array.isArray(voice)) return null;
  const name = (voice as Record<string, unknown>).name;
  return typeof name === "string" ? name : null;
}

function audioConfigNumber(body: Record<string, unknown>, key: string) {
  const audioConfig = body.audioConfig;
  if (!audioConfig || typeof audioConfig !== "object" || Array.isArray(audioConfig)) return null;
  const value = (audioConfig as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
