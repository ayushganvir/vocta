import { GenerationJobType, JobStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { entityMappingRequestSchema } from "@/features/entity-mapping/schema";
import { normalizeEntityMetadata } from "@/features/entities/schema";
import { prisma } from "@/server/db";
import { buildEntityMappingDraft } from "@/server/ai/entity-mapping/service";
import { serializePanel } from "../scenes/_helpers";

export async function POST(request: Request) {
  const parsed = entityMappingRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid entity mapping request.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [project, entities, panels] = await Promise.all([
    prisma.project.findUnique({ where: { id: parsed.data.projectId }, select: { id: true } }),
    prisma.entity.findMany({
      where: { projectId: parsed.data.projectId },
      orderBy: [{ type: "asc" }, { name: "asc" }]
    }),
    prisma.panel.findMany({
      where: {
        projectId: parsed.data.projectId,
        ...(parsed.data.panelIds?.length ? { id: { in: parsed.data.panelIds } } : {})
      },
      orderBy: [{ scene: { orderIndex: "asc" } }, { orderIndex: "asc" }]
    })
  ]);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const draft = await buildEntityMappingDraft({
    projectId: parsed.data.projectId,
    panels: panels.map((panel) => serializePanel(panel)),
    entities: entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      type: entity.type,
      description: entity.description,
      visualPromptBlock: entity.visualPromptBlock,
      selectedReferenceAssetId: entity.selectedReferenceAssetId,
      metadata: normalizeEntityMetadata(entity.metadata)
    }))
  });
  const job = await prisma.generationJob.create({
    data: {
      projectId: parsed.data.projectId,
      type: GenerationJobType.ENTITY_MAPPING,
      provider: draft.provider,
      model: draft.model,
      status: JobStatus.COMPLETED,
      requestPayload: {
        panelIds: panels.map((panel) => panel.id),
        entityIds: entities.map((entity) => entity.id)
      },
      responsePayloadSummary: draft,
      logs: [{ message: "Fake entity mapping draft created. No panel mappings were applied automatically." }],
      completedAt: new Date(draft.generatedAt)
    }
  });

  return NextResponse.json({ draft: { ...draft, generationJobId: job.id } });
}
