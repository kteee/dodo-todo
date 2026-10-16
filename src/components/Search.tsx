import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, Todo } from "../lib/types";
import { DOW, parse } from "../lib/date";
import { NOCAT_COLOR, cvar } from "./Board";

interface Props {
  todos: Todo[];
  catOf: (id: string | null) => Category | null;
  onPick: (t: Todo) => void;
}

const MAX = 30;

function dateLabel(date: string | null) {
  if (!date) return "언젠가 할 일";
  const d = parse(date);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} (${DOW[(d.getDay() + 6) % 7]})`;
}

/**
 * 헤더의 할 일 검색. 제목에 글자가 들어간 할 일을 날짜 최신순으로 보여주고,
 * 고르면 그 날짜로 이동해서 해당 카드를 잠깐 강조함. Ctrl+K(또는 ⌘K)로 바로 포커스.
 * 키보드: ↑↓ 이동, Enter 이동, Esc 닫기
 */
export function Search({ todos, catOf, onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return todos
      .filter((t) => t.text.toLowerCase().includes(s))
      .sort((a, b) => {
        // 날짜 있는 것 먼저(최신순), 언젠가 할 일은 뒤
        if (a.date === b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date < b.date ? 1 : -1;
      })
      .slice(0, MAX);
  }, [q, todos]);

  useEffect(() => setActive(0), [q]);

  // Ctrl+K / ⌘K 로 검색창 포커스, 바깥 클릭이면 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const pick = (t: Todo) => {
    onPick(t);
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="search" ref={box}>
      <svg className="search-ico" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="7" cy="7" r="4.6" />
        <line x1="10.4" y1="10.4" x2="13.6" y2="13.6" />
      </svg>
      <input
        ref={input}
        type="search"
        placeholder="할 일 검색"
        aria-label="할 일 검색"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.nativeEvent.stopPropagation();
            if (q) setQ("");
            else input.current?.blur();
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            pick(results[active]);
          }
        }}
      />
      {open && q.trim() && (
        <div className="search-pop" role="listbox" aria-label="검색 결과">
          {results.length === 0 ? (
            <p className="search-empty">검색 결과가 없어요</p>
          ) : (
            results.map((t, i) => {
              const c = catOf(t.categoryId);
              return (
                <button
                  key={t.id}
                  role="option"
                  aria-selected={i === active}
                  className={"search-item" + (i === active ? " on" : "") + (t.done ? " done" : "")}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(t)}
                >
                  <span className="search-dot" style={cvar(c?.color ?? NOCAT_COLOR)} />
                  <span className="search-text">{t.text}</span>
                  <span className="search-meta">{dateLabel(t.date)}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
