import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const NATIVE_FIELDS = Object.freeze([
  "category", "category_full", "title_kr", "keyword_kr",
  "scripture_ref", "scripture_kr", "prayer_kr", "id",
]);
export const NATIVE_SHA256 = "0b03acfc60e5f0c880286be194dea92860c1b575a1cc56a5664466f45cb6eb45";
export const PRAYER_PROJECT_URL = "https://cibcyeyznfmywacfiokh.supabase.co";
export const NATIVE_CATEGORIES = Object.freeze({
  "마음": { full: "마음 관리 & 멘탈 케어", count: 17 },
  "디지털": { full: "디지털 라이프 & 소비 습관", count: 8 },
  "관계": { full: "인간관계 & 소통", count: 19 },
  "일·성장": { full: "일터 & 학업 & 자기계발", count: 18 },
  "신앙": { full: "신앙 & 영적 성숙", count: 21 },
  "공동체": { full: "공동체 & 사회", count: 6 },
  "돈": { full: "돈 & 현실", count: 6 },
  "사명": { full: "영향력 & 사명", count: 5 },
});

const SOURCE_PREFIX = "praytime:ko:";
const SOURCE_FILE = new URL("../data/prayer_guides_ko.json", import.meta.url);
const SELECT_COLUMNS = [
  "id", "source_key", "title", "content", "category", "category_full", "keyword",
  "scripture_ref", "scripture_text", "language", "source_payload", "source_order",
  "image_path", "status", "updated_at",
].join(",");

/** @typedef {{category:string, category_full:string, title_kr:string, keyword_kr:string, scripture_ref:string, scripture_kr:string, prayer_kr:string, id:string}} NativeGuide */

export class PrayerImportError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PrayerImportError";
    this.code = code;
  }
}

/** Validate the complete audited native snapshot without transforming any string.
 * @param {unknown} input
 * @returns {NativeGuide[]}
 */
export function validateNativeGuides(input) {
  if (!Array.isArray(input) || input.length !== 100) {
    throw new PrayerImportError("INVALID_RECORD_COUNT", "Native JSON은 정확히 100개 레코드여야 합니다.");
  }
  const ids = new Set();
  const counts = new Map();
  for (const [index, value] of input.entries()) {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== NATIVE_FIELDS.length
      || !NATIVE_FIELDS.every(field => Object.hasOwn(value, field))) {
      throw new PrayerImportError("INVALID_FIELDS", `${index + 1}번째 레코드의 원본 8개 필드를 확인하세요.`);
    }
    for (const field of NATIVE_FIELDS) {
      if (typeof value[field] !== "string" || value[field].trim().length === 0) {
        throw new PrayerImportError("INVALID_STRING", `${index + 1}번째 레코드의 ${field}는 비어 있지 않은 문자열이어야 합니다.`);
      }
    }
    if (ids.has(value.id)) {
      throw new PrayerImportError("DUPLICATE_NATIVE_ID", "Native ID가 중복되었습니다.");
    }
    ids.add(value.id);
    if (value.id !== `guide_${String(index + 1).padStart(3, "0")}`) {
      throw new PrayerImportError("INVALID_NATIVE_ORDER", "guide_001부터 guide_100까지의 원본 배열 순서를 보존해야 합니다.");
    }
    const category = NATIVE_CATEGORIES[value.category];
    if (!category || value.category_full !== category.full) {
      throw new PrayerImportError("INVALID_CATEGORY", "원본 category와 category_full의 대응이 다릅니다.");
    }
    counts.set(value.category, (counts.get(value.category) ?? 0) + 1);
  }
  if (Object.entries(NATIVE_CATEGORIES).some(([category, expected]) => counts.get(category) !== expected.count)) {
    throw new PrayerImportError("INVALID_CATEGORY_COUNTS", "원본 8개 카테고리의 개수가 다릅니다.");
  }
  return input;
}

/** @param {NativeGuide} guide @param {number} sourceOrder @param {{publish?:boolean}} options */
export function mapNativeGuide(guide, sourceOrder, { publish = false } = {}) {
  return {
    source_key: `${SOURCE_PREFIX}${guide.id}`,
    title: guide.title_kr,
    content: guide.prayer_kr,
    category: guide.category,
    category_full: guide.category_full,
    keyword: guide.keyword_kr,
    scripture_ref: guide.scripture_ref,
    scripture_text: guide.scripture_kr,
    language: "ko",
    image_path: null,
    status: publish ? "published" : "draft",
    source_order: sourceOrder,
    source_payload: Object.fromEntries(NATIVE_FIELDS.map(field => [field, guide[field]])),
  };
}

