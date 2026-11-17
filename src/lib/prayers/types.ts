/** Client-safe CMS contracts. Credentials and original import payloads never belong here. */
export type PrayerStatus = "draft" | "published";

export interface Prayer {
  id: string;
  title: string;
  content: string;
  category: string | null;
  category_full: string | null;
  keyword: string | null;
  scripture_ref: string | null;
  scripture_text: string | null;
  language: "ko";
  status: PrayerStatus;
  image_path: string | null;
  cover_url: string | null;
  source_key: string | null;
  source_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface PrayerListResponse {
  data: Prayer[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
}

export interface PrayerMutationResponse {
  data: Prayer;
  warning?: string;
  replayed?: boolean;
}

export interface PrayerErrorResponse {
  error: { code: string; message: string; fieldErrors?: Record<string, string[]> };
}
