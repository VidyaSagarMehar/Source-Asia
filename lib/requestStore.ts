import { randomUUID } from "node:crypto";
import { redis } from "@/lib/redis";

const REQUESTS_TOTAL_PREFIX = "requests_total:";
const REQUEST_LOG_PREFIX = "request_log:";

export const incrementTotalRequests = async (userId: string): Promise<number> => {
  return redis.incr(`${REQUESTS_TOTAL_PREFIX}${userId}`);
};

export const getTotalRequests = async (userId: string): Promise<number> => {
  const value = await redis.get(`${REQUESTS_TOTAL_PREFIX}${userId}`);
  return value ? Number(value) : 0;
};

export const persistAcceptedRequest = async (userId: string, payload: unknown): Promise<string> => {
  const requestId = randomUUID();
  const key = `${REQUEST_LOG_PREFIX}${userId}`;

  const nowMs = Date.now();
  const serialized = JSON.stringify({ requestId, ts: nowMs, payload });

  await redis
    .multi()
    .rpush(key, serialized)
    .expire(key, 60 * 60 * 24)
    .exec();

  return requestId;
};
