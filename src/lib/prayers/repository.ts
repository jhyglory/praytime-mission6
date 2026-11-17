import type { SupabaseClient } from "@supabase/supabase-js";
import type { Prayer, PrayerStatus } from "./types";
import type { CoverUpload, PrayerFields } from "./schema";
import { isOwnedCoverPath } from "./schema";
import { PrayerError } from "./errors";

export type PrayerScope = "public" | "admin";
export type PrayerRow = Omit<Prayer, "cover_url"> & { source_payload?: Record<string, unknown> | null };
export interface PrayerQuery { page: number; pageSize: number; category?: string; status?: PrayerStatus }
export type PrayerInsert = PrayerFields & {
  id: string; image_path: string | null; source_key: string;
  source_payload: Record<string, string | null>; source_order: null;
};
export type PrayerUpdate = PrayerFields & { image_path: string | null; updated_at: string };

export interface PrayerRepository {
  list(query: PrayerQuery): Promise<{ rows: PrayerRow[]; total: number }>;
  categories(): Promise<string[]>;
  find(id: string): Promise<PrayerRow | null>;
  insert(record: PrayerInsert): Promise<{ row: PrayerRow | null; duplicate: boolean }>;
  update(id: string, version: string, fields: PrayerUpdate): Promise<PrayerRow | null>;
  delete(id: string, version: string): Promise<boolean>;
  upload(path: string, image: CoverUpload): Promise<void>;
  remove(path: string): Promise<boolean>;
  sign(rows: PrayerRow[]): Promise<Map<string, string>>;
}

export const PRAYER_PUBLIC_COLUMNS = "id,title,content,category,category_full,keyword,scripture_ref,scripture_text,language,status,image_path,source_key,source_order,created_at,updated_at";
const ADMIN_COLUMNS = `${PRAYER_PUBLIC_COLUMNS},source_payload`;
const BUCKET = "prayer-covers";
const storageFailure = () => new PrayerError(503, "STORAGE_UNAVAILABLE", "표지 이미지 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");
const databaseFailure = () => new PrayerError(503, "DATABASE_UNAVAILABLE", "기도문 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.");

/** Injected SDK client is already scoped by the server; no request headers are forwarded. */
export function createPrayerRepository(client: SupabaseClient, scope: PrayerScope): PrayerRepository {
  const columns = scope === "admin" ? ADMIN_COLUMNS : PRAYER_PUBLIC_COLUMNS;
  const assertAdmin = () => { if (scope !== "admin") throw new PrayerError(403, "READ_ONLY", "공개 기도문은 조회만 가능합니다."); };
  return {
    async list({ page, pageSize, category, status }) {
      let query = client.from("prayers").select(columns, { count: "exact" }).eq("language", "ko");
      if (scope === "public") query = query.eq("status", "published");
      else if (status) query = query.eq("status", status);
      if (category) query = query.eq("category", category);
      const ordered = scope === "admin"
        ? query.order("updated_at", { ascending: false }).order("id", { ascending: true })
        : query.order("source_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false }).order("id", { ascending: true });
      const { data, count, error } = await ordered.range((page - 1) * pageSize, page * pageSize - 1);
      if (error || count === null) throw databaseFailure();
      return { rows: (data ?? []) as unknown as PrayerRow[], total: count };
    },
    async categories() {
      // PostgREST limits a response to 1,000 rows. Do not silently truncate categories.
      const categories = new Set<string>();
      const batch = 1000;
      for (let offset = 0; offset < 100_000; offset += batch) {
        let query = client.from("prayers").select("category").eq("language", "ko");
        if (scope === "public") query = query.eq("status", "published");
        const { data, error } = await query.order("id", { ascending: true }).range(offset, offset + batch - 1);
        if (error) throw databaseFailure();
        for (const row of data ?? []) if (typeof row.category === "string" && row.category.trim()) categories.add(row.category);
        if (!data || data.length < batch) return [...categories].sort((a, b) => a.localeCompare(b, "ko"));
      }
      throw databaseFailure();
    },
    async find(id) {
      let query = client.from("prayers").select(columns).eq("id", id).eq("language", "ko");
      if (scope === "public") query = query.eq("status", "published");
      const { data, error } = await query.maybeSingle();
      if (error) throw databaseFailure();
      return data as unknown as PrayerRow | null;
    },
    async insert(record) {
      assertAdmin();
      const { data, error } = await client.from("prayers").insert(record).select(ADMIN_COLUMNS).single();
      if (error?.code === "23505") return { row: null, duplicate: true };
      if (error || !data) throw databaseFailure();
      return { row: data as unknown as PrayerRow, duplicate: false };
    },
    async update(id, version, fields) {
      assertAdmin();
      const { data, error } = await client.from("prayers").update(fields)
        .eq("id", id).eq("updated_at", version).select(ADMIN_COLUMNS).maybeSingle();
      if (error) throw databaseFailure();
      return data as unknown as PrayerRow | null;
    },
    async delete(id, version) {
      assertAdmin();
      const { data, error } = await client.from("prayers").delete().eq("id", id).eq("updated_at", version).select("id");
      if (error) throw databaseFailure();
      return !!data?.length;
    },
    async upload(path, image) {
      assertAdmin();
      const { error } = await client.storage.from(BUCKET).upload(path, image.bytes, {
        contentType: image.mime, cacheControl: "300", upsert: false,
      });
      if (error) throw storageFailure();
    },
    async remove(path) {
      assertAdmin();
      try {
        const { error } = await client.storage.from(BUCKET).remove([path]);
        return !error;
      } catch { return false; }
    },
    async sign(rows) {
      const paths = [...new Set(rows.filter(row => scope === "admin" || row.status === "published")
        .filter(row => isOwnedCoverPath(row.image_path, row.id)).map(row => row.image_path as string))];
      if (!paths.length) return new Map();
      const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, 300);
      if (error || !data) throw storageFailure();
      const signed = new Map<string, string>();
      for (const item of data) if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
      return signed;
    },
  };
}
