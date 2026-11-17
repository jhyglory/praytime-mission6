"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Prayer } from "@/lib/prayers/types";
import { prayerRequest } from "./api-client";

export function DeletePrayer({ prayer, onDeleted }: { prayer: Prayer; onDeleted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const close = () => { if (!busy.current) { dialog.current?.close(); trigger.current?.focus(); } };
  async function remove() {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const result = await prayerRequest<{ warning?: string }>(`/api/admin/prayers/${prayer.id}`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: prayer.updated_at }),
      });
      dialog.current?.close();
      if (result.warning) window.alert(result.warning);
      onDeleted();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "삭제하지 못했습니다. 다시 시도해 주세요."); }
    finally { busy.current = false; setPending(false); }
  }
  return <>
    <button type="button" className="m6-text-button m6-text-button--danger" ref={trigger} onClick={() => { setError(""); dialog.current?.showModal(); cancel.current?.focus(); }} aria-label={`삭제: ${prayer.title}`}>삭제</button>
    <dialog className="m6-dialog" ref={dialog} aria-labelledby={`delete-title-${prayer.id}`} aria-describedby={`delete-description-${prayer.id}`} onCancel={event => { if (busy.current) event.preventDefault(); }} onClose={() => trigger.current?.focus()}>
      <p className="m6-eyebrow">콘텐츠 삭제</p>
      <h2 id={`delete-title-${prayer.id}`}>이 기도문을 삭제할까요?</h2>
      <p className="m6-dialog-title">{prayer.title}</p>
      <p id={`delete-description-${prayer.id}`}>삭제하면 기도문과 연결된 대표 이미지가 제거되며 되돌릴 수 없습니다. 잠시 숨기려면 수정 화면에서 <strong>초안</strong>으로 변경해 주세요.</p>
      {error && <p className="m6-inline-error" role="alert">{error}</p>}
      <div className="m6-actions"><Button ref={cancel} variant="secondary" className="m6-button" disabled={pending} onClick={close}>취소</Button><Button className="m6-button" state={pending ? "submitting" : "default"} onClick={remove}>{pending ? "삭제 중…" : "기도문 삭제"}</Button></div>
    </dialog>
  </>;
}
