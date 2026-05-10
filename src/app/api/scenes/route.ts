import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createScene, listScenesWithPanels, prisma } from "@/server/db";
import { badRequest, getDefaultProjectId, serializeScene } from "./_helpers";

const createSceneSchema = z.object({
  projectId: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  summary: z.string().optional().nullable(),
  narrativePurpose: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export async function GET(request: NextRequest) {
  const projectId = await getDefaultProjectId(request.nextUrl.searchParams.get("projectId"));

  if (!projectId) {
    return NextResponse.json({ projectId: null, scenes: [] });
  }

  const scenes = await listScenesWithPanels(prisma, projectId);

  return NextResponse.json({
    projectId,
    scenes: scenes.map(serializeScene)
  });
}

export async function POST(request: NextRequest) {
  const parsed = createSceneSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return badRequest("Invalid scene payload.", parsed.error.flatten());
  }

  const projectId = await getDefaultProjectId(parsed.data.projectId);

  if (!projectId) {
    return badRequest("A projectId is required before creating scenes.");
  }

  const orderIndex =
    (await prisma.scene.count({
      where: { projectId }
    })) + 1;

  const scene = await createScene(prisma, {
    projectId,
    orderIndex,
    title: parsed.data.title,
    summary: parsed.data.summary,
    narrativePurpose: parsed.data.narrativePurpose,
    notes: parsed.data.notes
  });

  return NextResponse.json({ scene: serializeScene(scene) }, { status: 201 });
}
