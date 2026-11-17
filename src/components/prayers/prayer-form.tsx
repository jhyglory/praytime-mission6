"use client";

/* eslint-disable @next/next/no-img-element -- Local previews and signed Storage URLs are not public image optimization inputs. */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { Prayer } from "@/lib/prayers/types";
import { MAX_COVER_BYTES, PRAYER_LIMITS } from "@/lib/prayers/schema";
import { nativeCategories, PrayerApiError, prayerRequest, usePrayerResource } from "./api-client";
import { PrayerError, PrayerLoading } from "./prayer-states";

type FormFields = { title: string; content: string; category: string; category_full: string; keyword: string; scripture_ref: string; scripture_text: string; status: "draft" | "published" };
type FieldErrors = Partial<Record<keyof FormFields | "cover", string>>;

export function PrayerEditor({ id }: { id?: string }) {
  if (!id) return <PrayerForm />;
  return <ExistingPrayerEditor id={id} />;
}

function ExistingPrayerEditor({ id }: { id: string }) {
  const resource = usePrayerResource<{ data: Prayer }>(`/api/admin/prayers/${id}`);
  if (resource.loading) return <PrayerLoading label="수정할 기도문을 불러오고 있어요." />;
  if (resource.error) return <PrayerError error={resource.error} retry={resource.reload} admin />;
  return resource.data ? <PrayerForm key={`${resource.data.data.id}:${resource.data.data.updated_at}`} prayer={resource.data.data} /> : null;
}

