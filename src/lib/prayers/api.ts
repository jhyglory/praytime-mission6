import { createHash, randomUUID } from "node:crypto";
import { guardAdminRequest } from "./admin-access";
import { PrayerError, prayerErrorResponse, prayerJSON } from "./errors";
import {
  MAX_CMS_REQUEST_BYTES, MAX_PAYLOAD_BYTES, createPrayerSchema, deletePrayerSchema,
  isOwnedCoverPath, prayerIdSchema, updatePrayerSchema, validate, validateCover,
  type CoverUpload, type CreatePrayerInput, type PrayerFields, type UpdatePrayerInput,
} from "./schema";
import type { Prayer, PrayerStatus } from "./types";
import type { PrayerQuery, PrayerRepository, PrayerRow, PrayerScope } from "./repository";

export interface PrayerApiDependencies {
  repository: (scope: PrayerScope) => PrayerRepository;
  now?: () => Date;
  uuid?: () => string;
}

const conflict = () => new PrayerError(409, "VERSION_CONFLICT", "다른 변경이 먼저 저장되었습니다. 최신 내용을 불러온 뒤 다시 수정해 주세요.");
const notFound = () => new PrayerError(404, "PRAYER_NOT_FOUND", "기도문을 찾을 수 없습니다.");

function queryParameters(request: Request, scope: PrayerScope): PrayerQuery {
  const params = new URL(request.url).searchParams;
  for (const key of ["page", "pageSize", "category", "status"]) {
    if (params.getAll(key).length > 1) throw new PrayerError(400, "INVALID_QUERY", "조회 조건을 확인해 주세요.");
  }
  const integer = (key: string, fallback: number, max: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) {
      throw new PrayerError(400, "INVALID_QUERY", "페이지와 표시 개수를 확인해 주세요.");
    }
    return Number(raw);
  };
  const category = params.get("category")?.trim() || undefined;
  if (category && category.length > 60) throw new PrayerError(400, "INVALID_QUERY", "카테고리를 확인해 주세요.");
  const rawStatus = params.get("status");
  if (rawStatus && !["draft", "published"].includes(rawStatus)) throw new PrayerError(400, "INVALID_QUERY", "공개 상태를 확인해 주세요.");
  return {
    page: integer("page", 1, 100_000), pageSize: integer("pageSize", scope === "public" ? 9 : 10, 50),
    ...(category ? { category } : {}), ...(scope === "admin" && rawStatus ? { status: rawStatus as PrayerStatus } : {}),
  };
}

