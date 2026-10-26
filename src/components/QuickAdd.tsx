import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Bucket, Category } from "../lib/types";
import { NONE } from "../lib/types";

interface Props {
  cats: Category[];
  /** 처음 골라져 있는 날 (오늘) — YYYY-MM-DD */
  defaultDate: string;
  onAdd: (bucket: Bucket, text: string, catId: string | null) => void;
  onClose: () => void;
}

/**
 * 헤더 "＋ 할 일 추가" 팝업: 할 일 / 날짜(기본 오늘, '날짜 없음' 체크 = 보관함) / 카테고리 — 세 줄. Enter/추가 → 그 날에 추가되고 닫힘.
 * body 에 포털로 그림 (ConfirmDialog 와 같은 .modal 모양). Esc·배경 클릭 = 닫기
 */
export function QuickAdd({ cats, defaultDate, onAdd, onClose }: Props) {
  const [text, setText] = useState("");
  const [date, setDate] = useState(defaultDate);
  /** 날짜 없음 = 보관함으로 */
  const [noDate, setNoDate] = useState(false);
  const [cat, setCat] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onAdd(noDate || !date ? NONE : date, v.slice(0, 500), cats.some((c) => c.id === cat) ? cat : null);
    onClose();
  };

  return createPortal(
    <div
      className="modal-back"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.nativeEvent.stopPropagation();
        onClose();
      }}
    >
      <form
        className="modal quickadd-modal"
        role="dialog"
        aria-modal="true"
        aria-label="할 일 추가"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h4>할 일 추가</h4>
        <input
          ref={input}
          type="text"
          className="qa-text"
          placeholder="무엇을 할까요?"
          aria-label="할 일"
          maxLength={500}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="qa-field">
          <span>날짜</span>
          {/* 날짜 없음을 켜면 칸을 비워 "연도-월-일" 자리표시만 보이게 */}
          <input type="date" value={noDate ? "" : date} disabled={noDate} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
          <label className="qa-nodate">
            <input type="checkbox" checked={noDate} onChange={(e) => setNoDate(e.target.checked)} /> 날짜 없음
            {noDate && <span className="qa-hint">날짜 없는 할 일은 보관함에 보관돼요.</span>}
          </label>
        </div>
        <div className="qa-field">
          <span>카테고리</span>
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="카테고리">
            <option value="">카테고리 없음</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="acts">
          <button type="button" className="cancel" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!text.trim()}>
            추가
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
