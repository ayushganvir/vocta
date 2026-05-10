import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createPanel, listPanels, prisma } from "@/server/db";
import { badRequest, notFound, panelMetadataSchema, serializePanel } from "../../_helpers";

const createPanelSchema = z.object({
  title: z.string().trim().min(1),
  narrativePurpose: z.string().optional().nullable(),
  narrationText: z.string().optional().nullable(),
  visualIntent: z.string().optional().nullable(),
  motionIntent: z.string().optional().nullable(),
  targetDurationSeconds: z.number().int().positive().nullable().optional(),
  notes: z.string().optional().nullable(),
  mappedEntityIds: z.array(z.string()).optional(),
  panelReferenceAssetIds: z.array(z.string()).optional(),
  promptFields: panelMetadataSchema.optional()
});

type RouteContext = {
  params: Promise<{ sceneId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { sceneId } = await context.params;
  const panels = await listPanels(prisma, sceneId);

  return NextResponse.json({ sceneId, panels: panels.map(serializePanel) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { sceneId } = await context.params;
  const parsed = createPanelSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return badRequest("Invalid panel payload.", parsed.error.flatten());
  }

  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    select: { id: true, projectId: true }
  });

  if (!scene) {
    return notFound("Scene not found.");
  }

  const panel = await createPanel(prisma, {
    projectId: scene.projectId,
    sceneId: scene.id,
    title: parsed.data.title,
    narrationText: parsed.data.narrationText,
    visualIntent: parsed.data.visualIntent,
    motionIntent: parsed.data.motionIntent,
    notes: parsed.data.notes
  });

  const updated = await prisma.panel.update({
    where: { id: panel.id },
    data: {
      narrativePurpose: parsed.data.narrativePurpose,
      targetDurationSeconds: parsed.data.targetDurationSeconds ?? null,
      mappedEntityIds: parsed.data.mappedEntityIds ?? [],
      panelReferenceAssetIds: parsed.data.panelReferenceAssetIds ?? [],
      timelineMetadata: parsed.data.promptFields ? { promptFields: parsed.data.promptFields } : {}
    }
  });

  return NextResponse.json({ panel: serializePanel(updated) }, { status: 201 });
}
