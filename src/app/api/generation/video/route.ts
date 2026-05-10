import { NextResponse } from "next/server";
import { z } from "zod";

import { serializePanel } from "@/app/api/scenes/_helpers";
import { prisma } from "@/server/db";
import { generatePanelVideo } from "@/server/generation/service";

const videoGenerationSchema = z.object({
  panelId: z.string().min(1),
  durationSeconds: z.number().int().positive().max(60).nullable().optional()
});

export async function POST(request: Request) {
  const parsed = videoGenerationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid video generation payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await generatePanelVideo(prisma, parsed.data);
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
