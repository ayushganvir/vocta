import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { archiveProject, prisma } from "@/server/db";
import { ensureProjectInWorkspace, getWorkspaceContext } from "@/features/projects/workspace-context";

type ArchiveRouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function POST(_request: Request, context: ArchiveRouteContext) {
  try {
    const { projectId } = await context.params;
    const { teamId } = await getWorkspaceContext();
    const existing = await ensureProjectInWorkspace(projectId, teamId);
    if (!existing) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    await archiveProject(prisma, projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
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

function errorResponse(error: unknown) {
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Request failed." }, { status: 400 });
}
