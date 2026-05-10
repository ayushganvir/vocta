import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";

import {
  clearPanelStaleState,
  markMappedEntityPanelsStale,
  markPanelPatchStale,
  markPanelsStale,
  staleWarnings
} from "./service";

let prisma: PrismaClient;
let tempDir: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-stale-test-"));
  const databasePath = join(tempDir, "test.db");
  closeSync(openSync(databasePath, "w"));
  const databaseUrl = `file:${databasePath}`;
  process.env.DATABASE_URL = databaseUrl;

  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe"
  });

  prismaModule = await import("@prisma/client");
  repositories = await import("@/server/db/repositories");

  prisma = new prismaModule.PrismaClient({
    datasources: {
      db: { url: databaseUrl }
    }
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("stale state service", () => {
  it("marks dependent panels stale without creating generation jobs", async () => {
    const user = await prisma.user.create({
      data: { name: "Stale User", email: "stale@vocta.local" }
    });
    const team = await prisma.team.create({
      data: { name: "Stale Team", slug: "stale-team" }
    });
    const project = await repositories.createProject(prisma, {
      teamId: team.id,
      createdById: user.id,
      title: "Stale Test",
      slug: "stale-test"
    });
    const entity = await repositories.createEntity(prisma, {
      projectId: project.id,
      name: "Aarav",
      type: "character",
      visualPromptBlock: "consistent protagonist"
    });
    const scene = await repositories.createScene(prisma, {
      projectId: project.id,
      orderIndex: 1,
      title: "Opening"
    });
    const panelA = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "Panel A",
      narrationText: "Old narration",
      visualIntent: "Old visual"
    });
    const panelB = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "Panel B"
    });
    await prisma.panel.update({
      where: { id: panelA.id },
      data: {
        mappedEntityIds: [entity.id],
        panelReferenceAssetIds: ["ref-a"],
        timelineMetadata: {
          promptFields: {
            imagePrompt: "Old prompt"
          }
        }
      }
    });

    await markPanelsStale(prisma, {
      projectId: project.id,
      reason: "styleBibleChanged"
    });
    await markMappedEntityPanelsStale(prisma, project.id, entity.id, "entityChanged");

    const currentPanelA = await prisma.panel.findUniqueOrThrow({ where: { id: panelA.id } });
    await markPanelPatchStale(prisma, currentPanelA, {
      narrationText: "New narration",
      visualIntent: "New visual",
      promptFields: { imagePrompt: "New prompt" },
      panelReferenceAssetIds: ["ref-b"]
    });

    const [updatedA, updatedB, generationJobCount] = await Promise.all([
      prisma.panel.findUniqueOrThrow({ where: { id: panelA.id } }),
      prisma.panel.findUniqueOrThrow({ where: { id: panelB.id } }),
      prisma.generationJob.count({ where: { projectId: project.id } })
    ]);

    expect(staleWarnings(updatedA.staleState)).toEqual(
      expect.arrayContaining([
        "Style Bible changed after downstream panel work.",
        "Mapped entity changed after downstream panel work.",
        "Panel narration changed after generated audio/video work.",
        "Panel visual intent changed after generated image/video work.",
        "Panel prompt fields changed after generated work.",
        "Panel references changed after generated image/video work."
      ])
    );
    expect(staleWarnings(updatedB.staleState)).toContain("Style Bible changed after downstream panel work.");
    expect(staleWarnings(updatedB.staleState)).not.toContain("Mapped entity changed after downstream panel work.");
    expect(generationJobCount).toBe(0);

    await clearPanelStaleState(prisma, panelA.id);
    const clearedA = await prisma.panel.findUniqueOrThrow({ where: { id: panelA.id } });
    expect(staleWarnings(clearedA.staleState)).toEqual([]);
  });
});
