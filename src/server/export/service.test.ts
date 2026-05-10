import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { ExportPackageStatus, SourceMaterialType } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";
import { generatePanelAudio, generatePanelImage, generatePanelVideo } from "@/server/generation/service";
import { LocalStorageDriver } from "@/server/storage/local";
import { createOrderedExportPackage, getExportReadiness } from "./service";

let prisma: PrismaClient;
let tempDir: string;
let storageRoot: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;
let storage: LocalStorageDriver;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-export-test-"));
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

describe("export service", () => {
  it("creates an ordered ZIP package with JSON and CSV manifests", async () => {
    const user = await prisma.user.create({
      data: { name: "Export User", email: "export@vocta.local" }
    });
    const team = await prisma.team.create({
      data: { name: "Export Team", slug: "export-team" }
    });
    const project = await repositories.createProject(prisma, {
      teamId: team.id,
      createdById: user.id,
      title: "Export Test",
      slug: "export-test"
    });

    await repositories.addSourceMaterial(prisma, {
      projectId: project.id,
      createdById: user.id,
      type: SourceMaterialType.SCRIPT,
      title: "Script",
      bodyText: "A concise export story."
    });
    const scene = await repositories.createScene(prisma, {
      projectId: project.id,
      orderIndex: 1,
      title: "Opening"
    });
    const panel = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "First panel",
      narrationText: "The signal begins.",
      visualIntent: "A vertical signal tower keyframe.",
      motionIntent: "Slow push toward the signal."
    });

    await generatePanelImage(prisma, { panelId: panel.id }, { storage });
    await generatePanelImage(prisma, { panelId: panel.id, frameRole: "first_frame" }, { storage });
    await generatePanelImage(prisma, { panelId: panel.id, frameRole: "last_frame" }, { storage });
    await generatePanelVideo(prisma, { panelId: panel.id, durationSeconds: 6 }, { storage });
    await generatePanelAudio(prisma, { panelId: panel.id, format: "wav", pace: "normal" }, { storage });

    const readinessBefore = await getExportReadiness(prisma, project.id);
    expect(readinessBefore).toMatchObject({
      totalPanels: 1,
      selectedImages: 1,
      selectedVideos: 1,
      selectedAudio: 1,
      selectedFirstFrames: 1,
      selectedLastFrames: 1
    });

    const result = await createOrderedExportPackage(prisma, {
      projectId: project.id,
      storage,
      now: () => new Date("2026-05-10T04:00:00.000Z")
    });

    expect(result.zipFileUrl).toContain("/api/storage/local/exports/");
    expect(result.manifest.export.rootFolder).toBe("export_test_export_202605100400");
    expect(result.manifest.panels).toHaveLength(1);
    expect(result.manifest.panels[0]).toMatchObject({
      index: 1,
      panelTitle: "First panel",
      selectedVideoPath: "001_panel_first_panel/video.mp4",
      selectedAudioPath: "001_panel_first_panel/audio.wav",
      selectedImagePath: "001_panel_first_panel/image.svg",
      firstFramePath: "001_panel_first_panel/first_frame.svg",
      lastFramePath: "001_panel_first_panel/last_frame.svg"
    });
    expect(result.csv).toContain("panel_title");
    expect(result.csv).toContain("First panel");

    const exportPackage = await prisma.exportPackage.findUniqueOrThrow({
      where: { id: result.exportPackageId }
    });
    expect(exportPackage.status).toBe(ExportPackageStatus.COMPLETED);
    expect(exportPackage.zipFileUrl).toBe(result.zipFileUrl);
    expect(exportPackage.manifestJsonAssetId).toBeTruthy();
    expect(exportPackage.manifestCsvAssetId).toBeTruthy();

    const timelineManifest = await prisma.timelineManifest.findFirstOrThrow({
      where: { exportPackageId: result.exportPackageId }
    });
    expect(timelineManifest.manifestCsv).toContain("First panel");

    const zipObject = await storage.getObject(
      decodeURIComponent(result.zipFileUrl.replace("/api/storage/local/", ""))
    );
    const zipHeader = Array.from(zipObject.bytes.slice(0, 4));
    expect(zipHeader).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });
});
