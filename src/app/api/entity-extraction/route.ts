import { GenerationJobType, JobStatus, SourceMaterialType } from "@prisma/client";
import { NextResponse } from "next/server";

import { entityExtractionRequestSchema } from "@/features/entity-mapping/schema";
import { prisma } from "@/server/db";
import { extractDraftEntities } from "@/server/ai/entity-extraction/service";

export async function POST(request: Request) {
  const parsed = entityExtractionRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid entity extraction request.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true }
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const sourceMaterials = await prisma.sourceMaterial.findMany({
    where: {
      projectId: parsed.data.projectId,
      ...(parsed.data.sourceMaterialIds?.length ? { id: { in: parsed.data.sourceMaterialIds } } : {}),
      type: { in: [SourceMaterialType.SCRIPT, SourceMaterialType.NOTE, SourceMaterialType.NARRATION] }
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, bodyText: true }
  });
  const text = [
    parsed.data.text,
    ...sourceMaterials.map((material) => [material.title, material.bodyText].filter(Boolean).join("\n"))
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!text) {
    return NextResponse.json({ error: "Source text is required for entity extraction." }, { status: 400 });
  }

  const existingEntities = await prisma.entity.findMany({
    where: { projectId: parsed.data.projectId },
    select: { id: true, name: true, type: true }
  });
  const draft = await extractDraftEntities({
    projectId: parsed.data.projectId,
    sourceMaterialIds: parsed.data.sourceMaterialIds ?? sourceMaterials.map((material) => material.id),
    text,
    existingEntities
  });
  const job = await prisma.generationJob.create({
    data: {
      projectId: parsed.data.projectId,
      type: GenerationJobType.ENTITY_EXTRACTION,
      provider: draft.provider,
      model: draft.model,
      status: JobStatus.COMPLETED,
      requestPayload: {
        sourceMaterialIds: draft.sourceMaterialIds,
        textPreview: text.slice(0, 500)
      },
      responsePayloadSummary: draft,
      logs: [{ message: "Fake entity extraction draft created. No entities were applied automatically." }],
      completedAt: new Date(draft.generatedAt)
    }
  });

  return NextResponse.json({ draft: { ...draft, generationJobId: job.id } });
}
