import { z } from "zod";
import { PrayerError } from "./errors";

export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export const MAX_CMS_REQUEST_BYTES = MAX_COVER_BYTES + 64 * 1024;
export const MAX_PAYLOAD_BYTES = 48 * 1024;
export const PRAYER_LIMITS = {
  title: 120, content: 10_000, category: 60, category_full: 120,
  keyword: 100, scripture_ref: 160, scripture_text: 2_000,
} as const;

const text = (max: number) => z.string({ error: "문자 형식으로 입력해 주세요." }).trim()
  .max(max, `${max}자 이하로 입력해 주세요.`)
  .refine(value => !value.includes("\0"), "사용할 수 없는 문자가 포함되어 있습니다.");
const optionalText = (max: number) => text(max).nullable().optional().transform(value => value || null);
const fields = {
  title: text(PRAYER_LIMITS.title).refine(value => value.length > 0, "제목을 입력해 주세요."),
  content: text(PRAYER_LIMITS.content).refine(value => value.length > 0, "기도문을 입력해 주세요."),
  category: optionalText(PRAYER_LIMITS.category),
  category_full: optionalText(PRAYER_LIMITS.category_full),
  keyword: optionalText(PRAYER_LIMITS.keyword),
  scripture_ref: optionalText(PRAYER_LIMITS.scripture_ref),
  scripture_text: optionalText(PRAYER_LIMITS.scripture_text),
  status: z.enum(["draft", "published"], { error: "임시저장 또는 공개 상태를 선택해 주세요." }).default("draft"),
  language: z.literal("ko", { error: "현재 한국어 기도문만 지원합니다." }).default("ko"),
  removeImage: z.boolean({ error: "이미지 삭제 여부를 확인해 주세요." }).default(false),
};

export const prayerIdSchema = z.uuid({ error: "기도문 식별자 형식을 확인해 주세요." });
export const versionSchema = z.iso.datetime({ offset: true, error: "최신 수정 시각을 확인할 수 없습니다. 화면을 새로고침해 주세요." });
export const createPrayerSchema = z.object({ ...fields, clientRequestId: prayerIdSchema }).strict();
export const updatePrayerSchema = z.object({ ...fields, expectedUpdatedAt: versionSchema }).strict();
export const deletePrayerSchema = z.object({ expectedUpdatedAt: versionSchema }).strict();
export type PrayerFields = Omit<z.infer<typeof createPrayerSchema>, "clientRequestId" | "removeImage">;
export type CreatePrayerInput = z.infer<typeof createPrayerSchema>;
export type UpdatePrayerInput = z.infer<typeof updatePrayerSchema>;

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.code === "unrecognized_keys" ? "지원하지 않는 입력 항목이 포함되어 있습니다." : issue.message);
  }
  throw new PrayerError(400, "VALIDATION_ERROR", "입력 내용을 확인해 주세요.", fieldErrors);
}

export interface CoverUpload { bytes: Uint8Array; mime: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp" }

export async function validateCover(file: File): Promise<CoverUpload> {
  if (file.size > MAX_COVER_BYTES) throw new PrayerError(413, "IMAGE_TOO_LARGE", "표지 이미지는 2MB 이하로 선택해 주세요.", { cover: ["2MB 이하의 파일만 업로드할 수 있습니다."] });
  if (file.size === 0) throw new PrayerError(400, "EMPTY_IMAGE", "비어 있는 이미지 파일입니다.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
    && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR";
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 16 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    && ["VP8 ", "VP8L", "VP8X"].includes(String.fromCharCode(...bytes.slice(12, 16)));
  const expected = png ? "image/png" : jpeg ? "image/jpeg" : webp ? "image/webp" : null;
  if (!expected || file.type !== expected) throw new PrayerError(415, "INVALID_IMAGE_TYPE", "실제 JPG, PNG, WebP 이미지 파일만 업로드해 주세요.", { cover: ["파일 내용과 이미지 형식이 일치해야 합니다."] });
  return { bytes, mime: expected, extension: expected === "image/jpeg" ? "jpg" : expected === "image/png" ? "png" : "webp" };
}

/** Paths are server-generated; a row can only own files beneath its own UUID. */
export function isOwnedCoverPath(path: string | null | undefined, prayerId: string): path is string {
  if (!path || !prayerIdSchema.safeParse(prayerId).success) return false;
  const parts = /^prayers\/([0-9a-f-]{36})\/([0-9a-f-]{36})\.(jpg|jpeg|png|webp)$/.exec(path);
  return !!parts && parts[1] === prayerId && prayerIdSchema.safeParse(parts[2]).success;
}
