import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { AssetType, GenerationJobType, JobStatus, SourceMaterialType } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";
import { LocalStorageDriver } from "@/server/storage/local";
import type * as GenerationService from "./service";

let prisma: PrismaClient;
let tempDir: string;
let storageRoot: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;
let generation: typeof GenerationService;
let storage: LocalStorageDriver;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-generation-test-"));
  storageRoot = join(tempDir, "storage");
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
  generation = await import("./service");
  storage = new LocalStorageDriver(storageRoot);

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

describe("generation service", () => {
  it("creates traceable generated assets and selected panel outputs", async () => {
    const user = await prisma.user.create({
      data: { name: "Generation User", email: "generation@vocta.local" }
    });
    const team = await prisma.team.create({
      data: { name: "Generation Team", slug: "generation-team" }
    });
    const project = await repositories.createProject(prisma, {
      teamId: team.id,
      createdById: user.id,
      title: "Generation Test",
      slug: "generation-test",
      description: "A vertical short production."
    });

    await repositories.addSourceMaterial(prisma, {
      projectId: project.id,
      createdById: user.id,
      type: SourceMaterialType.SCRIPT,
      title: "Script",
      bodyText: "Aarav enters the Flooded Temple."
    });
    const scene = await repositories.createScene(prisma, {
      projectId: project.id,
      orderIndex: 1,
      title: "Opening",
      summary: "The protagonist enters the temple."
    });
    const panel = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "Temple entrance",
      narrationText: "Aarav steps into the flooded temple.",
      visualIntent: "A vertical shot of Aarav holding a lantern.",
      motionIntent: "Slow push-in through mist."
    });

    const image = await generation.generatePanelImage(prisma, { panelId: panel.id }, { storage });
    const firstFrame = await generation.generatePanelImage(
      prisma,
      { panelId: panel.id, frameRole: "first_frame" },
      { storage }
    );
    const lastFrame = await generation.generatePanelImage(
      prisma,
      { panelId: panel.id, frameRole: "last_frame" },
      { storage }
    );
    const video = await generation.generatePanelVideo(prisma, { panelId: panel.id, durationSeconds: 7 }, { storage });
    const audio = await generation.generatePanelAudio(
      prisma,
      { panelId: panel.id, pace: "slow", emotion: "tense", format: "mp3" },
      { storage }
    );

    expect(image.assetIds).toHaveLength(1);
    expect(firstFrame.assetIds).toHaveLength(1);
    expect(lastFrame.assetIds).toHaveLength(1);
    expect(video.assetIds).toHaveLength(1);
    expect(audio.assetIds).toHaveLength(1);

    const selectedPanel = await prisma.panel.findUniqueOrThrow({ where: { id: panel.id } });
    expect(selectedPanel.selectedImageAssetId).toBe(image.assetIds[0]);
    expect(selectedPanel.firstFrameAssetId).toBe(firstFrame.assetIds[0]);
    expect(selectedPanel.lastFrameAssetId).toBe(lastFrame.assetIds[0]);
    expect(selectedPanel.selectedVideoAssetId).toBe(video.assetIds[0]);
    expect(selectedPanel.selectedAudioAssetId).toBe(audio.assetIds[0]);

    const assets = await prisma.generatedAsset.findMany({
      where: { panelId: panel.id },
      orderBy: { createdAt: "asc" }
    });
    expect(assets.map((asset) => asset.assetType)).toEqual([
      AssetType.IMAGE,
      AssetType.IMAGE,
      AssetType.IMAGE,
      AssetType.VIDEO,
      AssetType.AUDIO
    ]);
    expect(assets[1]?.metadata).toMatchObject({ frameRole: "first_frame" });
    expect(assets[3]?.durationSeconds).toBe(7);
    expect(assets[4]?.mimeType).toBe("audio/mpeg");
    expect(assets.map((asset) => asset.isSelected)).toEqual([true, true, true, true, true]);
    await expect(storage.getObject(assets[0]!.storagePath)).resolves.toMatchObject({
      path: assets[0]!.storagePath
    });

    const jobs = await prisma.generationJob.findMany({
      where: { panelId: panel.id },
      orderBy: { createdAt: "asc" }
    });
    expect(jobs).toHaveLength(5);
    expect(jobs.map((job) => job.status)).toEqual(Array(5).fill(JobStatus.COMPLETED));
    expect(jobs.map((job) => job.type)).toEqual([
      GenerationJobType.IMAGE,
      GenerationJobType.IMAGE,
      GenerationJobType.IMAGE,
      GenerationJobType.VIDEO,
      GenerationJobType.AUDIO
    ]);
    expect(jobs.every((job) => Boolean(job.compiledPrompt))).toBe(true);
    expect(jobs.every((job) => Array.isArray(job.inputLayers))).toBe(true);
    expect(jobs.every((job) => Array.isArray(job.outputAssetIds))).toBe(true);
  });
});
