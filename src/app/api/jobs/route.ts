import { GenerationJobType, JobStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/server/db";
import { listJobs } from "@/server/jobs/query";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const status = enumParam(url.searchParams.get("status"), JobStatus);
  const type = enumParam(url.searchParams.get("type"), GenerationJobType);

  if (url.searchParams.get("status") && !status) {
    return NextResponse.json({ error: "Invalid job status filter." }, { status: 400 });
  }

  if (url.searchParams.get("type") && !type) {
    return NextResponse.json({ error: "Invalid job type filter." }, { status: 400 });
  }

  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  if (limitParam && (!Number.isInteger(limit) || (limit ?? 0) < 1)) {
    return NextResponse.json({ error: "Invalid limit filter." }, { status: 400 });
  }

  const result = await listJobs(prisma, {
    projectId: emptyToUndefined(url.searchParams.get("projectId")),
    panelId: emptyToUndefined(url.searchParams.get("panelId")),
    status: status as JobStatus | undefined,
    type: type as GenerationJobType | undefined,
    limit,
    cursor: emptyToUndefined(url.searchParams.get("cursor"))
  });

  return NextResponse.json(result);
}

function emptyToUndefined(value: string | null) {
  return value?.trim() || undefined;
}

function enumParam<T extends Record<string, string>>(value: string | null, values: T) {
  if (!value) return undefined;
  return Object.values(values).includes(value) ? value : undefined;
}
