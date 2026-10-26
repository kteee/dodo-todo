import { useEffect, useRef, useState } from "react";
import type { MemoScope } from "../lib/types";
import { InboxColumn, type BoardCtx } from "./Board";

const LABEL: Record<MemoScope, string> = { day: "일간 메모", week: "주간 메모", month: "월간 메모" };
const PLACEHOLDER: Record<MemoScope, string> = { day: "오늘의 메모", week: "이번 주 메모", month: "이번 달 메모" };
const SAVE_DELAY = 500;

export interface MemoProps {
  scope: MemoScope;
  period: string;
  value: string;
  onSave: (scope: MemoScope, period: string, body: string) => void;
  /** 자동저장 타이머가 돌고 있는(아직 저장 요청 전인) 글이 있는지 — 창 닫기 경고용 */
  onDirty?: (dirty: boolean) => void;
  /** 제목 줄 없이 입력칸만 (일간의 접이식 메모 섹션용) */
  bare?: boolean;
  /** 테두리·크기 조절 손잡이 없이 내용 길이만큼 자동으로 늘어남 */
  autoGrow?: boolean;
}

/**
 * 타이핑이 멈추고 0.5초 뒤 자동 저장, 포커스가 빠지거나 기간이 바뀌거나 탭을 숨기면 즉시 저장.
 * 입력 중에는 서버에서 다시 불러온 값으로 덮어쓰지 않는다(쓰던 글이 튀지 않게).
 */
export function MemoBox({ scope, period, value, onSave, onDirty, bare, autoGrow }: MemoProps) {
  const [draft, setDraft] = useState(value);
  const area = useRef<HTMLTextAreaElement>(null);
  const focused = useRef(false);
  const timer = useRef<number | null>(null);
  const pending = useRef<{ scope: MemoScope; period: string; body: string } | null>(null);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const dirtyRef = useRef(onDirty);
  dirtyRef.current = onDirty;

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    dirtyRef.current?.(false);
    if (p) saveRef.current(p.scope, p.period, p.body);
  };

  // 다른 주/날/달로 넘어가면: 쓰던 걸 먼저 저장하고 새 기간의 메모를 보여줌
  useEffect(() => {
    setDraft(value);
    return flush;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, period]);

  // 다른 기기에서 바뀐 값 반영 — 입력 중이 아닐 때만
  useEffect(() => {
    if (!focused.current && !pending.current) setDraft(value);
  }, [value]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    // beforeunload 에서 먼저 저장 요청을 보내 두면(keepalive) 탭이 닫혀도 요청은 끝까지 감
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("pagehide", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 자동 확장: 내용이 바뀔 때마다 높이를 내용 높이에 맞춤
  useEffect(() => {
    const el = area.current;
    if (!autoGrow || !el) return;
    el.style.height = "0px";
    el.style.height = el.scrollHeight + "px";
  }, [draft, autoGrow]);

  return (
    <section className={"memo" + (autoGrow ? " grow" : "")}>
      {!bare && (
        <div className="colhead">
          <span className="dow">{LABEL[scope]}</span>
        </div>
      )}
      <textarea
        ref={area}
        rows={autoGrow ? 1 : undefined}
        aria-label={LABEL[scope]}
        placeholder={bare ? "메모를 입력해주세요" : PLACEHOLDER[scope]}
        maxLength={5000}
        value={draft}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          flush();
        }}
        onChange={(e) => {
          const body = e.target.value;
          setDraft(body);
          pending.current = { scope, period, body };
          dirtyRef.current?.(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = window.setTimeout(flush, SAVE_DELAY);
        }}
      />
    </section>
  );
}

interface SideProps {
  /** 두 줄 보기에서 칸을 따로 배치할 때 붙이는 클래스 */
  className?: string;
  showMemo: boolean;
  showInbox: boolean;
  memo: MemoProps;
  ctx: BoardCtx;
}

/** 보드 오른쪽 칸: 위는 기간 메모, 아래는 언젠가 할 일(날짜 없는 할 일) */
export function SideColumn({ className = "", showMemo, showInbox, memo, ctx }: SideProps) {
  return (
    <div className={"sidecol" + (showMemo && showInbox ? " split" : "") + (className ? " " + className : "")}>
      {showMemo && <MemoBox {...memo} />}
      {showInbox && <InboxColumn ctx={ctx} />}
    </div>
  );
}
