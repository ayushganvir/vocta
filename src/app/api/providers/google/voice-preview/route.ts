import { NextResponse } from "next/server";
import { z } from "zod";

const previewSchema = z.object({
  voiceId: z.string().trim().optional().default("en-US-Neural2-J"),
  sampleText: z.string().trim().min(1).max(500),
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

  const voiceId = parsed.data.voiceId || "en-US-Neural2-J";
  const previewId = Buffer.from(`${voiceId}:${parsed.data.sampleText}`).toString("base64url").slice(0, 16);

  return NextResponse.json({
    provider: "google",
    mode: "fake",
    voiceId,
    voiceLabel: voiceId,
    previewUrl: `/api/providers/google/voice-preview/${previewId}.wav`,
    metadata: {
      sampleText: parsed.data.sampleText,
      emotion: parsed.data.emotion || null,
      speakingRate: normalizeNumber(parsed.data.speakingRate),
      pitch: normalizeNumber(parsed.data.pitch)
    }
  });
}

function normalizeNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

