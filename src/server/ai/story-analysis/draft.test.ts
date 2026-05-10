import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";
import type * as DraftService from "./draft";
import type * as ApplyService from "./apply";

let prisma: PrismaClient;
let tempDir: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;
let draftService: typeof DraftService;
let applyService: typeof ApplyService;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-story-analysis-test-"));
  const databaseUrl = `file:${join(tempDir, "test.db")}`;

  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: "debug" },
    stdio: "pipe"
  });

  process.env.DATABASE_URL = databaseUrl;
  prismaModule = await import("@prisma/client");
  repositories = await import("@/server/db/repositories");
  draftService = await import("./draft");
  applyService = await import("./apply");

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

describe("story analysis draft flow", () => {
  it("stores a structured fake draft without mutating creative state", async () => {
    const { project, user, source } = await createStoryProject("story-draft-shape");

    const before = await countCreativeState(project.id);
    const job = await draftService.analyzeStoryDraft(prisma, {
      projectId: project.id,
      sourceMaterialIds: [source.id],
      requestedByUserId: user.id
    });
    const after = await countCreativeState(project.id);

    expect(after).toEqual(before);
    expect(job.status).toBe(prismaModule.JobStatus.COMPLETED);
    expect(job.draft).toMatchObject({
      version: 1,
      provider: "fake",
      sourceMaterialIds: [source.id],
      storySummary: expect.any(String)
    });
    expect(job.draft.entitySuggestions.length).toBeGreaterThan(0);
    expect(job.draft.styleSuggestions.visualStyle).toEqual(expect.any(String));
    expect(job.draft.scenes.length).toBeGreaterThan(0);
    expect(job.draft.scenes[0]?.panels.length).toBeGreaterThan(0);
  });

  it("applies selected draft sections only after explicit apply", async () => {
    const { project, user, source } = await createStoryProject("story-draft-apply");
    const job = await draftService.analyzeStoryDraft(prisma, {
      projectId: project.id,
      sourceMaterialIds: [source.id],
      requestedByUserId: user.id
    });

    expect(await countCreativeState(project.id)).toEqual({
      entities: 0,
      scenes: 0,
      panels: 0,
      hasStyleVisual: false
    });

    await applyService.applyStoryAnalysisDraft(prisma, {
      projectId: project.id,
      jobId: job.id,
      apply: {
        section: "entities",
        entityIds: [job.draft.entitySuggestions[0]!.id]
      }
    });
    expect(await prisma.entity.count({ where: { projectId: project.id } })).toBe(1);
    expect(await prisma.scene.count({ where: { projectId: project.id } })).toBe(0);

    await applyService.applyStoryAnalysisDraft(prisma, {
      projectId: project.id,
      jobId: job.id,
      apply: { section: "style", fields: ["visualStyle"] }
    });
    const styleBible = await prisma.styleBible.findUniqueOrThrow({ where: { projectId: project.id } });
    expect(styleBible.visualStyle).toEqual(job.draft.styleSuggestions.visualStyle);
    expect(styleBible.cameraStyle).toBeNull();

    await applyService.applyStoryAnalysisDraft(prisma, {
      projectId: project.id,
      jobId: job.id,
      apply: {
        section: "scenes",
        sceneIds: [job.draft.scenes[0]!.id]
      }
    });
    expect(await prisma.scene.count({ where: { projectId: project.id } })).toBe(1);
    expect(await prisma.panel.count({ where: { projectId: project.id } })).toBe(job.draft.scenes[0]!.panels.length);
  });
});

async function createStoryProject(slug: string) {
  const user = await prisma.user.create({
    data: { name: slug, email: `${slug}@vocta.local` }
  });
  const team = await prisma.team.create({
    data: { name: slug, slug }
  });
  const project = await repositories.createProject(prisma, {
    teamId: team.id,
    createdById: user.id,
    title: slug,
    slug
  });
  const source = await repositories.addSourceMaterial(prisma, {
    projectId: project.id,
    createdById: user.id,
    type: prismaModule.SourceMaterialType.SCRIPT,
    title: "Opening Script",
    bodyText: "A hero enters a flooded temple, finds a lost map, and chooses to save the village before sunrise."
  });

  return { project, user, source };
}

async function countCreativeState(projectId: string) {
  const [entities, scenes, panels, styleBible] = await Promise.all([
    prisma.entity.count({ where: { projectId } }),
    prisma.scene.count({ where: { projectId } }),
    prisma.panel.count({ where: { projectId } }),
    prisma.styleBible.findUnique({ where: { projectId } })
  ]);

  return {
    entities,
    scenes,
    panels,
    hasStyleVisual: Boolean(styleBible?.visualStyle)
  };
}
