import { NextResponse } from "next/server";

import { entityExtractionApplySchema } from "@/features/entity-mapping/schema";
import { serializeEntity } from "@/features/entities/data";
import { prisma } from "@/server/db";

export async function POST(request: Request) {
  const parsed = entityExtractionApplySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid entity extraction apply payload.", issues: parsed.error.flatten() },
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

  const entities = await prisma.$transaction(
    parsed.data.draftEntities.map((draft) =>
      prisma.entity.create({
        data: {
          projectId: parsed.data.projectId,
          name: draft.name,
          type: draft.type.toLowerCase(),
          description: draft.description,
          visualPromptBlock: draft.visualPromptBlock ?? null,
          notes: [
            draft.rationale ? `AI rationale: ${draft.rationale}` : null,
            draft.duplicateReason ? `Duplicate warning: ${draft.duplicateReason}` : null
          ]
            .filter(Boolean)
            .join("\n"),
          sourceGenerationJobId: parsed.data.sourceGenerationJobId ?? undefined,
          metadata: {
            speakerOnly: draft.metadata?.speakerOnly ?? draft.type.toLowerCase() === "speaker",
            voiceLabel: "",
            voiceNotes: "",
            aiDraft: true,
            duplicateOfEntityId: draft.duplicateOfEntityId ?? null,
            confidence: draft.metadata?.confidence ?? null,
            sourceTextSnippets: draft.sourceTextSnippets ?? []
          }
        }
      })
    )
  );

  return NextResponse.json({
    entities: entities.map((entity) => serializeEntity({ ...entity, mappedPanelCount: 0 })),
    appliedCount: entities.length
  });
}
