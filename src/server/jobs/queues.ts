import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { readEnv } from "@/lib/env";
import { getQueueKeyForJobType, queueNames, type QueueKey } from "./config";
import type { JobPayload, JobResult, JobType } from "./types";

let connection: IORedis | undefined;

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(readEnv().REDIS_URL, {
      maxRetriesPerRequest: null
    });
  }

  return connection;
}

export type VoctaQueue = Queue<JobPayload, JobResult, JobType>;
export type VoctaQueueMap = Record<QueueKey, VoctaQueue>;

const defaultJobOptions = {
  attempts: 1,
  removeOnComplete: false,
  removeOnFail: false
} as const satisfies JobsOptions;

export function createQueue(queueKey: QueueKey, redis = getRedisConnection()): VoctaQueue {
  return new Queue<JobPayload, JobResult, JobType>(queueNames[queueKey], {
    connection: redis,
    defaultJobOptions
  });
}

export function createQueues(): VoctaQueueMap {
  const redis = getRedisConnection();

  return {
    prompt: createQueue("prompt", redis),
    image: createQueue("image", redis),
    video: createQueue("video", redis),
    audio: createQueue("audio", redis),
    export: createQueue("export", redis)
  };
}

export async function enqueueGenerationJob<TJobType extends JobType>(
  queues: VoctaQueueMap,
  payload: JobPayload<TJobType>,
  options: JobsOptions = {}
) {
  const queueKey = getQueueKeyForJobType(payload.jobType);
  const stableJobId =
    options.jobId ??
    payload.generationJobId ??
    (payload.jobType === "export" ? payload.exportPackageId : undefined);

  return queues[queueKey].add(payload.jobType, payload, {
    ...defaultJobOptions,
    ...options,
    jobId: stableJobId,
    attempts: options.attempts ?? defaultJobOptions.attempts
  });
}
