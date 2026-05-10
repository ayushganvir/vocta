import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AssetType, GenerationJobType, JobStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@prisma/client";
import type * as PrismaClientModule from "@prisma/client";
import type * as Repositories from "@/server/db/repositories";
import type * as JobsQuery from "@/server/jobs/query";

let prisma: PrismaClient;
let tempDir: string;
let prismaModule: typeof PrismaClientModule;
let repositories: typeof Repositories;
let jobsRoute: typeof import("./route");
let jobRoute: typeof import("./[jobId]/route");
let retryRoute: typeof import("./[jobId]/retry/route");
let cancelRoute: typeof import("./[jobId]/cancel/route");
let jobsQuery: typeof JobsQuery;

beforeAll(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "vocta-jobs-api-test-"));
  const databaseUrl = `file:${join(tempDir, "test.db")}`;
  process.env.DATABASE_URL = databaseUrl;

  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: "debug" },
    stdio: "pipe"
  });

  prismaModule = await import("@prisma/client");
  repositories = await import("@/server/db/repositories");
  jobsRoute = await import("./route");
  jobRoute = await import("./[jobId]/route");
  retryRoute = await import("./[jobId]/retry/route");
  cancelRoute = await import("./[jobId]/cancel/route");
  jobsQuery = await import("@/server/jobs/query");

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

