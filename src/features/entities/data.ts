import { PrismaClient } from "@prisma/client";

import { readEnv } from "@/lib/env";

import { normalizeEntityMetadata, type EntityRecord } from "./schema";

export function createEntitiesPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: { url: readEnv().DATABASE_URL }
    }
  });
}

const prisma = createEntitiesPrismaClient();

type EntityWithMappingCount = Awaited<ReturnType<typeof prisma.entity.findMany>>[number] & {
  mappedPanelCount?: number;
};

function panelContainsEntity(mappedEntityIds: unknown, entityId: string) {
  return Array.isArray(mappedEntityIds) && mappedEntityIds.includes(entityId);
}

export function serializeEntity(entity: EntityWithMappingCount): EntityRecord {
  return {
    id: entity.id,
    projectId: entity.projectId,
    name: entity.name,
    type: entity.type,
    description: entity.description,
    visualPromptBlock: entity.visualPromptBlock,
    notes: entity.notes,
    selectedReferenceAssetId: entity.selectedReferenceAssetId,
    metadata: normalizeEntityMetadata(entity.metadata),
    mappedPanelCount: entity.mappedPanelCount ?? 0,
    updatedAt: entity.updatedAt.toISOString()
  };
}

export async function getMappedPanelCount(projectId: string, entityId: string) {
  const panels = await prisma.panel.findMany({
    where: { projectId },
    select: { mappedEntityIds: true }
  });

  return panels.filter((panel) => panelContainsEntity(panel.mappedEntityIds, entityId)).length;
}

export async function listEntitiesWithMappingCounts(projectId: string) {
  const [entities, panels] = await Promise.all([
    prisma.entity.findMany({
      where: { projectId },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    }),
    prisma.panel.findMany({
      where: { projectId },
      select: { mappedEntityIds: true }
    })
  ]);

  return entities.map((entity) =>
    serializeEntity({
      ...entity,
      mappedPanelCount: panels.filter((panel) => panelContainsEntity(panel.mappedEntityIds, entity.id)).length
    })
  );
}

export async function getEntitiesPageData() {
  const project = await prisma.project.findFirst({
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true }
  });

  if (!project) {
    return { project: null, entities: [] };
  }

  return {
    project,
    entities: await listEntitiesWithMappingCounts(project.id)
  };
}

export { prisma };
