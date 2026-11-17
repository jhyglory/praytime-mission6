"use client";

import { useEffect, useState } from "react";
import type { Prayer } from "@/lib/prayers/types";

export type PrayerPage = {
  data: Prayer[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
};

export class PrayerApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = "REQUEST_FAILED",
    public fieldErrors?: Record<string, string[]>,
  ) { super(message); }
}

export async function prayerRequest<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...options, cache: "no-store", credentials: "same-origin" }); }
  catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new PrayerApiError("서버에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.", 0);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new PrayerApiError(
      payload?.error?.message || (response.status === 403 || response.status === 401
        ? "이 환경에서는 관리자 기능을 사용할 수 없습니다. 보호된 평가 환경이나 로컬에서 확인해 주세요."
        : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."),
      response.status,
      payload?.error?.code,
      payload?.error?.fieldErrors,
    );
  }
  if (!payload) throw new PrayerApiError("서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.", 502);
  return payload as T;
}

export function usePrayerResource<T>(url: string) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ url: string; revision: number; data?: T; error?: PrayerApiError }>({ url: "", revision: -1 });
  useEffect(() => {
    const controller = new AbortController();
    prayerRequest<T>(url, { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setResult({ url, revision, data }); },
      error => { if (!controller.signal.aborted) setResult({ url, revision, error }); },
    );
    return () => controller.abort();
  }, [url, revision]);
  const current = result.url === url && result.revision === revision;
  return {
    data: current ? result.data : undefined,
    error: current ? result.error : undefined,
    loading: !current,
    reload: () => setRevision(value => value + 1),
  };
}

export function readableDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "날짜 확인 필요" : new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul",
  }).format(date);
}

export const nativeCategories: Record<string, string> = {
  "마음": "마음 관리 & 멘탈 케어",
  "디지털": "디지털 라이프 & 소비 습관",
  "관계": "인간관계 & 소통",
  "일·성장": "일터 & 학업 & 자기계발",
  "신앙": "신앙 & 영적 성숙",
  "공동체": "공동체 & 사회",
  "돈": "돈 & 현실",
  "사명": "영향력 & 사명",
};
