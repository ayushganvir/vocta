import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import {
  badRequest,
  compactScenePanelOrder,
  mergePromptFields,
  notFound,
  panelPatchSchema,
  panelUpdateData,
  serializePanel
} from "../../scenes/_helpers";
import { markPanelPatchStale } from "@/server/stale/service";

type RouteContext = {
  params: Promise<{ panelId: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { panelId } = await context.params;
  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
    include: {
      generatedAssets: { orderBy: { createdAt: "desc" } },
      generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });

  if (!panel) {
    return notFound("Panel not found.");
  }

  return NextResponse.json({ panel: serializePanel(panel) });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { panelId } = await context.params;
  const parsed = panelPatchSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return badRequest("Invalid panel payload.", parsed.error.flatten());
  }

  try {
    const current = await prisma.panel.findUniqueOrThrow({ where: { id: panelId } });
    const data = panelUpdateData(parsed.data);

    if (parsed.data.promptFields) {
      data.timelineMetadata = mergePromptFields(current.timelineMetadata, parsed.data.promptFields);
    }

    await prisma.panel.update({
      where: { id: panelId },
      data
    });
    await markPanelPatchStale(prisma, current, parsed.data);
    const panel = await prisma.panel.findUniqueOrThrow({
      where: { id: panelId },
      include: {
        generatedAssets: { orderBy: { createdAt: "desc" } },
        generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
      }
    });

    return NextResponse.json({ panel: serializePanel(panel) });
  } catch {
    return notFound("Panel not found.");
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { panelId } = await context.params;

  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
    select: { id: true, sceneId: true }
  });

  if (!panel) {
    return notFound("Panel not found.");
  }

  const panels = await prisma.$transaction(async (tx) => {
    await tx.panel.delete({ where: { id: panel.id } });
    return compactScenePanelOrder(tx, panel.sceneId);
  });

  return NextResponse.json({
    deletedPanelId: panel.id,
    sceneId: panel.sceneId,
    panels: panels.map(serializePanel)
  });
}
