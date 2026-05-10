import { Worker } from "bullmq";
import { defaultConcurrency, queueNames } from "./config";
import { getRedisConnection } from "./queues";

const connection = getRedisConnection();

const workers = [
  new Worker(queueNames.prompt, async (job) => job.data, {
    connection,
    concurrency: defaultConcurrency.prompt
  }),
  new Worker(queueNames.image, async (job) => job.data, {
    connection,
    concurrency: defaultConcurrency.image
  }),
  new Worker(queueNames.video, async (job) => job.data, {
    connection,
    concurrency: defaultConcurrency.video
  }),
  new Worker(queueNames.audio, async (job) => job.data, {
    connection,
    concurrency: defaultConcurrency.audio
  }),
  new Worker(queueNames.export, async (job) => job.data, {
    connection,
    concurrency: defaultConcurrency.export
  })
];

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    console.error("Worker job failed", { queueName: worker.name, jobId: job?.id, error });
  });
}

console.log("Vocta workers started", workers.map((worker) => worker.name));