function PrayerForm({ prayer }: { prayer?: Prayer }) {
  const router = useRouter();
  const [fields, setFields] = useState<FormFields>({
    title: prayer?.title || "", content: prayer?.content || "", category: prayer?.category || "",
    category_full: prayer?.category_full || "", keyword: prayer?.keyword || "",
    scripture_ref: prayer?.scripture_ref || "", scripture_text: prayer?.scripture_text || "", status: prayer?.status || "draft",
  });
  const [customCategory, setCustomCategory] = useState(Boolean(prayer?.category && !nativeCategories[prayer.category]));
  const [cover, setCover] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const saving = useRef(false);
  const clientRequestId = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function field<K extends keyof FormFields>(key: K, value: FormFields[K]) {
    setFields(previous => ({ ...previous, [key]: value }));
    setErrors(previous => ({ ...previous, [key]: undefined }));
  }
  function pickCover(file?: File) {
    if (!file) return;
    const error = !["image/jpeg", "image/png", "image/webp"].includes(file.type) ? "JPG, PNG, WebP 파일을 선택해 주세요." : file.size > MAX_COVER_BYTES ? "이미지는 2MB 이하로 선택해 주세요." : file.size === 0 ? "비어 있는 파일입니다. 다른 이미지를 선택해 주세요." : "";
    setErrors(previous => ({ ...previous, cover: error || undefined }));
    setCover(error ? null : file); setPreview(error ? "" : URL.createObjectURL(file));
    if (!error) setRemoveImage(false);
    else if (fileInput.current) fileInput.current.value = "";
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving.current || conflict) return;
    const invalid: FieldErrors = {};
    if (!fields.title.trim()) invalid.title = "기도문 제목을 입력해 주세요.";
    if (!fields.category.trim()) invalid.category = "카테고리를 선택하거나 입력해 주세요.";
    if (!fields.content.trim()) invalid.content = "기도문 본문을 입력해 주세요.";
    if (errors.cover) invalid.cover = errors.cover;
    setErrors(invalid); setMessage("");
    if (Object.keys(invalid).length) {
      const key = Object.keys(invalid)[0];
      (form.current?.querySelector(`[data-prayer-field="${key}"]`) as HTMLElement | null)?.focus();
      return;
    }
    saving.current = true; setPending(true);
    if (!clientRequestId.current) clientRequestId.current = crypto.randomUUID();
    const payload = {
      ...fields, category_full: fields.category_full || null, keyword: fields.keyword || null,
      scripture_ref: fields.scripture_ref || null, scripture_text: fields.scripture_text || null,
      language: "ko", removeImage,
      ...(prayer ? { expectedUpdatedAt: prayer.updated_at } : { clientRequestId: clientRequestId.current }),
    };
    const body = new FormData(); body.set("payload", JSON.stringify(payload));
    if (cover) body.set("cover", cover);
    try {
      const result = await prayerRequest<{ data: Prayer; warning?: string }>(prayer ? `/api/admin/prayers/${prayer.id}` : "/api/admin/prayers", { method: prayer ? "PATCH" : "POST", body });
      if (result.warning) window.alert(result.warning);
      router.push(`/admin/prayers/${result.data.id}?saved=${prayer ? "updated" : "created"}`);
      router.refresh();
    } catch (reason) {
      if (reason instanceof PrayerApiError) {
        if (reason.status === 409) setConflict(true);
        if (reason.fieldErrors) setErrors(Object.fromEntries(Object.entries(reason.fieldErrors).map(([key, values]) => [key, values[0]])));
      }
      setMessage(reason instanceof Error ? reason.message : "저장하지 못했습니다. 입력한 내용은 유지됩니다. 다시 시도해 주세요.");
    } finally { saving.current = false; setPending(false); }
  }
  const currentCover = preview || (!removeImage ? prayer?.cover_url : null);
  function input(key: "title" | "category_full" | "keyword" | "scripture_ref", label: string, maxLength: number, placeholder: string, required = false) {
    return <div className="m6-form-field"><label htmlFor={`prayer-${key}`}>{label}{required && <span aria-hidden="true"> *</span>}</label><input id={`prayer-${key}`} data-prayer-field={key} name={key} type="text" maxLength={maxLength} required={required} value={fields[key]} onChange={event => field(key, event.target.value)} placeholder={placeholder} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `prayer-${key}-error` : undefined} />{errors[key] && <p className="m6-field-error" id={`prayer-${key}-error`}>{errors[key]}</p>}</div>;
  }
  return <>
    <Link className="m6-back-link" href={prayer ? `/admin/prayers/${prayer.id}` : "/admin/prayers"}>← {prayer ? "상세로 돌아가기" : "목록으로 돌아가기"}</Link>
    <div className="m6-page-heading"><div><p className="m6-eyebrow">{prayer ? "EDIT PRAYER GUIDE" : "NEW PRAYER GUIDE"}</p><h1>{prayer ? "기도문 수정" : "새 기도문 등록"}</h1><p className="m6-lead">한 사람의 잠깐의 멈춤에 함께할 기도를 준비해 주세요.</p></div></div>
    <form className="m6-editor" ref={form} onSubmit={submit} noValidate aria-label={prayer ? "기도문 수정" : "기도문 등록"}>
      <fieldset disabled={pending} className="m6-editor-main">
        <legend className="m6-sr-only">기도문 내용</legend>
        <section className="m6-panel"><div className="m6-panel-heading"><span>01</span><h2>기도의 내용</h2></div><div className="m6-form-fields">
          {input("title", "제목", PRAYER_LIMITS.title, "기도의 주제가 잘 드러나는 제목을 적어 주세요.", true)}
          <div className="m6-form-two-columns"><div className="m6-form-field"><label htmlFor="prayer-category">카테고리 <span aria-hidden="true">*</span></label><select id="prayer-category" data-prayer-field="category" value={customCategory ? "__custom__" : fields.category} onChange={event => { const custom = event.target.value === "__custom__"; setCustomCategory(custom); field("category", custom ? "" : event.target.value); field("category_full", custom ? "" : nativeCategories[event.target.value] || ""); }} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "prayer-category-error" : undefined}><option value="">주제를 선택해 주세요.</option>{Object.keys(nativeCategories).map(category => <option value={category} key={category}>{category}</option>)}<option value="__custom__">직접 입력</option></select>{customCategory && <input aria-label="직접 입력할 카테고리" maxLength={PRAYER_LIMITS.category} value={fields.category} onChange={event => field("category", event.target.value)} placeholder="새 카테고리 이름" />}{errors.category && <p className="m6-field-error" id="prayer-category-error">{errors.category}</p>}</div>{input("keyword", "핵심 키워드", PRAYER_LIMITS.keyword, "선택 입력")}</div>
          {input("category_full", "카테고리 설명", PRAYER_LIMITS.category_full, "예: 마음 관리 & 멘탈 케어")}
          <div className="m6-form-field"><div className="m6-field-label-row"><label htmlFor="prayer-content">기도문 본문 <span aria-hidden="true">*</span></label><span>{fields.content.length.toLocaleString("ko-KR")} / {PRAYER_LIMITS.content.toLocaleString("ko-KR")}</span></div><textarea id="prayer-content" data-prayer-field="content" name="content" required rows={12} maxLength={PRAYER_LIMITS.content} value={fields.content} onChange={event => field("content", event.target.value)} placeholder="함께 읽고 기도할 내용을 적어 주세요." aria-invalid={Boolean(errors.content)} aria-describedby={errors.content ? "prayer-content-error" : "prayer-content-help"} /><p id="prayer-content-help" className="m6-caption">입력한 줄바꿈이 사용자 기도 화면에도 반영됩니다. 개인적인 기도 제목이나 개인정보는 적지 마세요.</p>{errors.content && <p className="m6-field-error" id="prayer-content-error">{errors.content}</p>}</div>
        </div></section>
        <section className="m6-panel"><div className="m6-panel-heading"><span>02</span><h2>함께 읽을 말씀</h2><span className="m6-optional">선택</span></div><div className="m6-form-fields">{input("scripture_ref", "성경 구절", PRAYER_LIMITS.scripture_ref, "예: 빌립보서 4:6–7")}<div className="m6-form-field"><label htmlFor="prayer-scripture-text">말씀 본문</label><textarea id="prayer-scripture-text" rows={4} maxLength={PRAYER_LIMITS.scripture_text} value={fields.scripture_text} onChange={event => field("scripture_text", event.target.value)} placeholder="기도와 함께 읽을 말씀을 적어 주세요." aria-invalid={Boolean(errors.scripture_text)} />{errors.scripture_text && <p className="m6-field-error">{errors.scripture_text}</p>}</div></div></section>
      </fieldset>
      <fieldset disabled={pending} className="m6-editor-side"><legend className="m6-sr-only">이미지와 게시 설정</legend>
        <section className="m6-panel"><h2>대표 이미지</h2><p className="m6-caption">선택 사항 · JPG, PNG, WebP · 최대 2MB</p><div className={`m6-image-preview${currentCover ? "" : " m6-image-preview--empty"}`}>{currentCover ? <img src={currentCover} alt="선택한 기도문 대표 이미지 미리보기" /> : <div><span aria-hidden="true">Ⅱ</span><p>이미지 없이도 등록할 수 있어요.</p></div>}</div><label htmlFor="prayer-cover" className="m6-upload-label">{currentCover ? "다른 이미지 선택" : "이미지 선택"}</label><input id="prayer-cover" data-prayer-field="cover" className="m6-file-input" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => pickCover(event.target.files?.[0])} aria-invalid={Boolean(errors.cover)} aria-describedby="prayer-cover-help" /><p id="prayer-cover-help" className={errors.cover ? "m6-field-error" : "m6-caption"}>{errors.cover || "이미지는 저장을 누르면 업로드됩니다."}</p>{currentCover && <button type="button" className="m6-text-button" onClick={() => { setCover(null); setPreview(""); setRemoveImage(true); setErrors(previous => ({ ...previous, cover: undefined })); if (fileInput.current) fileInput.current.value = ""; }}>이미지 제거</button>}</section>
        <section className="m6-panel"><h2>게시 설정</h2><div className="m6-status-options"><label><input type="radio" name="status" value="draft" checked={fields.status === "draft"} onChange={() => field("status", "draft")} /><span><strong>초안</strong><small>관리자만 볼 수 있어요.</small></span></label><label><input type="radio" name="status" value="published" checked={fields.status === "published"} onChange={() => field("status", "published")} /><span><strong>게시</strong><small>사용자 기도 화면에 공개합니다.</small></span></label></div></section>
        <div className="m6-editor-save"><p className="m6-caption">별표(*) 항목은 필수 입력입니다.</p><Button type="submit" className="m6-button" disabled={conflict} state={pending ? "submitting" : "default"}>{pending ? "저장 중…" : prayer ? "변경 사항 저장" : "기도문 등록하기"}</Button><Link className="m6-text-link" href={prayer ? `/admin/prayers/${prayer.id}` : "/admin/prayers"}>취소하고 돌아가기</Link></div>
      </fieldset>
      {message && <div className="m6-save-error" role="alert"><strong>{conflict ? "다른 변경 사항이 있습니다." : "저장하지 못했어요."}</strong><p>{message}</p><p>입력한 내용은 이 화면에 유지됩니다.</p>{conflict && <button type="button" className="m6-text-button" onClick={() => { if (window.confirm("현재 입력한 내용을 다른 곳에 보관했나요? 최신 내용을 불러오면 이 화면의 입력은 사라집니다.")) window.location.reload(); }}>최신 내용 다시 불러오기</button>}</div>}
    </form>
  </>;
}
