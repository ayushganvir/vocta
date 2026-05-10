import { NextResponse } from "next/server";
import { z } from "zod";

import { serializePanel } from "@/app/api/scenes/_helpers";
import { prisma } from "@/server/db";
import { requestPanelImage } from "@/server/generation/service";

const imageGenerationSchema = z.object({
  panelId: z.string().min(1),
  frameRole: z.enum(["image", "first_frame", "last_frame"]).optional()
});

export async function POST(request: Request) {
  const parsed = imageGenerationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid image generation payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { job, panel, queueJobId } = await requestPanelImage(prisma, parsed.data);

  return NextResponse.json(
    { job, queueJobId, panel: serializePanel(panel) },
    { status: 202 }
  );
}
