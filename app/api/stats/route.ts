import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { getCurrentWindowStats, getKnownUsers } from "@/lib/rateLimiter";
import { getTotalRequests } from "@/lib/requestStore";
import { jsonError, jsonSuccess } from "@/utils/http";
import type { UserStats } from "@/types/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedUserId = url.searchParams.get("user_id");

    const users = requestedUserId ? [requestedUserId] : await getKnownUsers();
    const statsResponse: Record<string, UserStats> = {};

    for (const userId of users) {
      if (!userId) {
        continue;
      }

      const [totalRequests, currentWindow] = await Promise.all([
        getTotalRequests(userId),
        getCurrentWindowStats(userId)
      ]);

      statsResponse[userId] = {
        total_requests: totalRequests,
        current_window_requests: currentWindow.currentWindowRequests,
        remaining_requests: currentWindow.remainingRequests,
        window_reset_time: currentWindow.resetTimeMs
      };
    }

    return jsonSuccess({
      max_requests_per_window: env.RATE_LIMIT_MAX_REQUESTS,
      window_seconds: env.RATE_LIMIT_WINDOW_SECONDS,
      stats: statsResponse
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch /api/stats");
    return jsonError("Internal server error", 500);
  }
}
