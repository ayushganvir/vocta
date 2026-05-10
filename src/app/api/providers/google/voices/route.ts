import { NextResponse } from "next/server";

const fakeGoogleVoices = [
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

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const language = search.get("language")?.toLowerCase();
  const gender = search.get("gender")?.toLowerCase();
  const family = search.get("family")?.toLowerCase();

  const voices = fakeGoogleVoices.filter((voice) => {
    if (language && !voice.language.toLowerCase().includes(language)) return false;
    if (gender && voice.gender.toLowerCase() !== gender) return false;
    if (family && voice.family.toLowerCase() !== family) return false;
    return true;
  });

  return NextResponse.json({
    provider: "google",
    mode: "fake",
    voices
  });
}

