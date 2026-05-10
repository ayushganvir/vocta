import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";

let prisma: PrismaClient;
let tempDir: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;
let scenesRoute: typeof import("./route");
let scenePanelsRoute: typeof import("./[sceneId]/panels/route");
let reorderRoute: typeof import("./[sceneId]/panels/reorder/route");
let panelRoute: typeof import("../panels/[panelId]/route");
let duplicateRoute: typeof import("../panels/[panelId]/duplicate/route");

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-scenes-api-test-"));
  const databaseUrl = `file:${join(tempDir, "test.db")}`;
  process.env.DATABASE_URL = databaseUrl;

  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: "debug" },
    stdio: "pipe"
  });

  prismaModule = await import("@prisma/client");
  repositories = await import("@/server/db/repositories");
  scenesRoute = await import("./route");
  scenePanelsRoute = await import("./[sceneId]/panels/route");
  reorderRoute = await import("./[sceneId]/panels/reorder/route");
  panelRoute = await import("../panels/[panelId]/route");
  duplicateRoute = await import("../panels/[panelId]/duplicate/route");

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

describe("scene and panel API routes", () => {
  it("creates, edits, duplicates, reorders, and deletes scene-scoped panels", async () => {
    const user = await prisma.user.create({
      data: { name: "Scenes User", email: "scenes@vocta.local" }
    });
    const team = await prisma.team.create({
      data: { name: "Scenes Team", slug: "scenes-team" }
    });
    const project = await repositories.createProject(prisma, {
      teamId: team.id,
      createdById: user.id,
      title: "Scenes API",
      slug: "scenes-api"
    });

    const sceneResponse = await scenesRoute.POST(
      jsonRequest("http://localhost/api/scenes", {
        projectId: project.id,
        title: "Opening",
        summary: "Scene summary"
      })
    );
    const sceneJson = (await sceneResponse.json()) as { scene: { id: string; orderIndex: number } };

    expect(sceneResponse.status).toBe(201);
    expect(sceneJson.scene.orderIndex).toBe(1);

    const panelAResponse = await scenePanelsRoute.POST(
      jsonRequest(`http://localhost/api/scenes/${sceneJson.scene.id}/panels`, {
        title: "Panel A",
        narrationText: "Narration A",
        visualIntent: "Visual A",
        promptFields: { imagePrompt: "Prompt A" }
      }),
      { params: Promise.resolve({ sceneId: sceneJson.scene.id }) }
    );
    const panelBResponse = await scenePanelsRoute.POST(
      jsonRequest(`http://localhost/api/scenes/${sceneJson.scene.id}/panels`, {
        title: "Panel B"
      }),
      { params: Promise.resolve({ sceneId: sceneJson.scene.id }) }
    );
    const panelAJson = (await panelAResponse.json()) as { panel: { id: string; orderIndex: number } };
    const panelBJson = (await panelBResponse.json()) as { panel: { id: string; orderIndex: number } };

    expect(panelAJson.panel.orderIndex).toBe(1);
    expect(panelBJson.panel.orderIndex).toBe(2);

    const patchResponse = await panelRoute.PATCH(
      jsonRequest(`http://localhost/api/panels/${panelAJson.panel.id}`, {
        title: "Panel A revised",
        narrationText: "Updated narration",
        panelReferenceAssetIds: ["ref-1"],
        promptFields: {
          imagePrompt: "Updated prompt",
          negativePrompt: "No blur"
        }
      }),
      { params: Promise.resolve({ panelId: panelAJson.panel.id }) }
    );
    const patchJson = (await patchResponse.json()) as {
      panel: { id: string; title: string; promptFields: { imagePrompt?: string } };
    };

    expect(patchJson.panel.id).toBe(panelAJson.panel.id);
    expect(patchJson.panel.title).toBe("Panel A revised");
    expect(patchJson.panel.promptFields.imagePrompt).toBe("Updated prompt");

    const duplicateResponse = await duplicateRoute.POST(
      new NextRequest(`http://localhost/api/panels/${panelAJson.panel.id}/duplicate`, {
        method: "POST"
      }),
      { params: Promise.resolve({ panelId: panelAJson.panel.id }) }
    );
    const duplicateJson = (await duplicateResponse.json()) as {
      panel: { id: string };
      panels: { id: string; orderIndex: number }[];
    };

    expect(duplicateResponse.status).toBe(201);
    expect(duplicateJson.panel.id).not.toBe(panelAJson.panel.id);
    expect(duplicateJson.panels.map((panel) => panel.id)).toEqual([
      panelAJson.panel.id,
      duplicateJson.panel.id,
      panelBJson.panel.id
    ]);

    const reorderResponse = await reorderRoute.POST(
      jsonRequest(`http://localhost/api/scenes/${sceneJson.scene.id}/panels/reorder`, {
        orderedPanelIds: [panelBJson.panel.id, panelAJson.panel.id, duplicateJson.panel.id]
      }),
      { params: Promise.resolve({ sceneId: sceneJson.scene.id }) }
    );
    const reorderJson = (await reorderResponse.json()) as {
      panels: { id: string; orderIndex: number }[];
    };

    expect(reorderJson.panels.map((panel) => panel.id)).toEqual([
      panelBJson.panel.id,
      panelAJson.panel.id,
      duplicateJson.panel.id
    ]);
    expect(reorderJson.panels.map((panel) => panel.orderIndex)).toEqual([1, 2, 3]);

    const deleteResponse = await panelRoute.DELETE(
      new NextRequest(`http://localhost/api/panels/${panelAJson.panel.id}`, {
        method: "DELETE"
      }),
      { params: Promise.resolve({ panelId: panelAJson.panel.id }) }
    );
    const deleteJson = (await deleteResponse.json()) as {
      deletedPanelId: string;
      panels: { id: string; orderIndex: number }[];
    };

    expect(deleteJson.deletedPanelId).toBe(panelAJson.panel.id);
    expect(deleteJson.panels.map((panel) => panel.id)).toEqual([
      panelBJson.panel.id,
      duplicateJson.panel.id
    ]);
    expect(deleteJson.panels.map((panel) => panel.orderIndex)).toEqual([1, 2]);

    const listResponse = await scenesRoute.GET(
      new NextRequest(`http://localhost/api/scenes?projectId=${project.id}`)
    );
    const listJson = (await listResponse.json()) as {
      scenes: { panels: { id: string }[] }[];
    };

    expect(listJson.scenes[0]?.panels.map((panel) => panel.id)).toEqual([
      panelBJson.panel.id,
      duplicateJson.panel.id
    ]);
  });
});

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
