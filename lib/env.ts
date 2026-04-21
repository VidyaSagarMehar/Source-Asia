import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  ENABLE_RETRY_QUEUE: z.coerce.boolean().default(true),
  REQUEST_QUEUE_NAME: z.string().min(1).default("rate-limit-retry"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info")
});

export const env = envSchema.parse({
  REDIS_URL: process.env.REDIS_URL,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS: process.env.RATE_LIMIT_WINDOW_SECONDS,
  ENABLE_RETRY_QUEUE: process.env.ENABLE_RETRY_QUEUE,
  REQUEST_QUEUE_NAME: process.env.REQUEST_QUEUE_NAME,
  LOG_LEVEL: process.env.LOG_LEVEL
});
