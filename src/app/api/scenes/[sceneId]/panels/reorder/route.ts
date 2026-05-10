import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";
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

    return NextResponse.json({ sceneId, panels: panels.map(serializePanel) });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Panel reorder failed.");
  }
}
