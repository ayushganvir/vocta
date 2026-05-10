import type { Job } from "bullmq";
import type { VoctaQueueMap } from "./queues";
import { enqueueGenerationJob } from "./queues";
import type { JobPayload, JobResult, JobStatus, JobType } from "./types";

export interface GenerationJobSnapshot<TJobType extends JobType = JobType> {
  id: string;
  jobType: TJobType;
  status: JobStatus;
  progress: unknown;
  payload: JobPayload<TJobType>;
  result?: JobResult<TJobType>;
  failedReason?: string;
  attemptsMade: number;
  createdAt?: number;
  processedAt?: number;
  finishedAt?: number;
}

function mapBullStatus(status: string): JobStatus {
  if (status === "waiting" || status === "delayed" || status === "prioritized" || status === "waiting-children") {
    return "queued";
  }

  if (status === "active") {
    return "active";
  }

  if (status === "completed") {
    return "completed";
  }

  if (status === "failed") {
    return "failed";
  }

  return "cancelled";
}

export async function createGenerationJob<TJobType extends JobType>(
  queues: VoctaQueueMap,
  payload: JobPayload<TJobType>
) {
  return enqueueGenerationJob(queues, payload);
}

export async function snapshotGenerationJob<TJobType extends JobType>(
  job: Job<JobPayload<TJobType>, JobResult<TJobType>, TJobType>
): Promise<GenerationJobSnapshot<TJobType>> {
  const status = await job.getState();

  return {
    id: job.id ?? "",
    jobType: job.name,
    status: mapBullStatus(status),
    progress: job.progress,
    payload: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
    createdAt: job.timestamp,
    processedAt: job.processedOn,
    finishedAt: job.finishedOn
  };
}
