import { NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { getJobDetail } from "@/server/jobs/query";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const job = await getJobDetail(prisma, jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({ job });
}
