import { NextResponse } from "next/server";

import { createStyleBiblePrismaClient, serializeStyleBible } from "@/features/style-bible/data";
import { styleBiblePatchSchema } from "@/features/style-bible/schema";

const prisma = createStyleBiblePrismaClient();

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const styleBible = await prisma.styleBible.findUnique({ where: { projectId } });

  return NextResponse.json({ styleBible: serializeStyleBible(styleBible) });
}

export async function PATCH(request: Request) {
  const parsed = styleBiblePatchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid style bible payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId, ...data } = parsed.data;
  const styleBible = await prisma.styleBible.upsert({
    where: { projectId },
    update: data,
    create: { projectId, ...data }
  });

  return NextResponse.json({ styleBible: serializeStyleBible(styleBible) });
}
