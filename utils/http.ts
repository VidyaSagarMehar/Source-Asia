import { NextResponse } from "next/server";

export const jsonSuccess = <T>(data: T, status = 200): NextResponse => {
  return NextResponse.json(data, { status });
};

export const jsonError = (
  message: string,
  status = 500,
  details?: Record<string, unknown>
): NextResponse => {
  return NextResponse.json(
    {
      error: message,
      ...(details ? { details } : {})
    },
    { status }
  );
};
