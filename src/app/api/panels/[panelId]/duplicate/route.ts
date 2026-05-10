import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { notFound, reorderPanelsInTransaction, serializePanel } from "../../../scenes/_helpers";

type RouteContext = {
  params: Promise<{ panelId: string }>;
};

export async function POST(_request: NextRequest, context: RouteContext) {
  const { panelId } = await context.params;

  const source = await prisma.panel.findUnique({ where: { id: panelId } });

  if (!source) {
    return notFound("Panel not found.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const scenePanels = await tx.panel.findMany({
      where: { sceneId: source.sceneId },
      orderBy: { orderIndex: "asc" }
    });

    const duplicate = await tx.panel.create({
      data: {
        projectId: source.projectId,
        sceneId: source.sceneId,
        orderIndex: scenePanels.length + 1,
        title: `${source.title} copy`,
        narrativePurpose: source.narrativePurpose,
        narrationText: source.narrationText,
        visualIntent: source.visualIntent,
        motionIntent: source.motionIntent,
        targetDurationSeconds: source.targetDurationSeconds,
        notes: source.notes,
        mappedEntityIds: (source.mappedEntityIds ?? []) as Prisma.InputJsonValue,
        panelReferenceAssetIds: (source.panelReferenceAssetIds ?? []) as Prisma.InputJsonValue,
        timelineMetadata: (source.timelineMetadata ?? {}) as Prisma.InputJsonValue,
        staleState: {
          duplicatedFromPanelId: source.id,
          requiresPromptReview: true
        }
      }
    });

    const orderedPanelIds = scenePanels.flatMap((panel) =>
      panel.id === source.id ? [panel.id, duplicate.id] : [panel.id]
    );
    const panels = await reorderPanelsInTransaction(tx, source.sceneId, orderedPanelIds);

    return { duplicate, panels };
  });

  return NextResponse.json(
    {
      panel: serializePanel(result.duplicate),
      sceneId: source.sceneId,
      panels: result.panels.map(serializePanel)
    },
    { status: 201 }
  );
}
