import { NextResponse } from "next/server";

import {
  createEntitiesPrismaClient,
  getMappedPanelCount,
  listEntitiesWithMappingCounts,
  serializeEntity
} from "@/features/entities/data";
import { entityWriteSchema } from "@/features/entities/schema";

const prisma = createEntitiesPrismaClient();

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  return NextResponse.json({ entities: await listEntitiesWithMappingCounts(projectId) });
}

export async function POST(request: Request) {
  const parsed = entityWriteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid entity payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const entity = await prisma.entity.create({
    data: parsed.data
  });

  return NextResponse.json({
    entity: serializeEntity({
      ...entity,
      mappedPanelCount: await getMappedPanelCount(entity.projectId, entity.id)
    })
  });
}
