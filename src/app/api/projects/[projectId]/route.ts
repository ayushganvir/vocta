import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { updateProjectPayloadSchema } from "@/features/projects/project-validation";
import { ensureProjectInWorkspace, getWorkspaceContext } from "@/features/projects/workspace-context";

type ProjectRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: ProjectRouteContext) {
  try {
    const { projectId } = await context.params;
    const { teamId } = await getWorkspaceContext();
    const project = await ensureProjectInWorkspace(projectId, teamId);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const projectWithCounts = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: projectListInclude
    });

    return NextResponse.json({ data: serializeProject(projectWithCounts) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: ProjectRouteContext) {
  try {
    const { projectId } = await context.params;
    const { teamId } = await getWorkspaceContext();
    const existing = await ensureProjectInWorkspace(projectId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const payload = updateProjectPayloadSchema.parse(await readJson(request));
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        title: payload.title,
        description: payload.description,
        aspectRatio: payload.aspectRatio
      },
      include: projectListInclude
    });

    return NextResponse.json({ data: serializeProject(project) });
  } catch (error) {
    return errorResponse(error);
  }
}

const projectListInclude = {
  _count: {
    select: {
      scenes: true,
      panels: true,
      generatedAssets: true
    }
  }
} satisfies Prisma.ProjectInclude;

function serializeProject(project: Prisma.ProjectGetPayload<{ include: typeof projectListInclude }>) {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Request failed." }, { status: 400 });
}
