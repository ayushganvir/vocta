import { execFileSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import { SourceMaterialType } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";

let prisma: PrismaClient;
let tempDir: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;
let extractionRoute: typeof import("../entity-extraction/route");
let extractionApplyRoute: typeof import("../entity-extraction/apply/route");
let mappingRoute: typeof import("./route");
let mappingApplyRoute: typeof import("./apply/route");

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-entity-ai-api-test-"));
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
  extractionRoute = await import("../entity-extraction/route");
  extractionApplyRoute = await import("../entity-extraction/apply/route");
  mappingRoute = await import("./route");
  mappingApplyRoute = await import("./apply/route");

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

describe("entity extraction and mapping APIs", () => {
  it("returns drafts without auto-applying, then applies only through confirmation routes", async () => {
    const user = await prisma.user.create({
      data: { name: "Entity AI User", email: "entity-ai@vocta.local" }
    });
    const team = await prisma.team.create({
      data: { name: "Entity AI Team", slug: "entity-ai-team" }
    });
    const project = await repositories.createProject(prisma, {
      teamId: team.id,
      createdById: user.id,
      title: "Entity AI",
      slug: "entity-ai"
    });
    const source = await repositories.addSourceMaterial(prisma, {
      projectId: project.id,
      createdById: user.id,
      type: SourceMaterialType.SCRIPT,
      title: "Script",
      bodyText: "Aarav enters the Flooded Temple and raises a lantern."
    });
    const scene = await repositories.createScene(prisma, {
      projectId: project.id,
      orderIndex: 1,
      title: "Opening"
    });
    const panel = await repositories.createPanel(prisma, {
      projectId: project.id,
      sceneId: scene.id,
      title: "Temple",
      narrationText: "Aarav enters the Flooded Temple.",
      visualIntent: "Aarav holds the lantern near the temple gate."
    });

    const extractionResponse = await extractionRoute.POST(
      jsonRequest("http://localhost/api/entity-extraction", {
        projectId: project.id,
        sourceMaterialIds: [source.id]
      })
    );
    const extractionJson = (await extractionResponse.json()) as {
      draft: { generationJobId: string; draftEntities: Array<{ draftId: string; name: string }> };
    };

    expect(extractionResponse.status).toBe(200);
    expect(extractionJson.draft.draftEntities.length).toBeGreaterThan(0);
    await expect(prisma.entity.count({ where: { projectId: project.id } })).resolves.toBe(0);

    const applyExtractionResponse = await extractionApplyRoute.POST(
      jsonRequest("http://localhost/api/entity-extraction/apply", {
        projectId: project.id,
        sourceGenerationJobId: extractionJson.draft.generationJobId,
        draftEntities: extractionJson.draft.draftEntities.slice(0, 2)
      })
    );

    expect(applyExtractionResponse.status).toBe(200);
    await expect(prisma.entity.count({ where: { projectId: project.id } })).resolves.toBe(2);

    const mappingResponse = await mappingRoute.POST(
      jsonRequest("http://localhost/api/entity-mapping", {
        projectId: project.id,
        panelIds: [panel.id]
      })
    );
    const mappingJson = (await mappingResponse.json()) as {
      draft: { mappings: Array<{ panelId: string; suggestedEntityIds: string[] }> };
    };
    const panelBeforeApply = await prisma.panel.findUniqueOrThrow({ where: { id: panel.id } });

    expect(mappingResponse.status).toBe(200);
    expect(mappingJson.draft.mappings[0]?.suggestedEntityIds.length).toBeGreaterThan(0);
    expect(panelBeforeApply.mappedEntityIds).toEqual([]);

    const applyMappingResponse = await mappingApplyRoute.POST(
      jsonRequest("http://localhost/api/entity-mapping/apply", {
        projectId: project.id,
        mappings: mappingJson.draft.mappings
      })
    );
    const panelAfterApply = await prisma.panel.findUniqueOrThrow({ where: { id: panel.id } });

    expect(applyMappingResponse.status).toBe(200);
    expect(panelAfterApply.mappedEntityIds).toEqual(mappingJson.draft.mappings[0]?.suggestedEntityIds);
  });
});

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}
