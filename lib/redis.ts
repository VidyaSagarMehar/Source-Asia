import Redis from "ioredis";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

declare global {
  // eslint-disable-next-line no-var
  var __redisClient: Redis | undefined;
}

const createRedisClient = () =>
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false
  });

export const redis = global.__redisClient ?? createRedisClient();

if (!global.__redisClient) {
  global.__redisClient = redis;
}

redis.on("error", (error) => {
  logger.error({ error }, "Redis connection error");
});
