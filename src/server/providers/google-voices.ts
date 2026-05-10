import { providerModeFromEnv } from "./registry";

export type GoogleVoiceGender = "male" | "female" | "neutral" | "unspecified";

export type GoogleVoiceCatalogItem = {
  voiceId: string;
  label: string;
  language: string;
  gender: GoogleVoiceGender;
  family: string;
  supportedFeatures: string[];
  naturalSampleRateHertz?: number;
};

export type GoogleVoiceCatalogFilters = {
  language?: string | null;
  gender?: string | null;
  family?: string | null;
};

export type GoogleVoiceCatalogResult = {
  provider: "google";
  mode: "fake" | "real";
  voices: GoogleVoiceCatalogItem[];
  warnings: string[];
};

export type GoogleVoicePreviewInput = {
  voiceId?: string;
  sampleText: string;
  emotion?: string;
  speakingRate?: number | null;
  pitch?: number | null;
};

export type GoogleVoicePreviewResult = {
  provider: "google";
  mode: "fake" | "real";
  voiceId: string;
  voiceLabel: string;
  previewUrl?: string;
  audioBase64?: string;
  audioDataUrl?: string;
  mimeType: "audio/wav" | "audio/mpeg";
  metadata: {
    sampleText: string;
    emotion: string | null;
    speakingRate: number | null;
    pitch: number | null;
    externalCall: boolean;
  };
  warnings: string[];
};

type GoogleVoicesResponse = {
  voices?: Array<{
    name?: string;
    languageCodes?: string[];
    ssmlGender?: string;
    naturalSampleRateHertz?: number;
  }>;
  [key: string]: unknown;
};

type GoogleSynthesizeResponse = {
  audioContent?: string;
  [key: string]: unknown;
};

const fakeGoogleVoices: GoogleVoiceCatalogItem[] = [
  {
    voiceId: "en-US-Neural2-J",
    label: "English US - Warm Narrator",
    language: "en-US",
    gender: "male",
    family: "Neural2",
    supportedFeatures: ["speakingRate", "pitch", "mp3", "wav"]
  },
  {
    voiceId: "en-US-Neural2-F",
    label: "English US - Clear Presenter",
    language: "en-US",
    gender: "female",
    family: "Neural2",
    supportedFeatures: ["speakingRate", "pitch", "mp3", "wav"]
  },
  {
    voiceId: "hi-IN-Neural2-A",
    label: "Hindi India - Story Voice",
    language: "hi-IN",
    gender: "female",
    family: "Neural2",
    supportedFeatures: ["speakingRate", "pitch", "mp3", "wav"]
  }
];

export async function listGoogleVoices(filters: GoogleVoiceCatalogFilters = {}): Promise<GoogleVoiceCatalogResult> {
  if (providerModeFromEnv() !== "real") {
    return {
      provider: "google",
      mode: "fake",
      voices: filterVoices(fakeGoogleVoices, filters),
      warnings: ["Fake provider mode: no Google API call was made."]
    };
  }

  const apiKey = googleApiKey();

  if (!apiKey) {
    return {
      provider: "google",
      mode: "real",
      voices: filterVoices(fakeGoogleVoices, filters),
      warnings: ["Google credentials are missing; returned seeded fake voices instead of calling Google."]
    };
  }

  const url = new URL("https://texttospeech.googleapis.com/v1/voices");
  url.searchParams.set("key", apiKey);
  if (filters.language?.trim()) {
    url.searchParams.set("languageCode", filters.language.trim());
  }

  const response = await fetch(url);
  const body = await response.json().catch(() => ({})) as GoogleVoicesResponse;

  if (!response.ok) {
    return {
      provider: "google",
      mode: "real",
      voices: filterVoices(fakeGoogleVoices, filters),
      warnings: [`Google voices request failed with ${response.status}; returned seeded fake voices.`]
    };
  }

  return {
    provider: "google",
    mode: "real",
    voices: filterVoices((body.voices ?? []).map(googleVoiceToCatalogItem), filters),
    warnings: []
  };
}