/** Reconstruct only the original eight fields from editable CMS columns.
 * @param {Record<string, unknown>} row
 */
export function projectNativeGuide(row) {
  return {
    category: row.category,
    category_full: row.category_full,
    title_kr: row.title,
    keyword_kr: row.keyword,
    scripture_ref: row.scripture_ref,
    scripture_kr: row.scripture_text,
    prayer_kr: row.content,
    id: typeof row.source_key === "string" && row.source_key.startsWith(SOURCE_PREFIX)
      ? row.source_key.slice(SOURCE_PREFIX.length) : null,
  };
}

/** @param {unknown} value @param {NativeGuide} guide */
export function sameNativeGuide(value, guide) {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === NATIVE_FIELDS.length
    && NATIVE_FIELDS.every(field => Object.hasOwn(value, field) && value[field] === guide[field]);
}

/** Status and image are independent CMS choices; native projection excludes them.
 * @param {NativeGuide} guide @param {number} sourceOrder @param {Record<string, unknown>} row
 */
export function comparePrayerRow(guide, sourceOrder, row) {
  const reasons = [];
  if (row.source_key !== `${SOURCE_PREFIX}${guide.id}`) reasons.push("source_key");
  if (!sameNativeGuide(row.source_payload, guide)) reasons.push("source_payload");
  const projection = projectNativeGuide(row);
  for (const field of NATIVE_FIELDS) {
    if (projection[field] !== guide[field]) reasons.push(`cms.${field}`);
  }
  if (row.language !== "ko") reasons.push("language");
  if (row.source_order !== sourceOrder) reasons.push("source_order");
  if (row.status !== "draft" && row.status !== "published") reasons.push("status");
  return { kind: reasons.length ? "conflict" : "unchanged", reasons };
}

/** Pure plan: no write, no deletion, no updates to existing UUIDs or CMS content.
 * @param {NativeGuide[]} guides @param {Record<string, unknown>[]} existingRows
 * @param {{publish?:boolean}} options
 */
export function planPrayerImport(guides, existingRows, { publish = false } = {}) {
  const existing = new Map();
  for (const row of existingRows) {
    const rows = existing.get(row.source_key) ?? [];
    rows.push(row);
    existing.set(row.source_key, rows);
  }
  const toCreate = [];
  const toPublish = [];
  const unchanged = [];
  const conflicts = [];
  for (const [index, guide] of guides.entries()) {
    const sourceKey = `${SOURCE_PREFIX}${guide.id}`;
    const matches = existing.get(sourceKey) ?? [];
    if (matches.length === 0) {
      toCreate.push(mapNativeGuide(guide, index, { publish }));
    } else if (matches.length > 1) {
      conflicts.push({ source_key: sourceKey, reasons: ["duplicate_existing_source_key"] });
    } else {
      const result = comparePrayerRow(guide, index, matches[0]);
      if (result.kind === "unchanged") {
        const row = matches[0];
        if (publish && row.status === "draft") {
          if (typeof row.id !== "string" || !row.id || typeof row.updated_at !== "string" || !row.updated_at) {
            conflicts.push({ source_key: sourceKey, reasons: ["publish_optimistic_metadata_missing"] });
            continue;
          }
          toPublish.push({ id: row.id, source_key: sourceKey, updated_at: row.updated_at });
        }
        unchanged.push(sourceKey);
      } else conflicts.push({ source_key: sourceKey, reasons: result.reasons });
    }
  }
  return { toCreate, toPublish, unchanged, conflicts };
}

/** The project restriction also protects dry-run reads from the Mission 5 DB.
 * @param {Record<string, string | undefined>} env
 */
