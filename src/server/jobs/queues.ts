import { Queue } from "bullmq";
import IORedis from "ioredis";
import { readEnv } from "@/lib/env";
import { queueNames } from "./config";

let connection: IORedis | undefined;

export function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(readEnv().REDIS_URL, {
      maxRetriesPerRequest: null
    });
  }

  return connection;
}

export function createQueues() {
  const redis = getRedisConnection();

  return {
    prompt: new Queue(queueNames.prompt, { connection: redis }),
    image: new Queue(queueNames.image, { connection: redis }),
    video: new Queue(queueNames.video, { connection: redis }),
    audio: new Queue(queueNames.audio, { connection: redis }),
    export: new Queue(queueNames.export, { connection: redis })
  };
}

