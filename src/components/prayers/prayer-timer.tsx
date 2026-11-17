"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Prayer } from "@/lib/prayers/types";
import { usePrayerResource } from "./api-client";
import { PrayerText } from "./prayer-detail";
import { PrayerError, PrayerLoading } from "./prayer-states";

export function PrayerTimer({ id }: { id: string }) {
  const resource = usePrayerResource<{ data: Prayer }>(`/api/prayers/${id}`);
  const router = useRouter();
  const [state, setState] = useState<"ready" | "running" | "paused">("ready");
  const [elapsed, setElapsed] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef<number | null>(null);
  const previousElapsed = useRef(0);
  const finishGuard = useRef(false);
  useEffect(() => {
    if (state !== "running") return;
    const timer = window.setInterval(() => {
      if (startedAt.current !== null) setElapsed(previousElapsed.current + performance.now() - startedAt.current);
    }, 200);
    return () => window.clearInterval(timer);
  }, [state]);
  function start() {
    if (state === "running" || finishGuard.current) return;
    startedAt.current = performance.now(); setState("running");
  }
  function pause() {
    if (startedAt.current !== null) previousElapsed.current += performance.now() - startedAt.current;
    startedAt.current = null; setElapsed(previousElapsed.current); setState("paused");
  }
  function finish() {
    if (finishGuard.current || state === "ready") return;
    finishGuard.current = true; setFinishing(true);
    startedAt.current = null;
    // No prayer text, personal notes, timer session, or completion record is sent.
    router.push(`/prayers/${id}/complete`);
  }
  if (resource.loading) return <PrayerLoading label="함께 기도할 가이드를 준비하고 있어요." />;
  if (resource.error) return <PrayerError error={resource.error} retry={resource.reload} />;
  if (!resource.data) return null;
  const prayer = resource.data.data;
  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return <>
    <Link className="m6-back-link" href={`/prayers/${id}`}>← 기도문으로 돌아가기</Link>
    <div className="m6-timer-layout">
      <section className="m6-timer-card" aria-labelledby="m6-timer-heading">
        <div className="m6-timer-pause" aria-hidden="true"><i /><i /></div>
        <p className="m6-eyebrow">PAUSE · PRAY</p><h1 id="m6-timer-heading">잠깐, 기도에 머물러요.</h1>
        <p className="m6-timer-status" role="status">{state === "ready" ? "준비되면 기도를 시작해 주세요." : state === "running" ? "기도하는 시간입니다." : "잠시 쉬어도 괜찮아요."}</p>
        <div className="m6-clock" role="timer" aria-live="off" aria-label={`기도 시간 ${minutes}분 ${seconds}초`} tabIndex={0}><span>{String(minutes).padStart(2, "0")}</span><b aria-hidden="true">:</b><span>{String(seconds).padStart(2, "0")}</span></div>
        <div className="m6-timer-actions"><Button className="m6-button" variant={state === "running" ? "secondary" : "primary"} disabled={finishing} onClick={state === "running" ? pause : start}>{state === "ready" ? "기도 시작하기" : state === "running" ? "잠시 멈추기" : "계속 기도하기"}</Button><Button className="m6-button m6-timer-finish" variant="secondary" disabled={state === "ready" || finishing} onClick={finish}>{finishing ? "마무리하는 중…" : "기도 마치기"}</Button></div>
        <p className="m6-caption">얼마나 오래 기도했는지보다<br />잠깐 멈추고 돌아보는 시간이 소중해요.</p>
      </section>
      <article className="m6-timer-reading"><span className="m6-category-pill">{prayer.category || "기도"}</span><h2>{prayer.title}</h2><PrayerText prayer={prayer} /></article>
    </div>
    <p className="m6-timer-privacy">기도 내용과 타이머 기록은 서버에 저장하지 않습니다. 이 페이지를 떠나면 타이머가 종료됩니다.</p>
  </>;
}

export function PrayerComplete({ id }: { id: string }) {
  const resource = usePrayerResource<{ data: Prayer }>(`/api/prayers/${id}`);
  if (resource.loading) return <PrayerLoading label="기도를 마무리하고 있어요." />;
  if (resource.error) return <PrayerError error={resource.error} retry={resource.reload} />;
  return <section className="m6-complete" aria-labelledby="m6-complete-heading"><div className="m6-complete-mark" aria-hidden="true">✓</div><p className="m6-eyebrow">PRAY · THEN CHOOSE</p><h1 id="m6-complete-heading">잠깐의 기도를 마쳤어요.</h1><p className="m6-complete-copy">지금 필요한 것이 무엇인지,<br />다시 선택해 보세요.</p>{resource.data && <p className="m6-complete-title">함께 읽은 기도<br /><strong>{resource.data.data.title}</strong></p>}<div className="m6-actions"><Button asChild className="m6-button"><Link href="/prayers">다른 기도문 살펴보기</Link></Button><Button asChild variant="secondary" className="m6-button"><Link href="/" prefetch={false}>PrayTime으로 돌아가기</Link></Button></div><p className="m6-caption">이 웹 체험은 SNS 앱의 접근을 제한하거나 해제하지 않습니다.<br />개인적인 기도 내용과 완료 기록은 저장되지 않았어요.</p></section>;
}
