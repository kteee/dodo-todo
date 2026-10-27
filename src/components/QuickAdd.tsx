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

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
/** "2026-10-27" → "2026년 10월 27일 (화)" */
const longDate = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일 (${DOW[new Date(y, m - 1, d).getDay()]})`;
};
/** "2026-10-27" → "10.27" */
const shortDate = (k: string) => {
  const [, m, d] = k.split("-").map(Number);
  return `${m}.${d}`;
};

/**
 * 제목 줄 "＋ 할 일 추가" 팝업: 할 일 / 날짜(선택 — 날짜 없음·오늘 빠른 선택, 안 정하면 보관함) / 카테고리.
 * Enter·저장 → 그 날(또는 보관함)에 추가되고 닫힘. body 에 포털로 그림. Esc·배경 클릭·× = 닫기
 */
export function QuickAdd({ cats, defaultDate, onAdd, onClose }: Props) {
  const today = defaultDate;
  const [text, setText] = useState("");
  const [date, setDate] = useState(defaultDate);
  /** 날짜 없음 = 보관함으로 */
  const [noDate, setNoDate] = useState(false);
  const [cat, setCat] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const hasDate = !noDate && !!date;
  const submit = () => {
    const v = text.trim();
    if (!v) return;
    onAdd(hasDate ? date : NONE, v.slice(0, 500), cats.some((c) => c.id === cat) ? cat : null);
    onClose();
  };
  const openPicker = () => {
    const el = picker.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
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
        aria-labelledby="qa-title"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="qa-head">
          <h4 id="qa-title">새로운 할 일</h4>
          <button type="button" className="qa-close" aria-label="닫기" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>

        <label className="qa-label" htmlFor="qa-text">
          할 일
        </label>
        <input
          id="qa-text"
          ref={input}
          type="text"
          className="qa-text"
          placeholder="무엇을 할까요?"
          maxLength={500}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <p className="qa-label">
          날짜 <span className="opt">(선택)</span>
        </p>
        {/* 날짜 칸: 누르면 브라우저 달력. 실제 입력은 칸 아래에 숨겨 두고 달력 위치만 잡음 */}
        <div className="qa-datebox">
          <button type="button" className={"qa-date" + (hasDate ? "" : " empty")} onClick={openPicker}>
            <svg className="ico" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
              <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
            </svg>
            <span className="val">{hasDate ? longDate(date) : "날짜를 선택하세요"}</span>
            <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
              <polyline points="2.5,4.5 6,8 9.5,4.5" />
            </svg>
          </button>
          <input
            ref={picker}
            type="date"
            className="qa-picker"
            tabIndex={-1}
            aria-hidden="true"
            value={hasDate ? date : ""}
            onChange={(e) => {
              setDate(e.target.value);
              setNoDate(!e.target.value);
            }}
          />
        </div>
        <div className="qa-quick">
          <button type="button" className={"qa-chip" + (!hasDate ? " on" : "")} aria-pressed={!hasDate} onClick={() => setNoDate(true)}>
            {!hasDate && (
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <polyline points="2,6.3 4.7,9 10,3.2" />
              </svg>
            )}
            날짜 없음
          </button>
          <button
            type="button"
            className={"qa-chip" + (hasDate && date === today ? " on" : "")}
            aria-pressed={hasDate && date === today}
            onClick={() => {
              setDate(today);
              setNoDate(false);
            }}
          >
            {hasDate && date === today && (
              <svg viewBox="0 0 12 12" aria-hidden="true">
                <polyline points="2,6.3 4.7,9 10,3.2" />
              </svg>
            )}
            오늘 {shortDate(today)}
          </button>
        </div>
        <p className="qa-help">날짜를 정하지 않으면 보관함에 저장돼요.</p>

        <label className="qa-label" htmlFor="qa-cat">
          카테고리 <span className="opt">(선택)</span>
        </label>
        <div className="qa-selbox">
          <select id="qa-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">카테고리 없음</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <svg className="chev" viewBox="0 0 12 12" aria-hidden="true">
            <polyline points="2.5,4.5 6,8 9.5,4.5" />
          </svg>
        </div>

        <div className="acts">
          <button type="button" className="cancel" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!text.trim()}>
            저장
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
