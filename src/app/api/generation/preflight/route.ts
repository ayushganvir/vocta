import { NextResponse } from "next/server";
import { z } from "zod";

import { videoSourceModes } from "@/features/generation/settings";
import { prisma } from "@/server/db";
import {
  GenerationPreflightPanelNotFoundError,
  runGenerationPreflight
} from "@/server/generation/preflight";

const generationPreflightSchema = z.object({
  panelId: z.string().min(1),
  assetType: z.enum(["image", "video", "audio"]),
  sourceMode: z.enum(videoSourceModes).optional()
});

export async function POST(request: Request) {
  const parsed = generationPreflightSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid generation preflight payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await runGenerationPreflight(prisma, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof GenerationPreflightPanelNotFoundError) {
      return NextResponse.json(
        { ok: false, error: "Panel not found.", warnings: [], canProceed: false },
        { status: 404 }
      );
    }

    throw error;
  }
}
