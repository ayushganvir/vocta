import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "./repositories";

let prisma: PrismaClient;
let tempDir: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-db-test-"));
  const databaseUrl = `file:${join(tempDir, "test.db")}`;

  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: "debug" },
    stdio: "pipe"
  });

  prismaModule = await import("@prisma/client");
  repositories = await import("./repositories");

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

describe("database repositories", () => {
  it("creates a project workspace with required scenes and scene-scoped panels", async () => {
    const user = await prisma.user.create({
      data: { name: "Test User", email: "test@vocta.local" }
    });
    const team = await prisma.team.create({
      data: { name: "Test Team", slug: "test-team" }
    });

    const project = await repositories.createProject(prisma, {
      teamId: team.id,
      createdById: user.id,
      title: "Repository Test",
      slug: "repository-test"
    });

    expect(project.aspectRatio).toBe("9:16");
    expect(project.modelStack).toBeTruthy();
    expect(project.styleBible).toBeTruthy();

    const source = await repositories.addSourceMaterial(prisma, {
      projectId: project.id,
      createdById: user.id,
      type: prismaModule.SourceMaterialType.SCRIPT,
      title: "Opening script",
      bodyText: "A test script."
    });

    expect(source.type).toBe(prismaModule.SourceMaterialType.SCRIPT);

    const narrator = await repositories.createEntity(prisma, {
      projectId: project.id,
      name: "Narrator",
      type: "character",
      metadata: { speakerOnly: true }
    });

    expect(narrator.metadata).toMatchObject({ speakerOnly: true });

    const scene = await repositories.createScene(prisma, {
      projectId: project.id,
      orderIndex: 1,
      title: "Scene 1"
    });

    const panelA = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "Panel A"
    });
    const panelB = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "Panel B"
    });

    expect(panelA.orderIndex).toBe(1);
    expect(panelB.orderIndex).toBe(2);

    await repositories.reorderScenePanels(prisma, scene.id, [panelB.id, panelA.id]);
    const reorderedPanels = await repositories.listPanels(prisma, scene.id);

    expect(reorderedPanels.map((panel) => panel.id)).toEqual([panelB.id, panelA.id]);

    await repositories.addPromptLayer(prisma, {
      projectId: project.id,
      panelId: panelB.id,
      layerType: prismaModule.PromptLayerType.PANEL_CONTEXT,
      title: "Panel context",
      content: "Keep the beat clear.",
      sortOrder: 1,
      createdById: user.id
    });

    const workspace = await repositories.getProjectWorkspace(prisma, project.id);

    expect(workspace?.sourceMaterials).toHaveLength(1);
    expect(workspace?.entities).toHaveLength(1);
    expect(workspace?.scenes[0]?.panels.map((panel) => panel.id)).toEqual([
      panelB.id,
      panelA.id
    ]);
  });

  it("tracks generation jobs and selected panel assets", async () => {
    const user = await prisma.user.create({
      data: { name: "Asset User", email: "asset@vocta.local" }
    });
    const team = await prisma.team.create({
      data: { name: "Asset Team", slug: "asset-team" }
    });
    const project = await repositories.createProject(prisma, {
      teamId: team.id,
      createdById: user.id,
      title: "Asset Test",
      slug: "asset-test"
    });
    const scene = await repositories.createScene(prisma, {
      projectId: project.id,
      orderIndex: 1,
      title: "Asset Scene"
    });
    const panel = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "Asset Panel"
    });

    const job = await repositories.createGenerationJob(prisma, {
      projectId: project.id,
      panelId: panel.id,
      type: prismaModule.GenerationJobType.IMAGE,
      provider: "fake",
      model: "fake-image",
      createdById: user.id,
      compiledPrompt: "A test image prompt."
    });

    const running = await repositories.updateGenerationJobStatus(
      prisma,
      job.id,
      prismaModule.JobStatus.RUNNING
    );
    expect(running.startedAt).toBeInstanceOf(Date);

    const asset = await repositories.createGeneratedAsset(prisma, {
      projectId: project.id,
      panelId: panel.id,
      generationJobId: job.id,
      assetType: prismaModule.AssetType.IMAGE,
      fileUrl: "/generated/test.png",
      previewUrl: "/generated/test.png",
      storagePath: "generated/test.png",
      mimeType: "image/png",
      width: 1080,
      height: 1920
    });

    await repositories.selectPanelAsset(
      prisma,
      panel.id,
      asset.id,
      prismaModule.AssetType.IMAGE
    );

    const selectedPanel = await prisma.panel.findUniqueOrThrow({
      where: { id: panel.id }
    });
    const selectedAsset = await prisma.generatedAsset.findUniqueOrThrow({
      where: { id: asset.id }
    });

    expect(selectedPanel.selectedImageAssetId).toBe(asset.id);
    expect(selectedAsset.isSelected).toBe(true);

    const completed = await repositories.updateGenerationJobStatus(
      prisma,
      job.id,
      prismaModule.JobStatus.COMPLETED,
      {
        outputAssetIds: [asset.id]
      }
    );

    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.outputAssetIds).toEqual([asset.id]);

    const archived = await repositories.archiveProject(prisma, project.id);
    expect(archived.status).toBe("ARCHIVED");
  });
});
