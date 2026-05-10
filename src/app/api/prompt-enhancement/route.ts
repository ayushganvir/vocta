import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";
import { generateFakePromptEnhancement } from "@/server/ai/prompt-enhancement";

const promptEnhancementRequestSchema = z.object({
  panelId: z.string().min(1)
});

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function POST(request: Request) {
  const parsed = promptEnhancementRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid prompt enhancement payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const panel = await prisma.panel.findUnique({
    where: { id: parsed.data.panelId },
    include: {
      project: {
        include: {
          styleBible: true,
          entities: true
        }
      }
    }
  });

  if (!panel) {
    return NextResponse.json({ ok: false, error: "Panel not found" }, { status: 404 });
  }

  const mappedEntityIds = stringArray(panel.mappedEntityIds);
  const mappedEntityNames = panel.project.entities
    .filter((entity) => mappedEntityIds.includes(entity.id))
    .map((entity) => entity.name);

  const result = generateFakePromptEnhancement({
    panel,
    styleBible: panel.project.styleBible,
    mappedEntityNames
  });

  return NextResponse.json({
    ok: true,
    projectId: panel.projectId,
    panelId: panel.id,
    ...result
  });
}

