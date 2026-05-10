import { PrismaClient } from "@prisma/client";

import { readEnv } from "@/lib/env";

import type { StyleBibleRecord } from "./schema";

export function createStyleBiblePrismaClient() {
  return new PrismaClient({
    datasources: {
      db: { url: readEnv().DATABASE_URL }
    }
  });
}

const prisma = createStyleBiblePrismaClient();

function serializeStyleBible(
  styleBible: Awaited<ReturnType<typeof prisma.styleBible.findUnique>>
): StyleBibleRecord | null {
  if (!styleBible) {
    return null;
  }

  return {
    id: styleBible.id,
    projectId: styleBible.projectId,
    charactersText: styleBible.charactersText,
    placesText: styleBible.placesText,
    objectsText: styleBible.objectsText,
    visualStyle: styleBible.visualStyle,
    colorPalette: styleBible.colorPalette,
    lightingStyle: styleBible.lightingStyle,
    cameraStyle: styleBible.cameraStyle,
    updatedAt: styleBible.updatedAt.toISOString()
  };
}

export async function getStyleBiblePageData() {
  const project = await prisma.project.findFirst({
    orderBy: { updatedAt: "desc" },
    include: { styleBible: true }
  });

  if (!project) {
    return { project: null, styleBible: null };
  }

  return {
    project: {
      id: project.id,
      title: project.title
    },
    styleBible: serializeStyleBible(project.styleBible)
  };
}

export { serializeStyleBible };
