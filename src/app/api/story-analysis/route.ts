import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { ensureProjectInWorkspace, getWorkspaceContext } from "@/features/projects/workspace-context";
import {
  analyzeStoryPayloadSchema,
  applyStoryDraftPayloadSchema
} from "@/features/story-analysis/schema";
import { analyzeStoryDraft, listStoryAnalysisDrafts } from "@/server/ai/story-analysis/draft";
import { applyStoryAnalysisDraft } from "@/server/ai/story-analysis/apply";
import { prisma } from "@/server/db";

export async function GET(request: Request) {
  try {
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    }

    const { teamId } = await getWorkspaceContext();
    const project = await ensureProjectInWorkspace(projectId, teamId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    return NextResponse.json({ data: await listStoryAnalysisDrafts(prisma, projectId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const action = typeof body.action === "string" ? body.action : "analyze";

    if (action === "apply") {
      const payload = applyStoryDraftPayloadSchema.parse(body);
      const { teamId } = await getWorkspaceContext();
      const project = await ensureProjectInWorkspace(payload.projectId, teamId);
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }

      const result = await applyStoryAnalysisDraft(prisma, payload);
      return NextResponse.json({ data: result });
    }

    const payload = analyzeStoryPayloadSchema.parse(body);
    const { teamId, userId } = await getWorkspaceContext();
    const project = await ensureProjectInWorkspace(payload.projectId, teamId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const job = await analyzeStoryDraft(prisma, {
      projectId: payload.projectId,
      sourceMaterialIds: payload.sourceMaterialIds,
      requestedByUserId: userId,
      notes: payload.notes
    });

    return NextResponse.json(
      {
        data: {
          id: job.id,
          projectId: job.projectId,
          status: job.status,
          createdAt: job.createdAt.toISOString(),
          completedAt: job.completedAt?.toISOString() ?? null,
          draft: job.draft,
          applied: {
            entityIds: [],
            styleFields: [],
            sceneIds: []
          }
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function errorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Request failed." }, { status: 400 });
}
