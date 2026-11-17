import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { createPrayerApi, serializePrayer } from "../src/lib/prayers/api";
import { PrayerError } from "../src/lib/prayers/errors";
import { validatePrayerConfiguration } from "../src/lib/prayers/configuration";
import { createPrayerRepository, type PrayerInsert, type PrayerRepository, type PrayerRow, type PrayerScope } from "../src/lib/prayers/repository";
import { createPrayerSchema, isOwnedCoverPath, MAX_CMS_REQUEST_BYTES, MAX_COVER_BYTES, validate, validateCover } from "../src/lib/prayers/schema";

const origin = "http://127.0.0.1:3106";
const id = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const version = "2026-11-17T00:00:00.000Z";
const oldPath = `prayers/${id}/${fileId}.png`;
const input = { title: "잠시 멈추는 기도", content: "주님, 오늘의 선택을 돌아봅니다.", category: "마음", status: "draft", language: "ko" };
const pngBytes = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1]);
const png = () => new File([pngBytes], "untrusted-name.png", { type: "image/png" });
function row(overrides: Partial<PrayerRow> = {}): PrayerRow {
  return {
    id, ...input, language: "ko", status: "draft", category_full: null, keyword: null,
    scripture_ref: null, scripture_text: null, image_path: oldPath, source_key: "praytime:ko:guide_001",
    source_order: 0, created_at: version, updated_at: version,
    source_payload: { id: "guide_001", private_test_marker: "original-provenance" }, ...overrides,
  };
}
function mutation(method: "POST" | "PATCH", payload: unknown, image?: File) {
  const form = new FormData();
  form.set("payload", JSON.stringify(payload));
  if (image) form.set("cover", image);
  return new Request(`${origin}/api/admin/prayers${method === "PATCH" ? `/${id}` : ""}`, { method, headers: { origin }, body: form });
}
function deletion(expectedUpdatedAt = version) {
  return new Request(`${origin}/api/admin/prayers/${id}`, { method: "DELETE", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ expectedUpdatedAt }) });
}
function memory(initial: PrayerRow[] = []) {
  const rows = new Map(initial.map(item => [item.id, structuredClone(item)]));
  const files = new Set(initial.flatMap(item => item.image_path ? [item.image_path] : []));
  const events: string[] = [];
  const repo = {
    list: vi.fn(async () => ({ rows: [...rows.values()], total: rows.size })),
    categories: vi.fn(async () => [...new Set([...rows.values()].flatMap(item => item.category ? [item.category] : []))]),
    find: vi.fn(async (key: string) => rows.get(key) ?? null),
    insert: vi.fn(async (record: PrayerInsert) => {
      events.push("insert");
      if (rows.has(record.id)) return { row: null, duplicate: true };
      const result: PrayerRow = { ...record, created_at: version, updated_at: version };
      rows.set(record.id, result);
      return { row: result, duplicate: false };
    }),
    update: vi.fn<PrayerRepository["update"]>(async (key, expected, fields) => {
      events.push("update");
      const current = rows.get(key);
      if (!current || current.updated_at !== expected) return null;
      const result = { ...current, ...fields };
      rows.set(key, result);
      return result;
    }),
    delete: vi.fn<PrayerRepository["delete"]>(async (key, expected) => {
      events.push("delete");
      if (rows.get(key)?.updated_at !== expected) return false;
      return rows.delete(key);
    }),
    upload: vi.fn<PrayerRepository["upload"]>(async path => { events.push("upload"); files.add(path); }),
    remove: vi.fn<PrayerRepository["remove"]>(async path => { events.push(`remove:${path}`); files.delete(path); return true; }),
    sign: vi.fn<PrayerRepository["sign"]>(async () => new Map()),
  } satisfies PrayerRepository;
  const repository = vi.fn<(scope: PrayerScope) => PrayerRepository>(() => repo);
  return { rows, files, events, repo, repository, api: createPrayerApi({ repository, uuid: () => otherId, now: () => new Date("2026-11-17T00:01:00Z") }) };
}

