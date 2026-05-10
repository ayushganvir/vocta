import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { cancelGenerationJob, getJobDetail } from "@/server/jobs/query";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const cancelled = await cancelGenerationJob(prisma, jobId);

    if (!cancelled) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const job = await getJobDetail(prisma, cancelled.id);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job cancel failed." },
      { status: 400 }
    );
  }
}