export function getPrayerImportConfiguration(env) {
  const url = env.PRAYER_SUPABASE_URL;
  const key = env.PRAYER_SUPABASE_SECRET_KEY;
  if (!url && !key) return null;
  if (!url || !key) throw new PrayerImportError("INCOMPLETE_CONFIGURATION", "기도 콘텐츠 전용 서버 환경 변수 2개가 모두 필요합니다.");
  let parsed;
  try { parsed = new URL(url); } catch {
    throw new PrayerImportError("INVALID_PROJECT_URL", "기도 콘텐츠 프로젝트 URL을 확인하세요.");
  }
  if (parsed.origin !== PRAYER_PROJECT_URL || parsed.pathname !== "/" || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new PrayerImportError("PROJECT_NOT_ALLOWED", "허용된 Mission 6 기도 콘텐츠 프로젝트에서만 실행할 수 있습니다.");
  }
  let serverKey = key.startsWith("sb_secret_");
  if (key.startsWith("eyJ")) {
    try { serverKey = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).role === "service_role"; }
    catch { serverKey = false; }
  }
  if (!serverKey) throw new PrayerImportError("SERVER_KEY_REQUIRED", "클라이언트 공개 키가 아닌 서버 전용 키가 필요합니다.");
  return { url: PRAYER_PROJECT_URL, key };
}

export function parseImportOptions(args) {
  const allowed = new Set(["--apply", "--dry-run", "--publish", "--validate-only", "--help"]);
  if (args.some(arg => !allowed.has(arg)) || new Set(args).size !== args.length
    || (args.includes("--apply") && (args.includes("--dry-run") || args.includes("--validate-only")))) {
    throw new PrayerImportError("INVALID_OPTIONS", "지원하는 옵션은 --dry-run, --apply, --publish, --validate-only, --help입니다.");
  }
  return { apply: args.includes("--apply"), publish: args.includes("--publish"), validateOnly: args.includes("--validate-only"), help: args.includes("--help") };
}

export function readNativeSnapshot() {
  const bytes = readFileSync(SOURCE_FILE);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== NATIVE_SHA256) throw new PrayerImportError("SOURCE_HASH_MISMATCH", "Native JSON 스냅샷의 바이트가 감사된 원본과 다릅니다.");
  return { guides: validateNativeGuides(JSON.parse(bytes.toString("utf8"))), sha256 };
}

/** Opaque server keys are API keys, not bearer JWTs. Keep real legacy JWTs.
 * @param {string} key @param {typeof fetch} fetcher
 * @returns {typeof fetch}
 */