describe("jobs API routes", () => {
  it("lists and filters database-backed jobs with target and trace summaries", async () => {
    const fixture = await createJobFixture();

    const listResponse = await jobsRoute.GET(
      new NextRequest(`http://localhost/api/jobs?projectId=${fixture.project.id}&status=FAILED&type=AUDIO`)
    );
    const listJson = (await listResponse.json()) as {
      jobs: Array<{
        id: string;
        status: string;
        type: string;
        target: { label: string; sceneTitle: string; panelTitle: string };
        outputAssetCount: number;
        errorMessage: string | null;
        canRetry: boolean;
        canCancel: boolean;
      }>;
    };

    expect(listResponse.status).toBe(200);
    expect(listJson.jobs).toHaveLength(1);
    expect(listJson.jobs[0]?.id).toBe(fixture.failedJob.id);
    expect(listJson.jobs[0]?.target.label).toContain("S1.P1");
    expect(listJson.jobs[0]?.target.sceneTitle).toBe("Jobs Scene");
    expect(listJson.jobs[0]?.target.panelTitle).toBe("Jobs Panel");
    expect(listJson.jobs[0]?.errorMessage).toBe("Voice provider failed.");
    expect(listJson.jobs[0]?.canRetry).toBe(true);
    expect(listJson.jobs[0]?.canCancel).toBe(false);

    const completedListResponse = await jobsRoute.GET(
      new NextRequest(`http://localhost/api/jobs?projectId=${fixture.project.id}&status=COMPLETED`)
    );
    const completedListJson = (await completedListResponse.json()) as {
      jobs: Array<{ id: string; outputAssetCount: number }>;
    };

    expect(completedListJson.jobs[0]?.id).toBe(fixture.completedJob.id);
    expect(completedListJson.jobs[0]?.outputAssetCount).toBe(1);
  });

  it("returns detail debug fields for one job", async () => {
    const fixture = await createJobFixture("detail");

    const detailResponse = await jobRoute.GET(
      new NextRequest(`http://localhost/api/jobs/${fixture.failedJob.id}`),
      { params: Promise.resolve({ jobId: fixture.failedJob.id }) }
    );
    const detailJson = (await detailResponse.json()) as {
      job: {
        id: string;
        compiledPrompt: string;
        inputLayers: unknown;
        attachedReferenceAssetIds: unknown;
        requestPayload: { prompt: string };
        responsePayloadSummary: unknown;
        logs: unknown;
        errorPayload: { message: string };
        generatedAssets: unknown[];
      };
    };

    expect(detailResponse.status).toBe(200);
    expect(detailJson.job.id).toBe(fixture.failedJob.id);
    expect(detailJson.job.compiledPrompt).toBe("Narrate the panel.");
    expect(detailJson.job.requestPayload.prompt).toBe("Narrate the panel.");
    expect(detailJson.job.errorPayload.message).toBe("Voice provider failed.");
    expect(Array.isArray(detailJson.job.generatedAssets)).toBe(true);
  });

  it("creates a new queued retry job without mutating the failed source job", async () => {
    const fixture = await createJobFixture("retry");

    const retryResponse = await retryRoute.POST(
      new NextRequest(`http://localhost/api/jobs/${fixture.failedJob.id}/retry`, {
        method: "POST"
      }),
      { params: Promise.resolve({ jobId: fixture.failedJob.id }) }
    );
    const retryJson = (await retryResponse.json()) as {
      job: {
        id: string;
        status: string;
        retryOfGenerationJobId: string;
        requestPayload: { manualRetryOfJobId: string };
      };
    };
    const source = await prisma.generationJob.findUniqueOrThrow({
      where: { id: fixture.failedJob.id }
    });

    expect(retryResponse.status).toBe(201);
    expect(retryJson.job.id).not.toBe(fixture.failedJob.id);
    expect(retryJson.job.status).toBe(JobStatus.QUEUED);
    expect(retryJson.job.retryOfGenerationJobId).toBe(fixture.failedJob.id);
    expect(retryJson.job.requestPayload.manualRetryOfJobId).toBe(fixture.failedJob.id);
    expect(source.status).toBe(JobStatus.FAILED);
  });

  it("re-enqueues executable retry payloads with the new retry job id", async () => {
    const fixture = await createJobFixture("retry-enqueue");
    const failedExecutableJob = await prisma.generationJob.create({
      data: {
        projectId: fixture.project.id,
        panelId: fixture.panel.id,
        type: GenerationJobType.AUDIO,
        provider: "fake-audio",
        model: "fake-audio-v1",
        status: JobStatus.FAILED,
        compiledPrompt: "Narrate again.",
        requestPayload: {
          jobType: "audio",
          projectId: fixture.project.id,
          panelId: fixture.panel.id,
          generationJobId: "old-job-id",
          requestedAt: "2026-01-01T00:00:00.000Z",
          narration: "Narrate again.",
          format: "wav"
        },
        errorPayload: { message: "Voice provider failed." }
      }
    });
    const enqueued: Array<{ name: string; payload: Record<string, unknown>; options: Record<string, unknown> }> = [];
    const queues = {
      prompt: { add: async () => ({ id: "unused" }) },
      image: { add: async () => ({ id: "unused" }) },
      video: { add: async () => ({ id: "unused" }) },
      audio: {
        add: async (name: string, payload: Record<string, unknown>, options: Record<string, unknown>) => {
          enqueued.push({ name, payload, options });
          return { id: String(options.jobId) };
        }
      },
      export: { add: async () => ({ id: "unused" }) }
    };

    const retry = await jobsQuery.retryGenerationJob(prisma, failedExecutableJob.id, { queues: queues as never });

    expect(retry).not.toBeNull();
    if (!retry) throw new Error("Retry job was not created.");
    expect(retry.status).toBe(JobStatus.QUEUED);
    expect(retry.retryOfGenerationJobId).toBe(failedExecutableJob.id);
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0]?.name).toBe("audio");
    expect(enqueued[0]?.options.jobId).toBe(retry.id);
    expect(enqueued[0]?.payload.generationJobId).toBe(retry.id);
    expect(enqueued[0]?.payload.manualRetryOfJobId).toBe(failedExecutableJob.id);
  });

  it("cancels only queued or running jobs", async () => {
    const fixture = await createJobFixture("cancel");

    const cancelResponse = await cancelRoute.POST(
      new NextRequest(`http://localhost/api/jobs/${fixture.runningJob.id}/cancel`, {
        method: "POST"
      }),
      { params: Promise.resolve({ jobId: fixture.runningJob.id }) }
    );
    const cancelJson = (await cancelResponse.json()) as {
      job: { id: string; status: string; canCancel: boolean; logs: unknown[] };
    };

    expect(cancelResponse.status).toBe(200);
    expect(cancelJson.job.status).toBe(JobStatus.CANCELLED);
    expect(cancelJson.job.canCancel).toBe(false);
    expect(cancelJson.job.logs.length).toBeGreaterThan(0);

    const completedCancelResponse = await cancelRoute.POST(
      new NextRequest(`http://localhost/api/jobs/${fixture.completedJob.id}/cancel`, {
        method: "POST"
      }),
      { params: Promise.resolve({ jobId: fixture.completedJob.id }) }
    );
    const completedCancelJson = (await completedCancelResponse.json()) as { error: string };

    expect(completedCancelResponse.status).toBe(400);
    expect(completedCancelJson.error).toContain("Only queued or running jobs");
  });
});

