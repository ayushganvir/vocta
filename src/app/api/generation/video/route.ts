import { NextResponse } from "next/server";
import { z } from "zod";

import { serializePanel } from "@/app/api/scenes/_helpers";
import { generationAspectRatios, videoResolutions, videoSourceModes } from "@/features/generation/settings";
import { prisma } from "@/server/db";
import { requestPanelVideo } from "@/server/generation/service";

const videoGenerationSchema = z.object({
  panelId: z.string().min(1),
  durationSeconds: z.number().int().positive().max(60).nullable().optional(),
  aspectRatio: z.enum(generationAspectRatios).optional(),
  resolution: z.enum(videoResolutions).optional(),
  sourceMode: z.enum(videoSourceModes).optional()
});

export async function POST(request: Request) {
  const parsed = videoGenerationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid video generation payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { job, panel, queueJobId } = await requestPanelVideo(prisma, parsed.data);

  return NextResponse.json(
    { job, queueJobId, panel: serializePanel(panel) },
    { status: 202 }
  );
}
