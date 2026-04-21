import IORedis from "ioredis";
import { Worker } from "bullmq";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkAndConsumeSlidingWindow, trackUser } from "@/lib/rateLimiter";
import { incrementTotalRequests, persistAcceptedRequest } from "@/lib/requestStore";
import type { RetryJobData } from "@/lib/queue";

const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const worker = new Worker<RetryJobData>(
  env.REQUEST_QUEUE_NAME,
  async (job) => {
    const { userId, payload } = job.data;
    const rateResult = await checkAndConsumeSlidingWindow(userId);

    if (!rateResult.allowed) {
      const delay = Math.max(1000, rateResult.resetTimeMs - Date.now());
      await job.moveToDelayed(Date.now() + delay);
      logger.warn({ userId, delay }, "Rate-limited job delayed");
      return;
    }

    await trackUser(userId);
    await incrementTotalRequests(userId);
    const requestId = await persistAcceptedRequest(userId, payload);
    logger.info({ userId, requestId, jobId: job.id }, "Queued request processed");
  },
  { connection, concurrency: 20 }
);

worker.on("ready", () => {
  logger.info("Rate-limit retry worker is ready");
});

worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "Worker job failed");
});