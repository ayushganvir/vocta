import { Worker, type Job } from "bullmq";
import nextEnv from "@next/env";
import { getQueueConcurrency, queueNames, type QueueKey } from "./config";
import { getRedisConnection } from "./queues";
import type { JobPayload, JobResult, JobType } from "./types";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const connection = getRedisConnection();
const concurrency = getQueueConcurrency();

async function processJob(job: Job<JobPayload, JobResult, JobType>): Promise<JobResult> {
  const { prisma } = await import("@/server/db");

  if (job.data.jobType === "image" || job.data.jobType === "video" || job.data.jobType === "audio") {
    const { executeQueuedGenerationJob } = await import("@/server/generation/service");
    return executeQueuedGenerationJob(prisma, job.data) as Promise<JobResult>;
  }

  if (job.data.jobType === "export") {
    const { executeOrderedExportPackage } = await import("@/server/export/service");
    return executeOrderedExportPackage(prisma, job.data) as Promise<JobResult>;
  }

  throw new Error(`Worker execution is not implemented for job type ${job.data.jobType}.`);
}

function createWorker(queueKey: QueueKey) {
  return new Worker<JobPayload, JobResult, JobType>(queueNames[queueKey], processJob, {
    connection,
    concurrency: concurrency[queueKey]
  });
}

const workers = (Object.keys(queueNames) as QueueKey[]).map(createWorker);

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    console.error("Worker job failed", { queueName: worker.name, jobId: job?.id, error });
  });
}

console.log("Vocta workers started", workers.map((worker) => worker.name));
