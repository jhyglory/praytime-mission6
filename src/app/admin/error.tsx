"use client";
import { Button } from "@/components/ui/button";
export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="m6-state" role="alert"><h1>관리 화면을 열지 못했어요.</h1><p>잠시 후 다시 시도해 주세요. 저장 중이었다면 목록에서 반영 여부를 먼저 확인해 주세요.</p><Button className="m6-button" onClick={reset}>다시 시도하기</Button></section>;
}
