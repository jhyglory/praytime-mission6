import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  comparePrayerRow, createPrayerImportFetch, getPrayerImportConfiguration, mapNativeGuide,
  NATIVE_CATEGORIES, NATIVE_FIELDS, NATIVE_SHA256, parseImportOptions,
  planPrayerImport, PRAYER_PROJECT_URL, projectNativeGuide, readNativeSnapshot,
  sameNativeGuide, validateNativeGuides,
} from "../scripts/import-prayers.mjs";

const { guides } = readNativeSnapshot();
const existingRows = () => guides.map((guide, index) => ({
  ...mapNativeGuide(guide, index),
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  updated_at: "2026-11-12T00:00:00.000Z",
}));

describe("Audited native prayer snapshot", () => {
  it("keeps the exact 89,690 native bytes and the complete original 100-guide order", () => {
    const bytes = readFileSync(new URL("../data/prayer_guides_ko.json", import.meta.url));
    expect(bytes.byteLength).toBe(89690);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(NATIVE_SHA256);
    expect(guides.map(guide => guide.id)).toEqual(Array.from({ length: 100 }, (_, i) => `guide_${String(i + 1).padStart(3, "0")}`));
    for (const [category, expected] of Object.entries(NATIVE_CATEGORIES)) {
      const matching = guides.filter(guide => guide.category === category);
      expect(matching).toHaveLength(expected.count);
      expect(new Set(matching.map(guide => guide.category_full))).toEqual(new Set([expected.full]));
    }
  });

  it("rejects incomplete snapshots, extra fields, missing fields, blank or non-string content and duplicate IDs", () => {
    expect(() => validateNativeGuides(guides.slice(0, 99))).toThrow(/100개/);
    const extra = structuredClone(guides).map((guide, index) => index === 0 ? { ...guide, invented: "no" } : guide);
    expect(() => validateNativeGuides(extra)).toThrow(/8개 필드/);
    const missing = structuredClone(guides);
    delete (missing[0] as unknown as Record<string, unknown>).scripture_kr;
    expect(() => validateNativeGuides(missing)).toThrow(/8개 필드/);
    for (const invalid of [null, 23, [], "  \n "]) {
      const broken = structuredClone(guides);
      (broken[0] as unknown as Record<string, unknown>).prayer_kr = invalid;
      expect(() => validateNativeGuides(broken)).toThrow(/문자열/);
    }
    const duplicates = structuredClone(guides);
    duplicates[1].id = duplicates[0].id;
    expect(() => validateNativeGuides(duplicates)).toThrow(/중복/);
  });

  it("rejects reordered IDs and category drift without silently sorting or repairing input", () => {
    const reordered = structuredClone(guides);
    [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
    expect(() => validateNativeGuides(reordered)).toThrow(/원본 배열 순서/);
    const brokenLabel = structuredClone(guides);
    brokenLabel[0].category_full = "바뀐 분류";
    expect(() => validateNativeGuides(brokenLabel)).toThrow(/대응/);
    const changedCount = structuredClone(guides);
    changedCount[0].category = guides[1].category;
    changedCount[0].category_full = guides[1].category_full;
    expect(() => validateNativeGuides(changedCount)).toThrow(/개수/);
  });

  it("preserves all original fields, whitespace and Korean code points instead of trimming content", () => {
    const special = structuredClone(guides);
    special[0].title_kr = `  ${special[0].title_kr.normalize("NFD")}  `;
    special[0].prayer_kr = `${special[0].prayer_kr}\n기도의 여백\n`;
    validateNativeGuides(special);
    const row = mapNativeGuide(special[0], 0);
    expect(row.title).toBe(special[0].title_kr);
    expect(row.content).toBe(special[0].prayer_kr);
    expect(projectNativeGuide(row)).toEqual(special[0]);
    expect(row.source_payload).toEqual(special[0]);
    expect(row.source_payload).not.toBe(special[0]);
    expect(Object.keys(row.source_payload)).toEqual(NATIVE_FIELDS);
  });

  it("keeps the two original Acts 4:29 text variants as separate guide content", () => {
    const variants = guides.filter(guide => guide.scripture_ref === "사도행전 4:29");
    expect(variants.map(guide => guide.id)).toEqual(["guide_038", "guide_075"]);
    expect(variants[0].scripture_kr).not.toBe(variants[1].scripture_kr);
    expect(variants.map((guide, index) => mapNativeGuide(guide, index).scripture_text)).toEqual(variants.map(guide => guide.scripture_kr));
  });
});

describe("Prayer import planning and idempotency", () => {
  it("creates new drafts with server-generated UUIDs and preserves exact native provenance", () => {
    const plan = planPrayerImport(guides, []);
    expect(plan.toCreate).toHaveLength(100);
    expect(plan.unchanged).toHaveLength(0);
    expect(plan.conflicts).toHaveLength(0);
    expect(plan.toCreate[0]).not.toHaveProperty("id");
    expect(plan.toCreate.every(row => row.status === "draft")).toBe(true);
    expect(plan.toCreate.map(row => row.source_order)).toEqual(Array.from({ length: 100 }, (_, i) => i));
    expect(plan.toCreate[0].source_key).toBe("praytime:ko:guide_001");
    expect(plan.toCreate[0].source_payload).toEqual(guides[0]);
  });

  it("reruns without duplicate inserts and leaves unrelated CMS rows alone", () => {
    const rows = existingRows();
    const unrelated = { source_key: "manual:extra", title: "관리자가 작성한 콘텐츠", content: "보존" };
    const plan = planPrayerImport(guides, [...rows, unrelated]);
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.unchanged).toHaveLength(100);
    expect(plan.conflicts).toHaveLength(0);
    expect(unrelated.content).toBe("보존");
    expect(rows[0].id).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("reports CMS edits and provenance drift as conflicts rather than replacement rows", () => {
    const rows = existingRows();
    rows[0].content = "CMS에서 편집한 기도문";
    rows[1].source_payload.title_kr = "원본과 다른 provenance";
    const plan = planPrayerImport(guides, rows, { publish: true });
    expect(plan.toCreate).toHaveLength(0);
    expect(plan.conflicts).toEqual([
      { source_key: "praytime:ko:guide_001", reasons: ["cms.prayer_kr"] },
      { source_key: "praytime:ko:guide_002", reasons: ["source_payload"] },
    ]);
    expect(plan.toPublish).toHaveLength(98);
    expect(rows[0].content).toBe("CMS에서 편집한 기도문");
    expect(rows[0].source_payload.prayer_kr).toBe(guides[0].prayer_kr);
  });

  it("never silently repairs missing order metadata or duplicate existing source keys", () => {
    const rows = existingRows();
    const missingOrder = { ...rows[0], source_order: null };
    expect(comparePrayerRow(guides[0], 0, missingOrder)).toEqual({ kind: "conflict", reasons: ["source_order"] });
    const plan = planPrayerImport(guides, [...rows, { ...rows[0], id: "another-uuid" }]);
    expect(plan.conflicts).toEqual([{ source_key: "praytime:ko:guide_001", reasons: ["duplicate_existing_source_key"] }]);
    expect(plan.toCreate).toHaveLength(0);
  });

  it("publishes only exact native-matching drafts with a UUID and optimistic updated_at lease", () => {
    const rows = existingRows();
    rows[0].status = "published";
    const plan = planPrayerImport(guides, rows, { publish: true });
    expect(plan.toPublish).toHaveLength(99);
    expect(plan.toPublish[0]).toEqual({ id: rows[1].id, source_key: rows[1].source_key, updated_at: rows[1].updated_at });
    expect(plan.toCreate).toHaveLength(0);
    expect(planPrayerImport(guides, rows).toPublish).toHaveLength(0);
    expect(planPrayerImport(guides, [], { publish: true }).toCreate.every(row => row.status === "published")).toBe(true);
    const noLease = rows.map((row, i) => i === 1 ? { ...row, updated_at: "" } : row);
    expect(planPrayerImport(guides, noLease, { publish: true }).conflicts).toEqual([
      { source_key: "praytime:ko:guide_002", reasons: ["publish_optimistic_metadata_missing"] },
    ]);
  });

  it("preserves independent CMS publication and image choices during native comparison", () => {
    const row = { ...existingRows()[0], status: "published", image_path: "prayer-images/cover.webp" };
    expect(comparePrayerRow(guides[0], 0, row)).toEqual({ kind: "unchanged", reasons: [] });
    expect(sameNativeGuide({ ...guides[0], unexpected: "extra" }, guides[0])).toBe(false);
  });
});

describe("Import command safety", () => {
  it("uses opaque secret keys only in apikey while keeping legacy service JWT authorization", async () => {
    const legacy = `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.test-signature`;
    for (const key of ["sb_secret_test_only_no_live_access", legacy]) {
      const network = vi.fn(async () => Response.json([]));
      const client = createClient(PRAYER_PROJECT_URL, key, {
        global: { fetch: createPrayerImportFetch(key, network) },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      await client.from("prayers").select("source_key");
      expect(network).toHaveBeenCalledTimes(1);
      const [, init] = network.mock.calls[0] as unknown as [unknown, RequestInit];
      const headers = new Headers(init.headers);
      expect(headers.get("apikey")).toBe(key);
      expect(headers.get("Authorization")).toBe(key.startsWith("sb_secret_") ? null : `Bearer ${key}`);
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("defaults to dry-run and requires an explicit supported write flag", () => {
    expect(parseImportOptions([])).toMatchObject({ apply: false, publish: false, validateOnly: false });
    expect(parseImportOptions(["--apply", "--publish"])).toMatchObject({ apply: true, publish: true });
    expect(parseImportOptions(["--validate-only"])).toMatchObject({ apply: false, validateOnly: true });
    for (const args of [["--apply", "--dry-run"], ["--apply", "--validate-only"], ["--override-project"], ["--apply", "--apply"]]) {
      expect(() => parseImportOptions(args)).toThrow(/옵션/);
    }
  });

  it("accepts only the prayer project and a server credential, never the Mission 5 backend", () => {
    const secret = "sb_secret_test_only_no_live_access";
    const config = { PRAYER_SUPABASE_URL: PRAYER_PROJECT_URL, PRAYER_SUPABASE_SECRET_KEY: secret };
    expect(getPrayerImportConfiguration(config)).toEqual({ url: PRAYER_PROJECT_URL, key: secret });
    expect(getPrayerImportConfiguration({})).toBeNull();
    expect(() => getPrayerImportConfiguration({ PRAYER_SUPABASE_URL: PRAYER_PROJECT_URL })).toThrow(/2개/);
    for (const url of ["https://yxiubxjpapiacvhbkxvd.supabase.co", "http://cibcyeyznfmywacfiokh.supabase.co", `${PRAYER_PROJECT_URL}/path`, `${PRAYER_PROJECT_URL}?override=1`, "https://secret@cibcyeyznfmywacfiokh.supabase.co"]) {
      expect(() => getPrayerImportConfiguration({ ...config, PRAYER_SUPABASE_URL: url })).toThrow(/허용된/);
    }
    expect(() => getPrayerImportConfiguration({ ...config, PRAYER_SUPABASE_SECRET_KEY: "sb_publishable_test_only" })).toThrow(/서버 전용/);
    const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.test-signature`;
    expect(() => getPrayerImportConfiguration({ ...config, PRAYER_SUPABASE_SECRET_KEY: jwt("anon") })).toThrow(/서버 전용/);
    expect(getPrayerImportConfiguration({ ...config, PRAYER_SUPABASE_SECRET_KEY: jwt("service_role") })).toEqual({ url: PRAYER_PROJECT_URL, key: jwt("service_role") });
  });
});
