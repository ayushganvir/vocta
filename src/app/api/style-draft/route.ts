import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";
import { generateFakeStyleBibleDraft } from "@/server/ai/style-draft";

const styleDraftRequestSchema = z.object({
  projectId: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = styleDraftRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid style draft payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    include: {
      sourceMaterials: true,
      styleBible: true
    }
  });

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
  }

  const result = generateFakeStyleBibleDraft({
    projectTitle: project.title,
    sourceTexts: project.sourceMaterials
      .map((source) => source.bodyText)
      .filter((text): text is string => Boolean(text?.trim())),
    existingStyleBible: project.styleBible
  });

  return NextResponse.json({
    ok: true,
    projectId: project.id,
    ...result
  });
}