export function createPrayerImportFetch(key, fetcher = fetch) {
  return (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    if (key.startsWith("sb_secret_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    return fetcher(input, { ...init, headers,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
  };
}

/** @param {import("@supabase/supabase-js").SupabaseClient} client */
export async function readExistingPrayers(client) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("prayers").select(SELECT_COLUMNS)
      .like("source_key", `${SOURCE_PREFIX}%`).order("source_key", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error || !Array.isArray(data)) throw new PrayerImportError("DATABASE_READ_FAILED", "기도 콘텐츠를 읽지 못했습니다. 연결과 테이블 구조를 확인하세요.");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

function printSummary(summary) {
  console.log(JSON.stringify(summary, null, 2));
}

export async function main(args = process.argv.slice(2)) {
  const options = parseImportOptions(args);
  if (options.help) {
    console.log("node scripts/import-prayers.mjs [--dry-run | --apply] [--publish]\nnode scripts/import-prayers.mjs --validate-only\nDefault: read-only dry-run. --publish publishes new rows and exact native-matching existing drafts, using optimistic status-only updates. No content is overwritten or deleted.");
    return 0;
  }
  if (Number(process.versions.node.split(".")[0]) !== 24) throw new PrayerImportError("NODE_24_REQUIRED", "Node.js 24.x에서 실행하세요.");
  const { guides, sha256 } = readNativeSnapshot();
  const summary = {
    mode: options.validateOnly ? "validate-only" : options.apply ? "apply" : "dry-run",
    source: { file: "data/prayer_guides_ko.json", sha256, total: guides.length, categories: Object.fromEntries(Object.entries(NATIVE_CATEGORIES).map(([name, category]) => [name, category.count])) },
    new_row_status: options.publish ? "published" : "draft",
    created: 0, published: 0, unchanged: 0, conflicts: 0, failed: 0,
    planned_create: null,
    planned_publish: null,
    database: "NOT_CHECKED",
  };
  if (options.validateOnly) {
    printSummary(summary);
    return 0;
  }
  const envFile = fileURLToPath(new URL("../.env.local", import.meta.url));
  if (existsSync(envFile)) {
    try { process.loadEnvFile(envFile); }
    catch { throw new PrayerImportError("ENV_FILE_READ_FAILED", "로컬 서버 환경 변수 파일을 읽지 못했습니다."); }
  }
  const configuration = getPrayerImportConfiguration(process.env);
  if (!configuration) {
    if (options.apply) throw new PrayerImportError("MISSING_CONFIGURATION", "--apply에는 기도 콘텐츠 전용 서버 환경 변수 2개가 필요합니다.");
    printSummary({ ...summary, database: "NOT_CHECKED_NO_CREDENTIALS" });
    return 0;
  }
  const client = createClient(configuration.url, configuration.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createPrayerImportFetch(configuration.key) },
  });
  const before = await readExistingPrayers(client);
  const plan = planPrayerImport(guides, before, options);
  Object.assign(summary, { database: "CHECKED", unchanged: plan.unchanged.length, conflicts: plan.conflicts.length, planned_create: plan.toCreate.length, planned_publish: plan.toPublish.length });
  if (!options.apply || plan.conflicts.length) {
    printSummary({ ...summary, conflict_details: plan.conflicts, writes_performed: false,
      verification: { expected: guides.length, matching_native_projection: plan.unchanged.length, exact: plan.unchanged.length === guides.length } });
    return plan.conflicts.length ? 2 : 0;
  }
  const createdKeys = new Set();
  const publishedKeys = new Set();
  let writeFailed = false;
  // The native snapshot is 100 rows: one atomic PostgREST INSERT statement.
  // ignoreDuplicates protects rows created concurrently; it never updates a row.
  for (let offset = 0; offset < plan.toCreate.length; offset += 100) {
    const chunk = plan.toCreate.slice(offset, offset + 100);
    const { data, error } = await client.from("prayers")
      .upsert(chunk, { onConflict: "source_key", ignoreDuplicates: true }).select("source_key");
    if (error || !Array.isArray(data)) { writeFailed = true; break; }
    for (const row of data) createdKeys.add(row.source_key);
  }
  if (!writeFailed) {
    for (const row of plan.toPublish) {
      // Exact payload/live-field checks happened in the plan. The table's
      // updated_at trigger makes a concurrent CMS edit invalidate this lease.
      const { data, error } = await client.from("prayers").update({ status: "published" })
        .eq("id", row.id).eq("source_key", row.source_key)
        .eq("updated_at", row.updated_at).eq("status", "draft").select("source_key");
      if (error || !Array.isArray(data)) { writeFailed = true; break; }
      for (const published of data) publishedKeys.add(published.source_key);
    }
  }
  // Re-read even after a failed transport: report actual postconditions and races.
  let after;
  try { after = await readExistingPrayers(client); }
  catch {
    printSummary({ ...summary, created: createdKeys.size, published: publishedKeys.size,
      unchanged: plan.unchanged.filter(key => !publishedKeys.has(key)).length,
      failed: 1, writes_performed: plan.toCreate.length > 0 || plan.toPublish.length > 0,
      write_error: writeFailed ? "DATABASE_WRITE_FAILED" : null,
      verification: { expected: guides.length, exact: null, result: "NOT_VERIFIED_READ_FAILED" } });
    return 1;
  }
  const checked = planPrayerImport(guides, after, options);
  const unchanged = checked.unchanged.filter(key => !createdKeys.has(key) && !publishedKeys.has(key)).length;
  const exact = checked.unchanged.length === guides.length && checked.toCreate.length === 0 && checked.conflicts.length === 0;
  const publicationComplete = !options.publish || checked.toPublish.length === 0;
  printSummary({ ...summary, created: createdKeys.size, published: publishedKeys.size, unchanged, conflicts: checked.conflicts.length,
    failed: checked.toCreate.length + checked.toPublish.length, conflict_details: checked.conflicts,
    writes_performed: plan.toCreate.length > 0 || plan.toPublish.length > 0,
    write_error: writeFailed ? "DATABASE_WRITE_FAILED" : null,
    verification: { expected: guides.length, present: guides.length - checked.toCreate.length,
      matching_native_projection: checked.unchanged.length, exact, publication_complete: publicationComplete,
      scoped_rows_before: before.length, scoped_rows_after: after.length,
      unrelated_rows_action: "PRESERVED" },
  });
  return exact && publicationComplete && !writeFailed ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }).catch(error => {
    // Never print SDK messages, transport details, environment values or keys.
    printSummary({ mode: "error", created: 0, published: 0, unchanged: 0, conflicts: 0, failed: 1,
      error: { code: error instanceof PrayerImportError ? error.code : "IMPORT_FAILED",
        message: error instanceof PrayerImportError ? error.message : "가져오기를 완료하지 못했습니다. 서버 설정과 감사 문서를 확인하세요." } });
    process.exitCode = 1;
  });
}
