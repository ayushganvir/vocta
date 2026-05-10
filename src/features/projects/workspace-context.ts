import { prisma } from "@/server/db";

const DEMO_USER_EMAIL = "demo@vocta.local";
const DEMO_TEAM_SLUG = "internal";

export async function getWorkspaceContext() {
  const [user, team] = await Promise.all([
    prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      where: { email: DEMO_USER_EMAIL }
    }),
    prisma.team.findFirst({
      orderBy: { createdAt: "asc" },
      where: { slug: DEMO_TEAM_SLUG }
    })
  ]);

  const fallbackUser =
    user ??
    (await prisma.user.findFirst({
      orderBy: { createdAt: "asc" }
    }));
  const fallbackTeam =
    team ??
    (await prisma.team.findFirst({
      orderBy: { createdAt: "asc" }
    }));

  if (!fallbackUser || !fallbackTeam) {
    throw new Error("Run the Prisma seed before using project APIs.");
  }

  return {
    userId: fallbackUser.id,
    teamId: fallbackTeam.id
  };
}

export async function ensureProjectInWorkspace(projectId: string, teamId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, teamId }
  });
}
