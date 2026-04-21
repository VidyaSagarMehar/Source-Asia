import IORedis from "ioredis";
import { Queue } from "bullmq";
import { env } from "@/lib/env";

type RetryJobData = {
  userId: string;
  payload: unknown;
};

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const requestQueue = new Queue<RetryJobData>(env.REQUEST_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: 1000,
    removeOnFail: 1000
  }
});

export const enqueueRetryRequest = async (
  userId: string,
  payload: unknown,
  delayMs: number
): Promise<void> => {
  await requestQueue.add(
    "retry-request",
    { userId, payload },
    {
      delay: Math.max(1000, delayMs)
    }
  );
};

export type { RetryJobData };
