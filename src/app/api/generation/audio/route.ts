import { NextResponse } from "next/server";
import { z } from "zod";

import { serializePanel } from "@/app/api/scenes/_helpers";
import { prisma } from "@/server/db";
import { generatePanelAudio } from "@/server/generation/service";

const audioGenerationSchema = z.object({
  panelId: z.string().min(1),
  voiceId: z.string().trim().min(1).nullable().optional(),
  pace: z.enum(["slow", "normal", "fast"]).optional(),
  emotion: z.string().trim().min(1).nullable().optional(),
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

  await generatePanelAudio(prisma, parsed.data);
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
