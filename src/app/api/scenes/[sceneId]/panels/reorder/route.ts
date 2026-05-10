import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";
import { markPanelsStale } from "@/server/stale/service";
import { badRequest, reorderPanelsInTransaction, serializePanel } from "../../../_helpers";

const reorderSchema = z.object({
  orderedPanelIds: z.array(z.string()).min(1)
});

type RouteContext = {
  params: Promise<{ sceneId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { sceneId } = await context.params;
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return badRequest("Invalid panel reorder payload.", parsed.error.flatten());
  }

  try {
    const panels = await prisma.$transaction((tx) =>
      reorderPanelsInTransaction(tx, sceneId, parsed.data.orderedPanelIds)
    );
    if (panels[0]) {
      await markPanelsStale(prisma, {
        projectId: panels[0].projectId,
        panelIds: panels.map((panel) => panel.id),
        reason: "panelOrderChanged"
      });
    }
    const refreshedPanels = await prisma.panel.findMany({
      where: { sceneId },
      orderBy: { orderIndex: "asc" },
      include: {
        generatedAssets: { orderBy: { createdAt: "desc" } },
        generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
      }
    });

    return NextResponse.json({ sceneId, panels: refreshedPanels.map(serializePanel) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Panel reorder failed.");
  }
}