beforeEach(() => {
  vi.stubEnv("CMS_ADMIN_MODE", "local");
  vi.stubEnv("CMS_DEMO_ENV", "true");
  vi.stubEnv("VERCEL", "");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request in CMS unit test"); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("CMS validation and response boundaries", () => {
  it("refuses the Mission5 backend and missing or wrongly privileged keys before constructing a client", () => {
    expect(() => validatePrayerConfiguration("https://yxiubxjpapiacvhbkxvd.supabase.co", "sb_secret_mock_only", "admin")).toThrow(PrayerError);
    expect(() => validatePrayerConfiguration(undefined, undefined, "public")).toThrow(PrayerError);
    expect(() => validatePrayerConfiguration("https://example.supabase.co", "sb_secret_mock_only", "public")).toThrow(PrayerError);
    expect(() => validatePrayerConfiguration("https://example.supabase.co", "sb_publishable_mock_only", "admin")).toThrow(PrayerError);
  });
  it("normalizes optional fields and rejects source payload injection", () => {
    expect(validate(createPrayerSchema, { ...input, title: "  기도  ", category: "  ", clientRequestId: id })).toMatchObject({ title: "기도", category: null });
    expect(() => validate(createPrayerSchema, { ...input, clientRequestId: id, source_payload: {} })).toThrow(PrayerError);
    expect(() => validate(createPrayerSchema, { ...input, title: " ", clientRequestId: id })).toThrow(PrayerError);
    expect(() => validate(createPrayerSchema, { ...input, language: "en", clientRequestId: id })).toThrow(PrayerError);
    expect(() => validate(createPrayerSchema, { ...input, status: "public", clientRequestId: id })).toThrow(PrayerError);
  });
  it("checks image bytes and MIME rather than the supplied name", async () => {
    expect((await validateCover(png())).extension).toBe("png");
    await expect(validateCover(new File(["<svg>unsafe</svg>"], "looks-like.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ status: 415 });
    await expect(validateCover(new File([pngBytes], "file.jpg", { type: "image/jpeg" }))).rejects.toMatchObject({ status: 415 });
    await expect(validateCover(new File([new Uint8Array(MAX_COVER_BYTES + 1)], "large.png", { type: "image/png" }))).rejects.toMatchObject({ status: 413 });
  });
  it("only permits UUID paths owned by the specific prayer", () => {
    expect(isOwnedCoverPath(oldPath, id)).toBe(true);
    for (const path of [`prayers/${otherId}/${fileId}.png`, `prayers/${id}/../private.png`, `https://evil.example/${id}.png`, `prayers/${id}/${fileId}.svg`]) expect(isOwnedCoverPath(path, id)).toBe(false);
  });
  it("never serializes provenance or arbitrary DB properties", () => {
    const serialized = serializePrayer(row());
    expect(serialized).not.toHaveProperty("source_payload");
    expect(JSON.stringify(serialized)).not.toContain("original-provenance");
    expect(serialized.source_key).toBe("praytime:ko:guide_001");
  });
  it("fails with a clear503 and sanitizes unexpected upstream errors", async () => {
    const api = createPrayerApi({ repository: () => { throw new PrayerError(503, "CMS_NOT_CONFIGURED", "설정이 필요합니다."); } });
    const response = await api.publicList(new Request(`${origin}/api/prayers`));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("CMS_NOT_CONFIGURED");
    const bad = createPrayerApi({ repository: () => { throw new Error("must-not-expose-credential-or-stack"); } });
    expect(await (await bad.publicList(new Request(`${origin}/api/prayers`))).text()).not.toContain("must-not-expose");
  });
  it("bounds actual streamed request bytes when content-length is absent", async () => {
    const { api, repository } = memory();
    const request = new Request(`${origin}/api/admin/prayers`, { method: "POST", headers: { origin, "content-type": "multipart/form-data; boundary=test" }, body: new Uint8Array(MAX_CMS_REQUEST_BYTES + 1) });
    expect(request.headers.get("content-length")).toBeNull();
    expect((await api.create(request)).status).toBe(413);
    expect(repository).not.toHaveBeenCalled();
  });
});

describe("CMS read scope and access", () => {
  it("returns draft public details as404 without signing an image", async () => {
    const { api, repo } = memory([row()]);
    expect((await api.publicDetail(new Request(`${origin}/api/prayers/${id}`), id)).status).toBe(404);
    expect(repo.sign).not.toHaveBeenCalled();
  });
  it("passes page/category/status to admin pagination and keeps total/categories", async () => {
    const { api, repo } = memory();
    repo.list.mockResolvedValue({ rows: [], total: 27 });
    repo.categories.mockResolvedValue(["마음", "관계"]);
    const response = await api.adminList(new Request(`${origin}/api/admin/prayers?page=4&pageSize=10&category=마음&status=draft`));
    expect(await response.json()).toEqual({ data: [], total: 27, page: 4, pageSize: 10, categories: ["마음", "관계"] });
    expect(repo.list).toHaveBeenCalledWith({ page: 4, pageSize: 10, category: "마음", status: "draft" });
  });
  it("rejects disabled admin reads and writes before touching the repository", async () => {
    vi.stubEnv("CMS_ADMIN_MODE", "disabled");
    const { api, repository } = memory();
    expect((await api.adminList(new Request(`${origin}/api/admin/prayers`))).status).toBe(403);
    expect((await api.adminDetail(new Request(`${origin}/api/admin/prayers/${id}`), id)).status).toBe(403);
    expect((await api.create(mutation("POST", {}))).status).toBe(403);
    expect((await api.update(mutation("PATCH", {}), id)).status).toBe(403);
    expect((await api.delete(deletion(), id)).status).toBe(403);
    expect(repository).not.toHaveBeenCalled();
  });
  it("rejects invalid pagination rather than issuing an unbounded query", async () => {
    const { api, repository } = memory();
    expect((await api.publicList(new Request(`${origin}/api/prayers?page=0&pageSize=999`))).status).toBe(400);
    expect(repository).not.toHaveBeenCalled();
  });
  it("uses exact public columns, stable range and a published filter in the SDK query", async () => {
    const network = vi.fn(async () => Response.json([row({ status: "published" })], { headers: { "content-range": "9-9/27" } }));
    const client = createClient("https://example.supabase.co", "sb_publishable_mock_only", { global: { fetch: network }, auth: { persistSession: false } });
    const repo = createPrayerRepository(client, "public");
    const result = await repo.list({ page: 2, pageSize: 9, status: "draft", category: "마음" });
    expect(result.total).toBe(27);
    const [requestUrl] = network.mock.calls[0] as unknown as [string];
    const url = new URL(requestUrl);
    expect(url.searchParams.get("select")).not.toContain("source_payload");
    expect(url.searchParams.get("status")).toBe("eq.published");
    expect(url.searchParams.get("category")).toBe("eq.마음");
    expect(url.searchParams.get("offset")).toBe("9");
    expect(url.searchParams.get("limit")).toBe("9");
    expect(url.searchParams.get("order")).toContain("source_order");
    expect(await repo.sign([row()])).toEqual(new Map());
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("orders admin pages by latest update with a stable ID tie-breaker", async () => {
    const network = vi.fn(async () => Response.json([], { headers: { "content-range": "*/0" } }));
    const client = createClient("https://example.supabase.co", "sb_secret_mock_only", { global: { fetch: network }, auth: { persistSession: false } });
    await createPrayerRepository(client, "admin").list({ page: 1, pageSize: 10 });
    const [requestUrl] = network.mock.calls[0] as unknown as [string];
    const url = new URL(requestUrl);
    expect(url.searchParams.get("order")).toBe("updated_at.desc,id.asc");
    expect(url.searchParams.get("order")).not.toContain("source_order");
  });
});

describe("CMS write consistency", () => {
  it("creates one row for repeated client requests and uploads only once", async () => {
    const { api, rows, repo } = memory();
    const first = await api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    const repeated = await api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    expect(first.status).toBe(201);
    expect(repeated.status).toBe(200);
    expect((await repeated.json()).replayed).toBe(true);
    expect(rows.size).toBe(1);
    expect(repo.insert).toHaveBeenCalledTimes(1);
    expect(repo.upload).toHaveBeenCalledTimes(1);
    expect(rows.get(id)?.source_payload).toMatchObject({ id: `cms_${id}`, category: "마음", category_full: "", title_kr: input.title, keyword_kr: "", scripture_ref: "", scripture_kr: "", prayer_kr: input.content,
      _cms_create_image_sha256: expect.stringMatching(/^[a-f0-9]{64}$/), _cms_create_image_mime: "image/png" });
    expect((await first.json()).data).not.toHaveProperty("source_payload");
  });
  it("rejects reusing a successful request ID for different content", async () => {
    const { api, repo } = memory();
    await api.create(mutation("POST", { ...input, clientRequestId: id }));
    const second = await api.create(mutation("POST", { ...input, title: "변경된 제목", clientRequestId: id }));
    expect(second.status).toBe(409);
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });
  it("rejects the same request ID with different cover bytes even when text is unchanged", async () => {
    const { api, repo } = memory();
    await api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    const different = new File([pngBytes, new Uint8Array([1])], "another.png", { type: "image/png" });
    const response = await api.create(mutation("POST", { ...input, clientRequestId: id }, different));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("REQUEST_ID_REUSED");
    expect(repo.upload).toHaveBeenCalledTimes(1);
    expect(repo.insert).toHaveBeenCalledTimes(1);
  });
  it("rejects adding or dropping a cover when replaying a completed create", async () => {
    const without = memory();
    await without.api.create(mutation("POST", { ...input, clientRequestId: id }));
    expect((await without.api.create(mutation("POST", { ...input, clientRequestId: id }, png()))).status).toBe(409);
    const withCover = memory();
    await withCover.api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    expect((await withCover.api.create(mutation("POST", { ...input, clientRequestId: id }))).status).toBe(409);
  });
  it("rolls back a new file when the database insert fails", async () => {
    const { api, files, rows, repo } = memory();
    repo.insert.mockRejectedValueOnce(new PrayerError(503, "DATABASE_UNAVAILABLE", "저장 실패"));
    expect((await api.create(mutation("POST", { ...input, clientRequestId: id }, png()))).status).toBe(503);
    expect(rows.size).toBe(0);
    expect(files.size).toBe(0);
    expect(repo.remove).toHaveBeenCalledWith(`prayers/${id}/${otherId}.png`);
  });
  it("resolves concurrent duplicate inserts without leaving this request's extra image", async () => {
    const { api, repo, rows, files } = memory();
    repo.insert.mockImplementationOnce(async record => {
      const winner: PrayerRow = { ...record, image_path: oldPath, created_at: version, updated_at: version };
      rows.set(id, winner);
      files.add(oldPath);
      return { row: null, duplicate: true };
    });
    const response = await api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    expect(response.status).toBe(200);
    expect((await response.json()).replayed).toBe(true);
    expect(rows.size).toBe(1);
    expect(files).toEqual(new Set([oldPath]));
  });
  it("preserves a linked image when the insert committed but its response was lost", async () => {
    const { api, repo, rows, files } = memory();
    repo.insert.mockImplementationOnce(async record => {
      rows.set(id, { ...record, created_at: version, updated_at: version });
      throw new Error("simulated response timeout after commit");
    });
    const response = await api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    expect(response.status).toBe(201);
    expect(files.has(rows.get(id)!.image_path!)).toBe(true);
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it("reports an unconfirmed save and preserves its file when readback also fails", async () => {
    const { api, repo, files } = memory();
    repo.insert.mockRejectedValueOnce(new Error("ambiguous insert timeout"));
    repo.find.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("readback unavailable"));
    const response = await api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("SAVE_UNCONFIRMED");
    expect(files.size).toBe(1);
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it("reports a failed rollback explicitly rather than claiming storage cleanup", async () => {
    const { api, repo, rows, files } = memory();
    repo.insert.mockRejectedValueOnce(new Error("database insert rejected"));
    repo.remove.mockResolvedValueOnce(false);
    const response = await api.create(mutation("POST", { ...input, clientRequestId: id }, png()));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("IMAGE_ROLLBACK_FAILED");
    expect(rows.size).toBe(0);
    expect(files.size).toBe(1);
  });
  it("rejects stale edits before uploading and protects the old cover", async () => {
    const { api, repo, files } = memory([row()]);
    const response = await api.update(mutation("PATCH", { ...input, expectedUpdatedAt: "2026-11-16T00:00:00.000Z" }, png()), id);
    expect(response.status).toBe(409);
    expect(repo.upload).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
    expect(files.has(oldPath)).toBe(true);
  });
  it("rolls back only the new file when a concurrent edit wins after upload", async () => {
    const { api, repo, files } = memory([row()]);
    repo.update.mockResolvedValueOnce(null);
    expect((await api.update(mutation("PATCH", { ...input, expectedUpdatedAt: version }, png()), id)).status).toBe(409);
    expect(files).toEqual(new Set([oldPath]));
    expect(repo.remove).not.toHaveBeenCalledWith(oldPath);
  });
  it("links the new cover before removing the old one and preserves original payload", async () => {
    const original = row();
    const { api, repo, rows, files, events } = memory([original]);
    expect((await api.update(mutation("PATCH", { ...input, title: "새 제목", expectedUpdatedAt: version }, png()), id)).status).toBe(200);
    expect(rows.get(id)?.source_payload).toEqual(original.source_payload);
    expect(rows.get(id)?.image_path).toBe(`prayers/${id}/${otherId}.png`);
    expect(files.has(oldPath)).toBe(false);
    expect(events.indexOf("update")).toBeLessThan(events.indexOf(`remove:${oldPath}`));
    expect(repo.update.mock.calls[0][2]).not.toHaveProperty("source_payload");
  });
  it("recovers an update committed before a response timeout without deleting its linked cover", async () => {
    const { api, repo, rows, files } = memory([row()]);
    repo.update.mockImplementationOnce(async (...args) => {
      const fields = args[2];
      rows.set(id, { ...rows.get(id)!, ...fields });
      throw new Error("simulated response loss after update commit");
    });
    const response = await api.update(mutation("PATCH", { ...input, title: "수정된 제목", expectedUpdatedAt: version }, png()), id);
    expect(response.status).toBe(200);
    expect(rows.get(id)?.title).toBe("수정된 제목");
    expect(files).toEqual(new Set([`prayers/${id}/${otherId}.png`]));
    expect(repo.remove).not.toHaveBeenCalledWith(`prayers/${id}/${otherId}.png`);
  });
  it("keeps a successful save and reports a failed old-file cleanup", async () => {
    const { api, repo, rows } = memory([row()]);
    repo.remove.mockResolvedValue(false);
    const response = await api.update(mutation("PATCH", { ...input, removeImage: true, expectedUpdatedAt: version }), id);
    expect(response.status).toBe(200);
    expect((await response.json()).warning).toContain("관리자 확인");
    expect(rows.get(id)?.image_path).toBeNull();
  });
  it("does not remove an image owned by another prayer even if an old row is malformed", async () => {
    const { api, repo } = memory([row({ image_path: `prayers/${otherId}/${fileId}.png` })]);
    const response = await api.update(mutation("PATCH", { ...input, removeImage: true, expectedUpdatedAt: version }), id);
    expect(response.status).toBe(200);
    expect((await response.json()).warning).toContain("보류");
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it("keeps files if a conditional delete loses a race", async () => {
    const { api, repo, files } = memory([row()]);
    repo.delete.mockResolvedValueOnce(false);
    expect((await api.delete(deletion(), id)).status).toBe(409);
    expect(files.has(oldPath)).toBe(true);
    expect(repo.remove).not.toHaveBeenCalled();
  });
  it("deletes the row before cleaning its cover and explicitly warns on cleanup failure", async () => {
    const { api, repo, rows, events } = memory([row()]);
    repo.remove.mockResolvedValue(false);
    const response = await api.delete(deletion(), id);
    expect(response.status).toBe(200);
    expect(rows.size).toBe(0);
    expect(events[0]).toBe("delete");
    expect((await response.json()).warning).toContain("삭제되었습니다");
  });
  it("confirms an ambiguous successful delete before removing its cover", async () => {
    const { api, repo, rows, files } = memory([row()]);
    repo.delete.mockImplementationOnce(async () => {
      rows.delete(id);
      throw new Error("simulated response loss after delete commit");
    });
    expect((await api.delete(deletion(), id)).status).toBe(200);
    expect(rows.size).toBe(0);
    expect(files.size).toBe(0);
  });
});
