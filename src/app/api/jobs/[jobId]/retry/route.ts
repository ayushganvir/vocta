import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { getJobDetail, retryGenerationJob } from "@/server/jobs/query";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;

  try {
    const retry = await retryGenerationJob(prisma, jobId);

    if (!retry) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const job = await getJobDetail(prisma, retry.id);
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job retry failed." },
      { status: 400 }
    );
  }
}
