"use client";

/* eslint-disable @next/next/no-img-element -- Covers use short-lived, server-issued Storage URLs. */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { Prayer } from "@/lib/prayers/types";
import { readableDate, usePrayerResource } from "./api-client";
import { DeletePrayer } from "./delete-prayer";
import { PrayerError, PrayerLoading } from "./prayer-states";

export function PrayerText({ prayer }: { prayer: Prayer }) {
  return <div className="m6-prayer-reading">
    {prayer.scripture_text && <blockquote className="m6-scripture"><p>{prayer.scripture_text}</p>{prayer.scripture_ref && <cite>{prayer.scripture_ref}</cite>}</blockquote>}
    {!prayer.scripture_text && prayer.scripture_ref && <p className="m6-scripture-reference">{prayer.scripture_ref}</p>}
    <section aria-label="기도문 본문" className="m6-prayer-body">{prayer.content}</section>
  </div>;
}

export function PrayerDetail({ id, admin = false }: { id: string; admin?: boolean }) {
  const resource = usePrayerResource<{ data: Prayer }>(`${admin ? "/api/admin/prayers" : "/api/prayers"}/${id}`);
  const router = useRouter();
  const query = useSearchParams();
  if (resource.loading) return <PrayerLoading />;
  if (resource.error) return <PrayerError error={resource.error} retry={resource.reload} admin={admin} />;
  if (!resource.data) return null;
  const prayer = resource.data.data;
  return <>
    <Link href={admin ? "/admin/prayers" : "/prayers"} className="m6-back-link">← {admin ? "기도문 관리 목록" : "다른 기도문 살펴보기"}</Link>
    {admin && ["created", "updated"].includes(query.get("saved") || "") && <div role="status" className="m6-success-note">{query.get("saved") === "created" ? "새 기도문을 등록했습니다." : "변경 사항을 저장했습니다."} {prayer.status === "published" ? "사용자 기도 화면에도 반영되었습니다." : "초안으로 저장되어 관리자만 볼 수 있습니다."}</div>}
    <article className={`m6-detail${admin ? " m6-detail--admin" : ""}`}>
      <header className="m6-detail-heading"><div className="m6-detail-tags"><span className="m6-category-pill">{prayer.category || "기도"}</span>{admin && <span className={`m6-status${prayer.status === "published" ? " m6-status--published" : ""}`}>{prayer.status === "published" ? "게시 중" : "초안"}</span>}{prayer.keyword && <span className="m6-keyword">{prayer.keyword}</span>}</div><h1>{prayer.title}</h1>{prayer.category_full && <p className="m6-detail-subtitle">{prayer.category_full}</p>}</header>
      {prayer.cover_url && <div className="m6-detail-cover"><img src={prayer.cover_url} alt="기도문 대표 이미지" /></div>}
      <PrayerText prayer={prayer} />
      {admin ? <>
        <dl className="m6-detail-metadata"><div><dt>등록일</dt><dd><time dateTime={prayer.created_at}>{readableDate(prayer.created_at)}</time></dd></div><div><dt>수정일</dt><dd><time dateTime={prayer.updated_at}>{readableDate(prayer.updated_at)}</time></dd></div><div><dt>콘텐츠 ID</dt><dd>{prayer.id}</dd></div>{prayer.source_key && <div><dt>원본 연결 ID</dt><dd>{prayer.source_key}</dd></div>}</dl>
        <div className="m6-detail-actions"><div className="m6-actions"><Button asChild className="m6-button"><Link href={`/admin/prayers/${id}/edit`}>기도문 수정</Link></Button>{prayer.status === "published" && <Button asChild variant="secondary" className="m6-button"><Link href={`/prayers/${id}`}>사용자 화면 보기</Link></Button>}</div><DeletePrayer prayer={prayer} onDeleted={() => { router.push("/admin/prayers"); router.refresh(); }} /></div>
        {prayer.status === "draft" && <p className="m6-caption">사용자에게 공개하려면 수정 화면의 게시 설정을 ‘게시’로 변경해 주세요.</p>}
      </> : <div className="m6-detail-pray"><p>읽은 말씀과 함께, 잠깐 기도해 볼까요?</p><Button asChild className="m6-button"><Link href={`/prayers/${id}/pray`}>기도 시작하기 <span aria-hidden="true">→</span></Link></Button><p className="m6-caption">나만의 기도 내용은 입력하거나 저장하지 않습니다.</p></div>}
    </article>
  </>;
}
