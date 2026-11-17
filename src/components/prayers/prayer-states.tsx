"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PrayerApiError } from "./api-client";

export function PrayerLoading({ label = "기도문을 불러오고 있어요." }: { label?: string }) {
  return <div className="m6-state" role="status"><span className="m6-loading-mark" aria-hidden="true" /><p>{label}</p><div className="m6-skeleton" aria-hidden="true" /><div className="m6-skeleton m6-skeleton--short" aria-hidden="true" /></div>;
}

export function PrayerError({ error, retry, admin = false, inline = false }: { error: PrayerApiError; retry?: () => void; admin?: boolean; inline?: boolean }) {
  const missing = error.status === 404;
  const denied = error.status === 403 || error.status === 401;
  const Heading = inline ? "h2" : "h1";
  return <section className="m6-state" aria-labelledby="m6-error-title" role="alert">
    <span className="m6-state-symbol" aria-hidden="true">{missing ? "―" : "!"}</span>
    <Heading id="m6-error-title">{missing ? "기도문을 찾을 수 없어요." : denied ? "보호된 관리자 공간입니다." : "지금 기도문을 불러오지 못했어요."}</Heading>
    <p>{missing ? "삭제되었거나 아직 게시되지 않은 기도문일 수 있어요. 목록에서 다른 기도문을 골라 주세요." : error.message}</p>
    <div className="m6-actions">
      {!missing && !denied && retry && <Button className="m6-button" onClick={retry}>다시 시도하기</Button>}
      <Button asChild variant="secondary" className="m6-button"><Link href={admin && !denied ? "/admin/prayers" : "/prayers"}>기도문 목록으로</Link></Button>
    </div>
    {denied && <p className="m6-caption">공개 환경에서는 관리자 조회와 쓰기가 제한됩니다. 일반 사용자는 게시된 기도문을 이용할 수 있어요.</p>}
  </section>;
}

export function PrayerEmpty({ admin = false, filtered = false, reset }: { admin?: boolean; filtered?: boolean; reset?: () => void }) {
  return <div className="m6-state m6-state--empty">
    <span className="m6-state-symbol" aria-hidden="true">Ⅱ</span>
    <h2>{filtered ? "조건에 맞는 기도문이 없어요." : admin ? "첫 기도문을 준비해 주세요." : "기도 가이드를 준비하고 있어요."}</h2>
    <p>{filtered ? "다른 카테고리를 선택하거나 전체 목록을 확인해 주세요." : admin ? "기도문을 등록하고 게시하면 사용자 기도 화면에서 만날 수 있습니다." : "게시된 기도문이 아직 없습니다. 잠시 후 다시 찾아 주세요."}</p>
    {filtered && reset ? <Button variant="secondary" className="m6-button" onClick={reset}>전체 목록 보기</Button> : admin ? <Button asChild className="m6-button"><Link href="/admin/prayers/new">기도문 등록하기</Link></Button> : <Link className="m6-text-link" href="/">PrayTime 소개로 돌아가기</Link>}
  </div>;
}

export function PrayerPagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage === 1) return null;
  const start = Math.max(1, Math.min(page - 2, lastPage - 4));
  const pages = Array.from({ length: Math.min(5, lastPage) }, (_, index) => start + index);
  return <nav className="m6-pagination" aria-label="기도문 페이지">
    <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="이전 페이지">←<span className="m6-pagination-word"> 이전</span></button>
    {pages.map(value => <button type="button" key={value} aria-label={`${value}페이지`} aria-current={page === value ? "page" : undefined} onClick={() => onChange(value)}>{value}</button>)}
    <button type="button" disabled={page >= lastPage} onClick={() => onChange(page + 1)} aria-label="다음 페이지"><span className="m6-pagination-word">다음 </span>→</button>
    <span className="m6-sr-only">전체 {lastPage}페이지</span>
  </nav>;
}
