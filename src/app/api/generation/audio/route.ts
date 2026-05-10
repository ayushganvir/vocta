import { NextResponse } from "next/server";
import { z } from "zod";

import { serializePanel } from "@/app/api/scenes/_helpers";
import { prisma } from "@/server/db";
import { requestPanelAudio } from "@/server/generation/service";

const audioGenerationSchema = z.object({
  panelId: z.string().min(1),
  speakerEntityId: z.string().trim().min(1).nullable().optional(),
  voiceId: z.string().trim().min(1).nullable().optional(),
  voiceLabel: z.string().trim().min(1).nullable().optional(),
  voiceNotes: z.string().trim().min(1).nullable().optional(),
  pace: z.enum(["slow", "normal", "fast"]).optional(),
  emotion: z.string().trim().min(1).nullable().optional(),
  speakingRate: z.number().positive().max(4).nullable().optional(),
  pitch: z.number().min(-20).max(20).nullable().optional(),
  format: z.enum(["wav", "mp3"]).optional()
});

export async function POST(request: Request) {
  const parsed = audioGenerationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid audio generation payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { job, panel, queueJobId } = await requestPanelAudio(prisma, parsed.data);

  return NextResponse.json(
    { job, queueJobId, panel: serializePanel(panel) },
    { status: 202 }
  );
}
