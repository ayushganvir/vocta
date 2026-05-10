import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listGoogleVoices, previewGoogleVoice } from "./google-voices";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  process.env.PROVIDER_MODE = "";
  process.env.VOCTA_PROVIDER_MODE = "";
  process.env.GOOGLE_TTS_API_KEY = "";
  process.env.GOOGLE_API_KEY = "";
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("Google voice catalog and preview", () => {
  it("returns seeded fake voices without external calls in fake mode", async () => {
    const result = await listGoogleVoices({ language: "hi", gender: "female" });

    expect(result.mode).toBe("fake");
    expect(result.voices).toEqual([
      expect.objectContaining({
        voiceId: "hi-IN-Neural2-A",
        language: "hi-IN",
        gender: "female"
      })
    ]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("lists real Google voices only when real mode and credentials are configured", async () => {
    process.env.PROVIDER_MODE = "real";
    process.env.GOOGLE_API_KEY = "google-test-key";
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      voices: [
        {
          name: "en-US-Neural2-J",
          languageCodes: ["en-US"],
          ssmlGender: "MALE",
          naturalSampleRateHertz: 24000
        }
      ]
    })));

    const result = await listGoogleVoices({ language: "en-US" });

    expect(result.mode).toBe("real");
    expect(result.voices).toEqual([
      expect.objectContaining({
        voiceId: "en-US-Neural2-J",
        language: "en-US",
        gender: "male",
        family: "Neural2"
      })
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("languageCode=en-US");
  });

  it("returns a fake preview URL in fake mode without spending on TTS", async () => {
    const result = await previewGoogleVoice({
      voiceId: "en-US-Neural2-J",
      sampleText: "Preview this line.",
      speakingRate: 1,
      pitch: 0
    });

    expect(result.mode).toBe("fake");
    expect(result.previewUrl).toContain("/api/providers/google/voice-preview/");
    expect(result.metadata.externalCall).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns inline audio for explicit real-mode preview calls", async () => {
    process.env.PROVIDER_MODE = "real";
    process.env.GOOGLE_API_KEY = "google-test-key";
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      audioContent: Buffer.from("audio-bytes").toString("base64")
    })));

    const result = await previewGoogleVoice({
      voiceId: "en-US-Neural2-J",
      sampleText: "A short paid preview.",
      speakingRate: 1,
      pitch: 0
    });

    expect(result.mode).toBe("real");
    expect(result.audioDataUrl).toContain("data:audio/wav;base64,");
    expect(result.metadata.externalCall).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
