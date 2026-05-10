import { NextResponse } from "next/server";

import { createEntitiesPrismaClient, getMappedPanelCount, serializeEntity } from "@/features/entities/data";
import { entityPatchSchema } from "@/features/entities/schema";

const prisma = createEntitiesPrismaClient();

type EntityRouteContext = {
  params: Promise<{ entityId: string }>;
};

export async function PATCH(request: Request, context: EntityRouteContext) {
  const { entityId } = await context.params;
  const parsed = entityPatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid entity payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId, ...data } = parsed.data;
  const existing = await prisma.entity.findFirst({ where: { id: entityId, projectId } });

  if (!existing) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const entity = await prisma.entity.update({
    where: { id: entityId },
    data
  });

  return NextResponse.json({
    entity: serializeEntity({
      ...entity,
      mappedPanelCount: await getMappedPanelCount(projectId, entityId)
    })
  });
}

export async function DELETE(request: Request, context: EntityRouteContext) {
  const { entityId } = await context.params;
  const projectId = new URL(request.url).searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const existing = await prisma.entity.findFirst({ where: { id: entityId, projectId } });

  if (!existing) {
    return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  }

  const mappedPanelCount = await getMappedPanelCount(projectId, entityId);

  await prisma.entity.delete({ where: { id: entityId } });

  return NextResponse.json({
    deletedEntityId: entityId,
    mappedPanelCount,
    warning:
      mappedPanelCount > 0
        ? "Deleted entity was mapped to panels. Downstream panel mapping cleanup is expected in a later workflow."
        : null
  });
}
