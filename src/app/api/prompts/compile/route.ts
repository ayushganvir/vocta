import { PromptPurpose } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";
import { compilePanelPrompt, storePromptCompilation } from "@/server/prompting";

const compilePromptRequestSchema = z.object({
  panelId: z.string().min(1),
  purpose: z.nativeEnum(PromptPurpose).default(PromptPurpose.IMAGE),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  userNotes: z.string().optional().nullable(),
  persist: z.boolean().default(false)
});

export async function POST(request: Request) {
  const parsed = compilePromptRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid prompt compile request", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const compiled = await compilePanelPrompt(prisma, parsed.data);
    const stored = parsed.data.persist
      ? await storePromptCompilation(prisma, compiled)
      : null;

    return NextResponse.json({
      ok: true,
      promptCompilationId: stored?.id,
      finalPrompt: compiled.finalPrompt,
      layers: compiled.layers,
      layerBreakdown: compiled.layerBreakdown,
      attachedReferenceAssetIds: compiled.attachedReferenceAssetIds,
      entityReferenceAssetIds: compiled.entityReferenceAssetIds,
      panelReferenceAssetIds: compiled.panelReferenceAssetIds,
      tokenEstimate: compiled.tokenEstimate,
      provider: compiled.provider,
      model: compiled.model,
      purpose: compiled.purpose
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Prompt compilation failed";
    const status = message.startsWith("Panel not found") ? 404 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
