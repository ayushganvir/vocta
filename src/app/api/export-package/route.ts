import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/server/db";
import { createOrderedExportPackage, getExportReadiness } from "@/server/export/service";

const exportRequestSchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
  includeCsv: z.boolean().optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const readiness = await getExportReadiness(prisma, url.searchParams.get("projectId"));

  return NextResponse.json({ readiness });
}

export async function POST(request: Request) {
  const parsed = exportRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid export package payload.", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await createOrderedExportPackage(prisma, parsed.data);
    const readiness = await getExportReadiness(prisma, parsed.data.projectId);

    return NextResponse.json({ exportPackage: result, readiness });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export package failed." },
      { status: 400 }
    );
  }
}
