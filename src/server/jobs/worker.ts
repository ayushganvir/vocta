import { Worker, type Job } from "bullmq";
import { createFakeProviderForJob, runProvider } from "../providers/fake";
import { getQueueConcurrency, queueNames, type QueueKey } from "./config";
import { getRedisConnection } from "./queues";
import type { JobPayload, JobResult, JobType } from "./types";

const connection = getRedisConnection();
const concurrency = getQueueConcurrency();

async function processJob(job: Job<JobPayload, JobResult, JobType>): Promise<JobResult> {
  const provider = createFakeProviderForJob(job.data.jobType);
  return runProvider(provider, job.data);
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
