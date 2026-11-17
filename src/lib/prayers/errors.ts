import type { PrayerErrorResponse } from "./types";

export class PrayerError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
  ) { super(message); }
}

export function prayerJSON(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("X-Content-Type-Options", "nosniff");
  return Response.json(body, { status, headers: responseHeaders });
}

export function prayerErrorResponse(error: unknown): Response {
  const known = error instanceof PrayerError ? error : new PrayerError(
    503, "CMS_UNAVAILABLE", "기도문 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  );
  const body: PrayerErrorResponse = { error: {
    code: known.code,
    message: known.message,
    ...(known.fieldErrors ? { fieldErrors: known.fieldErrors } : {}),
  } };
  // Never serialize an upstream error, URL, request headers, or credentials.
  return prayerJSON(body, known.status);
}
