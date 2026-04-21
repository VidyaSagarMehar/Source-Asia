export type RequestBody = {
  user_id: string;
  payload: unknown;
};

export type RateLimitResult = {
  allowed: boolean;
  currentWindowRequests: number;
  remainingRequests: number;
  resetTimeMs: number;
};

export type UserStats = {
  total_requests: number;
  current_window_requests: number;
  remaining_requests: number;
  window_reset_time: number;
};
