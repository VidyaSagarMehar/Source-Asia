import { env } from "@/lib/env";
import { redis } from "@/lib/redis";
import type { RateLimitResult } from "@/types/api";

const RATE_KEY_PREFIX = "rate_limit:";
const USER_SET_KEY = "rate_limit:users";

const slidingWindowLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local windowSeconds = tonumber(ARGV[3])
local maxRequests = tonumber(ARGV[4])
local member = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
redis.call('ZADD', key, now, member)
local currentCount = redis.call('ZCARD', key)

if currentCount > maxRequests then
  redis.call('ZREM', key, member)
  currentCount = currentCount - 1
  local oldestLimited = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local resetTsLimited = now + (windowSeconds * 1000)
  if oldestLimited[2] ~= nil then
    resetTsLimited = tonumber(oldestLimited[2]) + (windowSeconds * 1000)
  end
  return {0, currentCount, resetTsLimited}
end

redis.call('EXPIRE', key, math.ceil(windowSeconds))
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local resetTs = now + (windowSeconds * 1000)
if oldest[2] ~= nil then
  resetTs = tonumber(oldest[2]) + (windowSeconds * 1000)
end

return {1, currentCount, resetTs}
`;

const currentWindowLua = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowStart = tonumber(ARGV[2])
local windowSeconds = tonumber(ARGV[3])

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
local currentCount = redis.call('ZCARD', key)
local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local resetTs = now + (windowSeconds * 1000)
if oldest[2] ~= nil then
  resetTs = tonumber(oldest[2]) + (windowSeconds * 1000)
end
redis.call('EXPIRE', key, math.ceil(windowSeconds))

return {currentCount, resetTs}
`;

type LuaResponse = [number, number, number];
type CurrentWindowLuaResponse = [number, number];

const keyFor = (userId: string) => `${RATE_KEY_PREFIX}${userId}`;

export const getKnownUsers = async (): Promise<string[]> => {
  return redis.smembers(USER_SET_KEY);
};

export const trackUser = async (userId: string): Promise<void> => {
  await redis.sadd(USER_SET_KEY, userId);
};

export const checkAndConsumeSlidingWindow = async (userId: string): Promise<RateLimitResult> => {
  const nowMs = Date.now();
  const windowStartMs = nowMs - env.RATE_LIMIT_WINDOW_SECONDS * 1000;
  const requestMember = `${nowMs}-${Math.random().toString(36).slice(2, 10)}`;

  const response = (await redis.eval(
    slidingWindowLua,
    1,
    keyFor(userId),
    nowMs,
    windowStartMs,
    env.RATE_LIMIT_WINDOW_SECONDS,
    env.RATE_LIMIT_MAX_REQUESTS,
    requestMember
  )) as LuaResponse;

  const allowed = response[0] === 1;
  const currentWindowRequests = response[1];
  const resetTimeMs = response[2];
  const remainingRequests = Math.max(0, env.RATE_LIMIT_MAX_REQUESTS - currentWindowRequests);

  return {
    allowed,
    currentWindowRequests,
    remainingRequests,
    resetTimeMs
  };
};

export const getCurrentWindowStats = async (
  userId: string
): Promise<{ currentWindowRequests: number; remainingRequests: number; resetTimeMs: number }> => {
  const nowMs = Date.now();
  const windowStartMs = nowMs - env.RATE_LIMIT_WINDOW_SECONDS * 1000;

  const response = (await redis.eval(
    currentWindowLua,
    1,
    keyFor(userId),
    nowMs,
    windowStartMs,
    env.RATE_LIMIT_WINDOW_SECONDS
  )) as CurrentWindowLuaResponse;

  const currentWindowRequests = response[0];
  const resetTimeMs = response[1];
  const remainingRequests = Math.max(0, env.RATE_LIMIT_MAX_REQUESTS - currentWindowRequests);

  return { currentWindowRequests, remainingRequests, resetTimeMs };
};
