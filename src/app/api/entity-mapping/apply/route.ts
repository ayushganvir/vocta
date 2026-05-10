import { NextResponse } from "next/server";

import { entityMappingApplySchema } from "@/features/entity-mapping/schema";
import { normalizeMappingApplyInput } from "@/server/ai/entity-mapping/service";
import { prisma } from "@/server/db";
import { serializePanel } from "../../scenes/_helpers";

export async function POST(request: Request) {
  const parsed = entityMappingApplySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid entity mapping apply payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const normalizedMappings = normalizeMappingApplyInput(parsed.data.mappings);
  const [panels, entities] = await Promise.all([
    prisma.panel.findMany({
      where: {
        projectId: parsed.data.projectId,
        id: { in: normalizedMappings.map((mapping) => mapping.panelId) }
      },
      select: { id: true }
    }),
    prisma.entity.findMany({
      where: { projectId: parsed.data.projectId },
      select: { id: true }
    })
  ]);
  const panelIds = new Set(panels.map((panel) => panel.id));
  const entityIds = new Set(entities.map((entity) => entity.id));
  const invalidPanelId = normalizedMappings.find((mapping) => !panelIds.has(mapping.panelId))?.panelId;
  const invalidEntityId = normalizedMappings
    .flatMap((mapping) => mapping.entityIds)
    .find((entityId) => !entityIds.has(entityId));

  if (invalidPanelId) {
    return NextResponse.json({ error: `Panel does not belong to project: ${invalidPanelId}` }, { status: 400 });
  }

  if (invalidEntityId) {
    return NextResponse.json({ error: `Entity does not belong to project: ${invalidEntityId}` }, { status: 400 });
  }

  const updatedPanels = await prisma.$transaction(
    normalizedMappings.map((mapping) =>
      prisma.panel.update({
        where: { id: mapping.panelId },
        data: { mappedEntityIds: mapping.entityIds }
      })
    )
  );

  return NextResponse.json({
    appliedCount: updatedPanels.length,
    panels: updatedPanels.map(serializePanel)
  });
}
