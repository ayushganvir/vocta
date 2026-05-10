import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createProject, listProjects, prisma } from "@/server/db";
import { createProjectPayloadSchema, slugifyProjectTitle } from "@/features/projects/project-validation";
import { getWorkspaceContext } from "@/features/projects/workspace-context";

export async function GET() {
  try {
    const { teamId } = await getWorkspaceContext();
    const projects = await listProjects(prisma, teamId);
    return NextResponse.json({ data: projects.map(serializeProject) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createProjectPayloadSchema.parse(await readJson(request));
    const { teamId, userId } = await getWorkspaceContext();
    const slug = await nextAvailableSlug(teamId, slugifyProjectTitle(payload.title));
    const project = await createProject(prisma, {
      teamId,
      createdById: userId,
      title: payload.title,
      slug,
      description: payload.description,
      aspectRatio: payload.aspectRatio
    });
    const projectWithCounts = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: projectListInclude
    });

    return NextResponse.json({ data: serializeProject(projectWithCounts) }, { status: 201 });
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

async function nextAvailableSlug(teamId: string, baseSlug: string) {
  const siblingCount = await prisma.project.count({
    where: {
      teamId,
      OR: [{ slug: baseSlug }, { slug: { startsWith: `${baseSlug}-` } }]
    }
  });

  return siblingCount === 0 ? baseSlug : `${baseSlug}-${siblingCount + 1}`;
}

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
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ error: "Request failed." }, { status: 400 });
}
