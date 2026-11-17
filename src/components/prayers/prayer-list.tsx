"use client";

/* eslint-disable @next/next/no-img-element -- Covers use short-lived, server-issued Storage URLs. */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { nativeCategories, readableDate, usePrayerResource, type PrayerPage } from "./api-client";
import { DeletePrayer } from "./delete-prayer";
import { PrayerEmpty, PrayerError, PrayerLoading, PrayerPagination } from "./prayer-states";

export function PrayerList({ admin = false }: { admin?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const requestedPage = Number(search.get("page") || 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const category = search.get("category") || "";
  const status = admin && ["draft", "published"].includes(search.get("status") || "") ? search.get("status")! : "";
  const query = new URLSearchParams({ page: String(page), pageSize: admin ? "10" : "9" });
  if (category) query.set("category", category);
  if (status) query.set("status", status);
  const resource = usePrayerResource<PrayerPage>(`${admin ? "/api/admin/prayers" : "/api/prayers"}?${query}`);
  function navigate(changes: Record<string, string>) {
    const next = new URLSearchParams(search.toString());
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    router.push(`${pathname}${next.size ? `?${next}` : ""}`);
  }
  const categories = admin
    ? [...new Set([...Object.keys(nativeCategories), ...(resource.data?.categories || []), ...(category ? [category] : [])])]
    : [...new Set([...(resource.data?.categories || []), ...(category ? [category] : [])])];
  return <>
    <div className="m6-page-heading">
      <div><p className="m6-eyebrow">{admin ? "PRAYTIME CONTENT MANAGER" : "A MOMENT FOR PRAYER"}</p><h1>{admin ? "기도 가이드 관리" : <>지금, 어떤 기도가<br className="m6-mobile-break" /> 필요한가요?</>}</h1><p className="m6-lead">{admin ? "기도의 시간을 준비하는 글을 등록하고, 다듬고, 게시하세요." : "마음에 가까운 주제를 고르고, 기도하며 잠깐 멈춰 보세요."}</p></div>
      {admin && !resource.error && <Button asChild className="m6-button"><Link href="/admin/prayers/new"><span aria-hidden="true">＋</span> 기도문 등록</Link></Button>}
    </div>
    {resource.error ? <PrayerError error={resource.error} retry={resource.reload} admin={admin} inline /> : <>
      <section className="m6-toolbar" aria-label="기도문 목록 필터">
        <div className="m6-filter"><label htmlFor="prayer-category-filter">카테고리</label><select id="prayer-category-filter" value={category} onChange={event => navigate({ category: event.target.value, page: "" })}><option value="">전체 주제</option>{categories.map(value => <option value={value} key={value}>{value}</option>)}</select></div>
        {admin && <div className="m6-filter"><label htmlFor="prayer-status-filter">게시 상태</label><select id="prayer-status-filter" value={status} onChange={event => navigate({ status: event.target.value, page: "" })}><option value="">전체 상태</option><option value="draft">초안</option><option value="published">게시 중</option></select></div>}
        <p className="m6-result-count" aria-live="polite">{resource.loading ? "목록 확인 중…" : <>총 <strong>{resource.data?.total || 0}</strong>개의 기도문</>}</p>
      </section>
      {resource.loading ? <PrayerLoading /> : !resource.data?.data.length ? <PrayerEmpty admin={admin} filtered={Boolean(category || status || page > 1)} reset={() => router.push(pathname)} /> : <>
        {admin ? <div className="m6-admin-list" aria-label="기도문 관리 목록">
          <div className="m6-admin-table-heading" aria-hidden="true"><span>기도문</span><span>카테고리</span><span>게시 상태</span><span>수정일</span><span>관리</span></div>
          {resource.data.data.map(prayer => <article className="m6-admin-row" key={prayer.id}>
            <div className="m6-admin-prayer-title"><div className="m6-thumb" aria-hidden="true">{prayer.cover_url ? <img src={prayer.cover_url} alt="" /> : <span>Ⅱ</span>}</div><div><Link href={`/admin/prayers/${prayer.id}`}>{prayer.title}</Link><p>{prayer.scripture_ref || "성경 구절 미등록"}</p></div></div>
            <span className="m6-row-category"><span className="m6-mobile-label">카테고리</span>{prayer.category || "미분류"}</span>
            <span><span className={`m6-status ${prayer.status === "published" ? "m6-status--published" : ""}`}>{prayer.status === "published" ? "게시 중" : "초안"}</span></span>
            <time dateTime={prayer.updated_at} className="m6-row-date"><span className="m6-mobile-label">수정일</span>{readableDate(prayer.updated_at)}</time>
            <div className="m6-row-actions"><Link href={`/admin/prayers/${prayer.id}`} aria-label={`상세: ${prayer.title}`}>상세</Link><Link href={`/admin/prayers/${prayer.id}/edit`} aria-label={`수정: ${prayer.title}`}>수정</Link><DeletePrayer prayer={prayer} onDeleted={resource.reload} /></div>
          </article>)}
        </div> : <div className="m6-prayer-grid">
          {resource.data.data.map(prayer => <article className="m6-prayer-card" key={prayer.id}>
            <Link href={`/prayers/${prayer.id}`} className="m6-card-link">
              <div className={`m6-card-cover${prayer.cover_url ? "" : " m6-card-cover--empty"}`}>
                {prayer.cover_url ? <img src={prayer.cover_url} alt="" loading="lazy" /> : <><span className="m6-card-pause" aria-hidden="true"><i /><i /></span><span className="m6-card-cover-word" aria-hidden="true">PAUSE · PRAY · CHOOSE</span></>}
                <span className="m6-card-category">{prayer.category || "기도"}</span>
              </div>
              <div className="m6-card-content"><p className="m6-card-keyword">{prayer.keyword || "잠깐의 기도"}</p><h2>{prayer.title}</h2><p className="m6-card-excerpt">{prayer.content}</p><div className="m6-card-bottom"><span>{prayer.scripture_ref || "기도 가이드"}</span><span>기도문 읽기 <span aria-hidden="true">↗</span></span></div></div>
            </Link>
          </article>)}
        </div>}
        <PrayerPagination page={resource.data.page} pageSize={resource.data.pageSize} total={resource.data.total} onChange={value => navigate({ page: String(value) })} />
      </>}
    </>}
    {!admin && <aside className="m6-experience-note"><span aria-hidden="true">Ⅱ</span><p>이곳은 기도 콘텐츠를 읽고 기도하는 웹 체험입니다.<br />실제 SNS 앱의 접근을 제한하거나 사용 기록을 저장하지 않습니다.</p></aside>}
  </>;
}