async function createJobFixture(suffix = "base") {
  const user = await prisma.user.create({
    data: { name: `Jobs User ${suffix}`, email: `jobs-${suffix}@vocta.local` }
  });
  const team = await prisma.team.create({
    data: { name: `Jobs Team ${suffix}`, slug: `jobs-team-${suffix}` }
  });
  const project = await repositories.createProject(prisma, {
    teamId: team.id,
    createdById: user.id,
    title: `Jobs Project ${suffix}`,
    slug: `jobs-project-${suffix}`
  });
  const scene = await repositories.createScene(prisma, {
    projectId: project.id,
    orderIndex: 1,
    title: "Jobs Scene"
  });
  const panel = await repositories.createPanel(prisma, {
    projectId: project.id,
    sceneId: scene.id,
    title: "Jobs Panel"
  });

  const completedJob = await prisma.generationJob.create({
    data: {
      projectId: project.id,
      panelId: panel.id,
      type: GenerationJobType.IMAGE,
      provider: "fake-image",
      model: "fake-image-v1",
      status: JobStatus.COMPLETED,
      compiledPrompt: "Generate image.",
      requestPayload: { prompt: "Generate image." },
      responsePayloadSummary: { summary: "Created image." },
      outputAssetIds: [],
      logs: [{ level: "info", message: "done" }],
      createdById: user.id,
      completedAt: new Date()
    }
  });
  const asset = await prisma.generatedAsset.create({
    data: {
      projectId: project.id,
      panelId: panel.id,
      generationJobId: completedJob.id,
      assetType: AssetType.IMAGE,
      fileUrl: "/api/storage/local/generated/jobs.png",
      previewUrl: "/api/storage/local/generated/jobs.png",
      storagePath: "generated/jobs.png",
      mimeType: "image/png"
    }
  });
  await prisma.generationJob.update({
    where: { id: completedJob.id },
    data: { outputAssetIds: [asset.id] }
  });

  const failedJob = await prisma.generationJob.create({
    data: {
      projectId: project.id,
      panelId: panel.id,
      type: GenerationJobType.AUDIO,
      provider: "fake-audio",
      model: "fake-audio-v1",
      status: JobStatus.FAILED,
      compiledPrompt: "Narrate the panel.",
      inputLayers: [{ title: "Panel context", content: "Narration." }],
      attachedReferenceAssetIds: ["ref-1"],
      requestPayload: { prompt: "Narrate the panel." },
      responsePayloadSummary: { summary: "Failed." },
      logs: [{ level: "error", message: "provider failed" }],
      errorPayload: { message: "Voice provider failed." },
      createdById: user.id,
      completedAt: new Date()
    }
  });

  const runningJob = await prisma.generationJob.create({
    data: {
      projectId: project.id,
      panelId: panel.id,
      type: GenerationJobType.VIDEO,
      provider: "fake-video",
      model: "fake-video-v1",
      status: JobStatus.RUNNING,
      compiledPrompt: "Animate panel.",
      requestPayload: { prompt: "Animate panel." },
      logs: [],
      createdById: user.id,
      startedAt: new Date()
    }
  });

  return { user, team, project, scene, panel, completedJob, failedJob, runningJob };
}
