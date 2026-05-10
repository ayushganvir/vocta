import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { clearPanelStaleState } from "@/server/stale/service";
import { notFound, serializePanel } from "../../../scenes/_helpers";

type RouteContext = {
  params: Promise<{ panelId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { panelId } = await context.params;
  const existing = await prisma.panel.findUnique({
    where: { id: panelId },
    select: { id: true }
  });

  if (!existing) {
    return notFound("Panel not found.");
  }

  await clearPanelStaleState(prisma, panelId);
  const panel = await prisma.panel.findUniqueOrThrow({
    where: { id: panelId },
    include: {
      generatedAssets: { orderBy: { createdAt: "desc" } },
      generationJobs: { orderBy: { createdAt: "desc" }, take: 12 }
    }
  });

  return NextResponse.json({ panel: serializePanel(panel) });
}