async function boundedBody(request: Request, max = MAX_CMS_REQUEST_BYTES): Promise<Uint8Array> {
  const advertised = request.headers.get("content-length");
  if (advertised && (!/^\d+$/.test(advertised) || Number(advertised) > max)) throw new PrayerError(413, "REQUEST_TOO_LARGE", "요청 크기가 허용 범위를 초과했습니다.");
  if (!request.body) throw new PrayerError(400, "EMPTY_REQUEST", "입력 내용이 없습니다.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > max) {
        await reader.cancel();
        throw new PrayerError(413, "REQUEST_TOO_LARGE", "요청 크기가 허용 범위를 초과했습니다.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

async function mutationInput(request: Request, action: "create"): Promise<{ input: CreatePrayerInput; image?: CoverUpload }>;
async function mutationInput(request: Request, action: "update"): Promise<{ input: UpdatePrayerInput; image?: CoverUpload }>;
async function mutationInput(request: Request, action: "create" | "update") {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data;")) throw new PrayerError(415, "MULTIPART_REQUIRED", "입력 내용과 이미지를 폼 형식으로 보내 주세요.");
  const bytes = await boundedBody(request);
  let form: FormData;
  try { form = await new Response(bytes as BodyInit, { headers: { "Content-Type": type } }).formData(); }
  catch { throw new PrayerError(400, "INVALID_MULTIPART", "업로드 요청을 읽지 못했습니다."); }
  for (const key of form.keys()) if (!["payload", "cover"].includes(key) || form.getAll(key).length !== 1) {
    throw new PrayerError(400, "INVALID_FORM", "입력 항목을 확인해 주세요.");
  }
  const raw = form.get("payload");
  if (typeof raw !== "string") throw new PrayerError(400, "PAYLOAD_REQUIRED", "기도문 입력 내용이 필요합니다.");
  if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) throw new PrayerError(413, "PAYLOAD_TOO_LARGE", "기도문 입력 내용이 너무 깁니다.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new PrayerError(400, "INVALID_JSON", "입력 내용을 읽지 못했습니다."); }
  const input = action === "create" ? validate(createPrayerSchema, parsed) : validate(updatePrayerSchema, parsed);
  const file = form.get("cover");
  if (file !== null && typeof file === "string") throw new PrayerError(400, "INVALID_IMAGE", "표지 이미지를 다시 선택해 주세요.");
  if (file && input.removeImage) throw new PrayerError(400, "IMAGE_ACTION_CONFLICT", "이미지 교체와 삭제 중 하나만 선택해 주세요.");
  return { input, ...(file ? { image: await validateCover(file) } : {}) };
}

function fieldsOf(input: CreatePrayerInput | UpdatePrayerInput): PrayerFields {
  return {
    title: input.title, content: input.content, category: input.category,
    category_full: input.category_full, keyword: input.keyword, scripture_ref: input.scripture_ref,
    scripture_text: input.scripture_text, status: input.status, language: input.language,
  };
}

function matchesFields(row: PrayerRow, fields: PrayerFields): boolean {
  return Object.entries(fields).every(([key, value]) => row[key as keyof PrayerRow] === value);
}

async function confirmAfterFailure(repo: PrayerRepository, id: string): Promise<PrayerRow | null> {
  try { return await repo.find(id); }
  catch {
    // A timeout can arrive after Postgres committed. Preserve any possibly linked file.
    throw new PrayerError(503, "SAVE_UNCONFIRMED", "저장 결과를 확인하지 못했습니다. 목록을 새로고침해 확인해 주세요. 연결될 수 있는 이미지 파일은 보존했습니다.");
  }
}

/** Whitelist every response field; never spread a DB row or return source_payload. */
export function serializePrayer(row: PrayerRow, signed = new Map<string, string>()): Prayer {
  return {
    id: row.id, title: row.title, content: row.content, category: row.category,
    category_full: row.category_full, keyword: row.keyword, scripture_ref: row.scripture_ref,
    scripture_text: row.scripture_text, language: row.language, status: row.status,
    image_path: row.image_path, cover_url: row.image_path ? signed.get(row.image_path) ?? null : null,
    source_key: row.source_key, source_order: row.source_order,
    created_at: row.created_at, updated_at: row.updated_at,
  };
}

async function cleanup(repo: PrayerRepository, path: string | null, id: string): Promise<string | undefined> {
  if (!path) return;
  if (!isOwnedCoverPath(path, id)) return "기도문은 저장되었습니다. 이전 표지의 경로를 확인할 수 없어 파일 정리를 보류했습니다.";
  if (!await repo.remove(path)) return "기도문은 저장되었습니다. 이전 표지 파일 정리를 완료하지 못해 관리자 확인이 필요합니다.";
}

async function rollback(repo: PrayerRepository, path: string | null, id: string): Promise<void> {
  if (path && (!isOwnedCoverPath(path, id) || !await repo.remove(path))) {
    throw new PrayerError(503, "IMAGE_ROLLBACK_FAILED", "기도문 저장은 완료되지 않았습니다. 새 표지 파일 정리를 완료하지 못해 관리자 확인이 필요합니다.");
  }
}

async function success(repo: PrayerRepository, row: PrayerRow, status = 200, warning?: string, replayed = false): Promise<Response> {
  let signed = new Map<string, string>();
  try { signed = await repo.sign([row]); }
  catch { warning = [warning, "기도문은 저장되었습니다. 표지를 불러오지 못했으므로 잠시 후 새로고침해 주세요."].filter(Boolean).join(" "); }
  return prayerJSON({ data: serializePrayer(row, signed), ...(warning ? { warning } : {}), ...(replayed ? { replayed: true } : {}) }, status);
}

/** Request orchestration is testable without a real database or fallback persistence. */
export function createPrayerApi({ repository, now = () => new Date(), uuid = randomUUID }: PrayerApiDependencies) {
  const run = async (work: () => Promise<Response>) => { try { return await work(); } catch (error) { return prayerErrorResponse(error); } };
  const list = (request: Request, scope: PrayerScope) => run(async () => {
    if (scope === "admin") { const denied = guardAdminRequest(request); if (denied) return denied; }
    const query = queryParameters(request, scope);
    const repo = repository(scope);
    const [{ rows, total }, categories] = await Promise.all([repo.list(query), repo.categories()]);
    const signed = await repo.sign(rows);
    return prayerJSON({ data: rows.map(row => serializePrayer(row, signed)), total, page: query.page, pageSize: query.pageSize, categories });
  });
  const detail = (request: Request, id: string, scope: PrayerScope) => run(async () => {
    if (scope === "admin") { const denied = guardAdminRequest(request); if (denied) return denied; }
    validate(prayerIdSchema, id);
    const repo = repository(scope);
    const row = await repo.find(id);
    if (!row || (scope === "public" && row.status !== "published")) throw notFound();
    return prayerJSON({ data: serializePrayer(row, await repo.sign([row])) });
  });
  return {
    publicList: (request: Request) => list(request, "public"),
    publicDetail: (request: Request, id: string) => detail(request, id, "public"),
    adminList: (request: Request) => list(request, "admin"),
    adminDetail: (request: Request, id: string) => detail(request, id, "admin"),
    create: (request: Request) => run(async () => {
      const denied = guardAdminRequest(request, { mutation: true }); if (denied) return denied;
      const { input, image } = await mutationInput(request, "create");
      const repo = repository("admin");
      const id = input.clientRequestId;
      const fields = fieldsOf(input);
      const imageHash = image ? createHash("sha256").update(image.mime).update("\0").update(image.bytes).digest("hex") : null;
      const imageMime = image?.mime ?? null;
      const sourceId = `cms_${id}`;
      const sourceKey = `praytime:ko:${sourceId}`;
      const replay = async (existing: PrayerRow) => {
        if (existing.source_key !== sourceKey || !matchesFields(existing, fields)
          || existing.source_payload?._cms_create_image_sha256 !== imageHash
          || existing.source_payload?._cms_create_image_mime !== imageMime) {
          throw new PrayerError(409, "REQUEST_ID_REUSED", "이미 사용한 저장 요청입니다. 기존 기도문을 확인하거나 새 요청으로 저장해 주세요.");
        }
        return success(repo, existing, 200, undefined, true);
      };
      const existing = await repo.find(id);
      if (existing) return replay(existing);
      let newPath: string | null = null;
      if (image) {
        newPath = `prayers/${id}/${uuid()}.${image.extension}`;
        try { await repo.upload(newPath, image); } catch (error) { await rollback(repo, newPath, id); throw error; }
      }
      let result;
      try {
        result = await repo.insert({ ...fields, id, image_path: newPath, source_key: sourceKey, source_order: null, source_payload: {
          id: sourceId, category: fields.category ?? "", category_full: fields.category_full ?? "",
          title_kr: fields.title, keyword_kr: fields.keyword ?? "", scripture_ref: fields.scripture_ref ?? "",
          scripture_kr: fields.scripture_text ?? "", prayer_kr: fields.content,
          _cms_create_image_sha256: imageHash, _cms_create_image_mime: imageMime,
        } });
      } catch (error) {
        const confirmed = await confirmAfterFailure(repo, id);
        if (confirmed?.source_key === sourceKey && confirmed.image_path === newPath) {
          if (matchesFields(confirmed, fields)) return success(repo, confirmed, 201);
          throw conflict(); // A newer edit still references this operation's cover.
        }
        await rollback(repo, newPath, id);
        throw error;
      }
      if (result.duplicate) {
        await rollback(repo, newPath, id);
        const winner = await repo.find(id);
        if (!winner) throw new PrayerError(409, "REQUEST_ID_CONFLICT", "같은 저장 요청이 처리 중입니다. 목록을 확인한 뒤 다시 시도해 주세요.");
        return replay(winner);
      }
      if (!result.row) { await rollback(repo, newPath, id); throw new PrayerError(503, "SAVE_FAILED", "기도문을 저장하지 못했습니다."); }
      return success(repo, result.row, 201);
    }),
    update: (request: Request, id: string) => run(async () => {
      const denied = guardAdminRequest(request, { mutation: true }); if (denied) return denied;
      validate(prayerIdSchema, id);
      const { input, image } = await mutationInput(request, "update");
      const repo = repository("admin");
      const existing = await repo.find(id);
      if (!existing) throw notFound();
      if (existing.updated_at !== input.expectedUpdatedAt) throw conflict();
      let newPath: string | null = null;
      if (image) {
        newPath = `prayers/${id}/${uuid()}.${image.extension}`;
        try { await repo.upload(newPath, image); } catch (error) { await rollback(repo, newPath, id); throw error; }
      }
      const fields = fieldsOf(input);
      const desiredPath = newPath ?? (input.removeImage ? null : existing.image_path);
      let updated: PrayerRow | null;
      try {
        updated = await repo.update(id, input.expectedUpdatedAt, {
          ...fields, image_path: desiredPath, updated_at: now().toISOString(),
        });
      } catch (error) {
        const confirmed = await confirmAfterFailure(repo, id);
        if (confirmed && confirmed.updated_at !== input.expectedUpdatedAt && confirmed.image_path === desiredPath && matchesFields(confirmed, fields)) {
          updated = confirmed;
        } else {
          if (newPath && confirmed?.image_path === newPath) throw conflict();
          await rollback(repo, newPath, id);
          throw error;
        }
      }
      if (!updated) { await rollback(repo, newPath, id); throw conflict(); }
      const warning = newPath || input.removeImage ? await cleanup(repo, existing.image_path, id) : undefined;
      return success(repo, updated, 200, warning);
    }),
    delete: (request: Request, id: string) => run(async () => {
      const denied = guardAdminRequest(request, { mutation: true }); if (denied) return denied;
      validate(prayerIdSchema, id);
      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new PrayerError(415, "JSON_REQUIRED", "삭제 확인 내용을 JSON 형식으로 보내 주세요.");
      const bytes = await boundedBody(request, MAX_PAYLOAD_BYTES);
      let raw: unknown;
      try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new PrayerError(400, "INVALID_JSON", "삭제 확인 내용을 읽지 못했습니다."); }
      const { expectedUpdatedAt } = validate(deletePrayerSchema, raw);
      const repo = repository("admin");
      const existing = await repo.find(id);
      if (!existing) throw notFound();
      if (existing.updated_at !== expectedUpdatedAt) throw conflict();
      let deleted: boolean;
      try { deleted = await repo.delete(id, expectedUpdatedAt); }
      catch (error) {
        const confirmed = await confirmAfterFailure(repo, id);
        if (confirmed) throw error;
        deleted = true;
      }
      if (!deleted) throw conflict();
      const warning = await cleanup(repo, existing.image_path, id);
      return prayerJSON({ data: { id }, ...(warning ? { warning: warning.replace("저장되었습니다", "삭제되었습니다") } : {}) });
    }),
  };
}
