import { NextResponse } from "next/server";
import { z } from "zod";

import { previewGoogleVoice } from "@/server/providers/google-voices";

const previewSchema = z.object({
  voiceId: z.string().trim().optional().default("en-US-Neural2-J"),
  sampleText: z.string().trim().min(1).max(160),
  emotion: z.string().trim().optional().default(""),
  speakingRate: z.union([z.string(), z.number()]).optional().nullable(),
  pitch: z.union([z.string(), z.number()]).optional().nullable()
});

export async function POST(request: Request) {
  const parsed = previewSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid voice preview payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await previewGoogleVoice({
    voiceId: parsed.data.voiceId,
    sampleText: parsed.data.sampleText,
    emotion: parsed.data.emotion,
    speakingRate: normalizeNumber(parsed.data.speakingRate),
    pitch: normalizeNumber(parsed.data.pitch)
  });

  return NextResponse.json(result);
}

function normalizeNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}
