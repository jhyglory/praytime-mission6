"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function PrayerErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="m6-state" role="alert"><h1>기도 화면을 열지 못했어요.</h1><p>잠시 후 다시 시도하거나 다른 기도문을 살펴보세요.</p><div className="m6-actions"><Button className="m6-button" onClick={reset}>다시 시도하기</Button><Link className="m6-text-link" href="/prayers">기도문 목록으로</Link></div></section>;
}