export async function previewGoogleVoice(input: GoogleVoicePreviewInput): Promise<GoogleVoicePreviewResult> {
  const voiceId = input.voiceId?.trim() || "en-US-Neural2-J";
  const sampleText = input.sampleText.trim().slice(0, 160);
  const mimeType = "audio/wav";

  if (providerModeFromEnv() !== "real") {
    const previewId = Buffer.from(`${voiceId}:${sampleText}`).toString("base64url").slice(0, 16);

    return {
      provider: "google",
      mode: "fake",
      voiceId,
      voiceLabel: voiceId,
      previewUrl: `/api/providers/google/voice-preview/${previewId}.wav`,
      mimeType,
      metadata: previewMetadata(input, sampleText, false),
      warnings: ["Fake provider mode: no Google API call was made."]
    };
  }

  const apiKey = googleApiKey();

  if (!apiKey) {
    return {
      provider: "google",
      mode: "real",
      voiceId,
      voiceLabel: voiceId,
      previewUrl: `/api/providers/google/voice-preview/${Buffer.from(`${voiceId}:${sampleText}`).toString("base64url").slice(0, 16)}.wav`,
      mimeType,
      metadata: previewMetadata(input, sampleText, false),
      warnings: ["Google credentials are missing; returned fake preview URL instead of calling Google."]
    };
  }

  const url = new URL("https://texttospeech.googleapis.com/v1/text:synthesize");
  url.searchParams.set("key", apiKey);
  const requestBody = {
    input: { text: sampleText },
    voice: {
      name: voiceId,
      languageCode: inferLanguageCode(voiceId)
    },
    audioConfig: {
      audioEncoding: "LINEAR16",
      speakingRate: input.speakingRate ?? undefined,
      pitch: input.pitch ?? undefined
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(requestBody)
  });
  const body = await response.json().catch(() => ({})) as GoogleSynthesizeResponse;

  if (!response.ok || !body.audioContent) {
    return {
      provider: "google",
      mode: "real",
      voiceId,
      voiceLabel: voiceId,
      previewUrl: `/api/providers/google/voice-preview/${Buffer.from(`${voiceId}:${sampleText}`).toString("base64url").slice(0, 16)}.wav`,
      mimeType,
      metadata: previewMetadata(input, sampleText, true),
      warnings: [`Google preview request failed with ${response.status}; returned fake preview URL.`]
    };
  }

  return {
    provider: "google",
    mode: "real",
    voiceId,
    voiceLabel: voiceId,
    audioBase64: body.audioContent,
    audioDataUrl: `data:${mimeType};base64,${body.audioContent}`,
    mimeType,
    metadata: previewMetadata(input, sampleText, true),
    warnings: []
  };
}

function googleVoiceToCatalogItem(voice: NonNullable<GoogleVoicesResponse["voices"]>[number]): GoogleVoiceCatalogItem {
  const voiceId = voice.name ?? "";
  const language = voice.languageCodes?.[0] ?? inferLanguageCode(voiceId);

  return {
    voiceId,
    label: `${language} - ${voiceId}`,
    language,
    gender: normalizeGender(voice.ssmlGender),
    family: inferVoiceFamily(voiceId),
    supportedFeatures: ["speakingRate", "pitch", "mp3", "wav"],
    naturalSampleRateHertz: voice.naturalSampleRateHertz
  };
}

function filterVoices(voices: GoogleVoiceCatalogItem[], filters: GoogleVoiceCatalogFilters) {
  const language = filters.language?.toLowerCase().trim();
  const gender = filters.gender?.toLowerCase().trim();
  const family = filters.family?.toLowerCase().trim();

  return voices.filter((voice) => {
    if (language && !voice.language.toLowerCase().includes(language)) return false;
    if (gender && voice.gender.toLowerCase() !== gender) return false;
    if (family && voice.family.toLowerCase() !== family) return false;
    return true;
  });
}

function previewMetadata(input: GoogleVoicePreviewInput, sampleText: string, externalCall: boolean) {
  return {
    sampleText,
    emotion: input.emotion?.trim() || null,
    speakingRate: input.speakingRate ?? null,
    pitch: input.pitch ?? null,
    externalCall
  };
}

function googleApiKey() {
  return process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function inferLanguageCode(voiceId: string | undefined) {
  if (!voiceId) return "en-US";
  const match = voiceId.match(/^([a-z]{2}-[A-Z]{2})-/);
  return match?.[1] ?? "en-US";
}

function inferVoiceFamily(voiceId: string) {
  if (voiceId.includes("Neural2")) return "Neural2";
  if (voiceId.includes("WaveNet")) return "WaveNet";
  if (voiceId.includes("Studio")) return "Studio";
  if (voiceId.includes("Standard")) return "Standard";
  return "Other";
}

function normalizeGender(value: string | undefined): GoogleVoiceGender {
  const normalized = value?.toLowerCase();
  if (normalized === "male") return "male";
  if (normalized === "female") return "female";
  if (normalized === "neutral") return "neutral";
  return "unspecified";
}
