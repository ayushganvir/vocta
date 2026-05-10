import { NextResponse } from "next/server";
import { z } from "zod";

import { serializePanel } from "@/app/api/scenes/_helpers";
import { prisma } from "@/server/db";
import { generatePanelImage } from "@/server/generation/service";

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

  await generatePanelImage(prisma, parsed.data);
  const panel = await loadPanel(parsed.data.panelId);

  return NextResponse.json({ panel: serializePanel(panel) });
}

async function loadPanel(panelId: string) {
  return prisma.panel.findUniqueOrThrow({
    where: { id: panelId },
    include: {
      generatedAssets: { orderBy: { createdAt: "desc" } },
      generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });
}
