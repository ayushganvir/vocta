import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";
import type * as Preflight from "./preflight";

let prisma: PrismaClient;
let tempDir: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;
let preflight: typeof Preflight;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-generation-preflight-test-"));
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
  preflight = await import("./preflight");

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

describe("generation preflight", () => {
  it("warns about missing mapped visual references and stale mapped entity ids without creating jobs", async () => {
    const fixture = await createPanelFixture("image-preflight");
    const visualEntity = await repositories.createEntity(prisma, {
      projectId: fixture.project.id,
      name: "Aarav",
      type: "character"
    });
    const speakerOnlyEntity = await repositories.createEntity(prisma, {
      projectId: fixture.project.id,
      name: "Narrator",
      type: "character",
      metadata: { speakerOnly: true }
    });
    await prisma.panel.update({
      where: { id: fixture.panel.id },
      data: { mappedEntityIds: [visualEntity.id, "deleted-entity", speakerOnlyEntity.id] }
    });

    const result = await preflight.runGenerationPreflight(prisma, {
      panelId: fixture.panel.id,
      assetType: "image"
    });

    expect(result).toMatchObject({ ok: true, canProceed: true });
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "MAPPED_ENTITY_MISSING_REFERENCE",
        targetId: visualEntity.id
      }),
      expect.objectContaining({
        code: "MAPPED_ENTITY_NOT_FOUND",
        targetId: "deleted-entity"
      })
    ]));
    expect(result.warnings).not.toContainEqual(expect.objectContaining({
      code: "MAPPED_ENTITY_MISSING_REFERENCE",
      targetId: speakerOnlyEntity.id
    }));
    await expectNoGenerationWrites(fixture.panel.id);
  });

  it("warns about video source asset gaps and provider capability verification without creating jobs", async () => {
    const fixture = await createPanelFixture("video-preflight");

    const imageToVideo = await preflight.runGenerationPreflight(prisma, {
      panelId: fixture.panel.id,
      assetType: "video",
      sourceMode: "image_to_video"
    });
    expect(imageToVideo.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "VIDEO_MISSING_SELECTED_IMAGE", targetId: fixture.panel.id }),
      expect.objectContaining({ code: "PROVIDER_CAPABILITY_UNVERIFIED", targetId: "xai" })
    ]));

    const firstLastFrame = await preflight.runGenerationPreflight(prisma, {
      panelId: fixture.panel.id,
      assetType: "video",
      sourceMode: "first_last_frame"
    });
    expect(firstLastFrame.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "VIDEO_MISSING_FIRST_LAST_FRAME", targetId: fixture.panel.id })
    ]));
    await expectNoGenerationWrites(fixture.panel.id);
  });

  it("warns about missing audio narration and unresolved voice ids without creating jobs", async () => {
    const fixture = await createPanelFixture("audio-preflight", { narrationText: null });
    const speaker = await repositories.createEntity(prisma, {
      projectId: fixture.project.id,
      name: "Speaker",
      type: "character",
      metadata: { speakerOnly: true }
    });
    await prisma.panel.update({
      where: { id: fixture.panel.id },
      data: {
        timelineMetadata: {
          audioSettings: { speakerEntityId: speaker.id }
        }
      }
    });

    const missingVoice = await preflight.runGenerationPreflight(prisma, {
      panelId: fixture.panel.id,
      assetType: "audio"
    });
    expect(missingVoice.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "AUDIO_MISSING_NARRATION", targetId: fixture.panel.id }),
      expect.objectContaining({ code: "AUDIO_MISSING_VOICE_ID", targetId: fixture.panel.id })
    ]));

    await prisma.entity.update({
      where: { id: speaker.id },
      data: { metadata: { speakerOnly: true, voiceId: "speaker-voice" } }
    });
    const resolvedVoice = await preflight.runGenerationPreflight(prisma, {
      panelId: fixture.panel.id,
      assetType: "audio"
    });
    expect(resolvedVoice.warnings).not.toContainEqual(expect.objectContaining({
      code: "AUDIO_MISSING_VOICE_ID"
    }));
    await expectNoGenerationWrites(fixture.panel.id);
  });
});

async function createPanelFixture(slug: string, panelData: { narrationText?: string | null } = {}) {
  const user = await prisma.user.create({
    data: { name: `Preflight ${slug}`, email: `${slug}@vocta.local` }
  });
  const team = await prisma.team.create({
    data: { name: `Preflight ${slug}`, slug }
  });
  const project = await repositories.createProject(prisma, {
    teamId: team.id,
    createdById: user.id,
    title: `Preflight ${slug}`,
    slug
  });
  const scene = await repositories.createScene(prisma, {
    projectId: project.id,
    orderIndex: 1,
    title: "Opening"
  });
  const panel = await repositories.createPanel(prisma, {
    projectId: project.id,
    sceneId: scene.id,
    title: "Panel",
    narrationText: panelData.narrationText === undefined ? "The panel has narration." : panelData.narrationText
  });

  return { user, team, project, scene, panel };
}

async function expectNoGenerationWrites(panelId: string) {
  await expect(prisma.generationJob.count({ where: { panelId } })).resolves.toBe(0);
  await expect(prisma.generatedAsset.count({ where: { panelId } })).resolves.toBe(0);
  await expect(prisma.promptCompilation.count({ where: { panelId } })).resolves.toBe(0);
}
