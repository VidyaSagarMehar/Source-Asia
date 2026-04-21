import { z } from "zod";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { enqueueRetryRequest } from "@/lib/queue";
import { checkAndConsumeSlidingWindow, trackUser } from "@/lib/rateLimiter";
import { incrementTotalRequests, persistAcceptedRequest } from "@/lib/requestStore";
import { jsonError, jsonSuccess } from "@/utils/http";

export const runtime = "nodejs";

const requestBodySchema = z.object({
  user_id: z.string().trim().min(1, "user_id is required"),
  payload: z.unknown()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsedBody = requestBodySchema.safeParse(body);

    if (!parsedBody.success) {
      return jsonError("Invalid request body", 400, {
        issues: parsedBody.error.flatten()
      });
    }

    const { user_id: userId, payload } = parsedBody.data;
    const rateResult = await checkAndConsumeSlidingWindow(userId);

    if (!rateResult.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateResult.resetTimeMs - Date.now()) / 1000));

      if (env.ENABLE_RETRY_QUEUE) {
        await enqueueRetryRequest(userId, payload, rateResult.resetTimeMs - Date.now());
      }

      return jsonError("Rate limit exceeded", 429, {
        retry_after_seconds: retryAfterSeconds,
        current_window_requests: rateResult.currentWindowRequests,
        remaining_requests: rateResult.remainingRequests,
        window_reset_time: rateResult.resetTimeMs,
        queued_for_retry: env.ENABLE_RETRY_QUEUE
      });
    }

    await trackUser(userId);
    const totalRequests = await incrementTotalRequests(userId);
    const requestId = await persistAcceptedRequest(userId, payload);

    return jsonSuccess({
      success: true,
      message: "Request accepted",
      request_id: requestId,
      user_id: userId,
      total_requests: totalRequests,
      current_window_requests: rateResult.currentWindowRequests,
      remaining_requests: rateResult.remainingRequests,
      window_reset_time: rateResult.resetTimeMs
    });
  } catch (error) {
    logger.error({ error }, "Failed to process /api/request");
    return jsonError("Internal server error", 500);
  }
}
