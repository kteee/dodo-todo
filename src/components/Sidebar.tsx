import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Category, Todo } from "../lib/types";
import { NO_CAT, PALETTE, nextColor } from "../lib/types";
import { DOW, addDays, key, mondayOf, parse } from "../lib/date";
import { NOCAT_COLOR, cvar } from "./Board";
import { holidayName } from "../lib/holidays";

interface MiniCalProps {
  calMonth: Date;
  onMonth: (n: number) => void;
  weekStart: Date;
  showWeek: boolean;
  selected: string;
  todayKey: string;
  inBucket: (k: string) => Todo[];
  catOf: (id: string | null) => Category | null;
  onPick: (k: string) => void;
  /** 폰 월간 보기: 칸을 크게 (달력 자체가 본문) */
  big?: boolean;
}

export function MiniCal({ calMonth, onMonth, weekStart, showWeek, selected, todayKey, inBucket, catOf, onPick, big }: MiniCalProps) {
  const start = mondayOf(calMonth);
  const wkStart = key(weekStart);
  const wkEnd = key(addDays(weekStart, 6));
  return (
    <section className={"cal" + (big ? " big" : "")}>
      <div className="calhead">
        <span className="m">
          <span className="y">{calMonth.getFullYear()}</span>
          {calMonth.getMonth() + 1}월
        </span>
        <span className="sp" />
        <button className="ico" aria-label="이전 달" onClick={() => onMonth(-1)}>
          ‹
        </button>
        <button className="ico" aria-label="다음 달" onClick={() => onMonth(1)}>
          ›
        </button>
      </div>
      <div className="calgrid">
        {DOW.map((w, i) => (
          <div key={w} className={"wd" + (i === 5 ? " sat" : i === 6 ? " sun" : "")}>
            {w}
          </div>
        ))}
        {Array.from({ length: 42 }, (_, i) => {
          const d = addDays(start, i);
          const k = key(d);
          const hol = holidayName(k);
          const cls =
            "d" +
            (hol || i % 7 === 6 ? " sun" : i % 7 === 5 ? " sat" : "") +
            (d.getMonth() !== calMonth.getMonth() ? " out" : "") +
            (showWeek && k >= wkStart && k <= wkEnd ? " inweek" : "") +
            (k === todayKey ? " today" : "") +
            (k === selected ? " sel" : "");
          // 그날 남은 할 일의 카테고리 색 점 (최대 3개, 카테고리 없음은 회색 점)
          const seen: string[] = [];
          for (const t of inBucket(k)) {
            if (seen.length >= 3) break;
            const color = catOf(t.categoryId)?.color ?? NOCAT_COLOR;
            if (!t.done && !seen.includes(color)) seen.push(color);
          }
          return (
            <button key={k} className={cls} title={hol ?? undefined} onClick={() => onPick(k)}>
              {d.getDate()}
              {seen.length > 0 && (
                <span className="dots">
                  {seen.map((color) => (
                    <i key={color} style={cvar(color)} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface CatModalProps {
  /** 넘기면 "카테고리 상세"(수정·삭제), 없으면 새로 만들기 */
  cat?: Category;
  /** 이 카테고리의 할 일 수(완료 포함) — 삭제 확인 문구용 */
  count: number;
  /** 지금 쓰이는 색들 — 새 카테고리 기본 색을 겹치지 않게 고름 */
  usedColors: string[];
  onSave: (name: string, color: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * 카테고리 만들기·상세 모달 (할 일 모달과 같은 모양): 이름 / 색상 / [삭제] … 취소 · 저장.
 * Enter = 저장, Esc·배경·× = 닫기. 삭제는 확인 팝업을 거침
 */
function CatModal({ cat, count, usedColors, onSave, onDelete, onClose }: CatModalProps) {
  const [name, setName] = useState(cat?.name ?? "");
  const [color, setColor] = useState(cat?.color ?? nextColor(usedColors));
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const save = () => {
    const v = name.trim();
    if (!v) return;
    onSave(v.slice(0, 14), color);
    onClose();
  };
  return createPortal(
    <div
      className="modal-back"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape" || confirming) return;
        e.nativeEvent.stopPropagation();
        onClose();
      }}
    >
      <form
        className="modal quickadd-modal catmodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-title"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="qa-head">
          <h4 id="cm-title">{cat ? "카테고리 상세" : "새 카테고리"}</h4>
          <button type="button" className="qa-close" aria-label="닫기" onClick={onClose}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
            </svg>
          </button>
        </div>
        <label className="qa-label" htmlFor="cm-name">
          이름
        </label>
        <input
          id="cm-name"
          ref={input}
          type="text"
          className="qa-text"
          placeholder="카테고리 이름"
          maxLength={14}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="qa-label">색상</p>
        <div className="cm-swatches" role="radiogroup" aria-label="색상">
          {PALETTE.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={color === p}
              className={"sw" + (color === p ? " on" : "")}
              style={cvar(p)}
              aria-label={"색 " + p.slice(6)}
              onClick={() => setColor(p)}
            />
          ))}
        </div>
        <div className="acts">
          {cat && onDelete && (
            <button type="button" className="cm-del" onClick={() => setConfirming(true)}>
              삭제
            </button>
          )}
          <button type="button" className="cancel" onClick={onClose}>
            취소
          </button>
          <button type="submit" className="primary" disabled={!name.trim()}>
            저장
          </button>
        </div>
      </form>
      {confirming && cat && onDelete && (
        <ConfirmDialog
          title={`[${cat.name}] 카테고리를 삭제할까요?`}
          body={count ? "해당 카테고리의 하위 할 일은 [카테고리 없음]으로 이동합니다." : "해당 카테고리에 등록된 할 일이 없습니다."}
          confirmLabel="삭제"
          onConfirm={() => {
            onDelete();
            onClose();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>,
    document.body,
  );
}

interface ConfirmProps {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 확인 팝업. body 에 포털로 그림 — 사이드바(sticky)가 쌓임 맥락을 만들어서 그 안에 두면
 * 보드의 카드(position:relative)가 팝업 위로 올라오고 어둡게 깔리는 배경도 안 보였음.
 * Esc·배경 클릭 = 취소. 실수 방지로 처음 포커스는 [취소].
 */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }: ConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return createPortal(
    <div
      className="modal-back"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.nativeEvent.stopPropagation(); // 앱 전체 Esc(패널 닫기)까지 가지 않게
        onCancel();
      }}
    >
      <div className="modal" role="alertdialog" aria-modal="true" aria-label={title}>
        <h4>{title}</h4>
        <p>{body}</p>
        <div className="acts">
          <button ref={cancelRef} className="cancel" onClick={onCancel}>
            취소
          </button>
          <button className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface CategoriesProps {
  cats: Category[];
  todos: Todo[];
  editCat: string | null;
  setEditCat: (id: string | null) => void;
  dropCat: string | null;
  onAdd: (name: string, color?: string) => void;
  onUpdate: (id: string, patch: Partial<Pick<Category, "name" | "color">>) => void;
  /** 드래그로 순서 바꾸기: prevId 바로 뒤로 (null = 맨 앞) */
  onMove: (id: string, prevId: string | null) => void;
  onDelete: (id: string) => void;
}

/** 카테고리를 끌어서 순서 바꾸기 — 마우스는 5px 움직이면, 터치는 0.3초 꾹 누르면 시작 (할 일 카드와 같은 규칙) */
function useCatReorder(listRef: React.RefObject<HTMLUListElement>, onMove: (id: string, prevId: string | null) => void) {
  const [drag, setDrag] = useState<{ id: string; at: number } | null>(null); // at = 자리표시가 들어갈 위치(옮기는 항목 제외한 index)
  const cb = useRef(onMove);
  cb.current = onMove;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const list: HTMLUListElement = el;
    let ghost: HTMLElement | null = null;
    let cur: { id: string; at: number } | null = null;
    let grabY = 0;

    const rows = () => Array.from(list.querySelectorAll<HTMLElement>("li[data-cat]")).filter((li) => li.dataset.cat !== cur?.id);
    const place = (y: number) => {
      const rs = rows();
      let at = rs.length;
      for (let i = 0; i < rs.length; i++) {
        const r = rs[i].getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          at = i;
          break;
        }
      }
      if (cur && cur.at !== at) {
        cur = { ...cur, at };
        setDrag(cur);
      }
    };

    function onDown(e: globalThis.PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as Element;
      const li = target.closest<HTMLElement>("li[data-cat]");
      // 수정 패널·입력칸 안에서는 끌지 않음
      if (!li || !list.contains(li) || target.closest(".cated, input, select, textarea")) return;
      const id = li.dataset.cat!;
      const touch = e.pointerType !== "mouse";
      const sx = e.clientX;
      const sy = e.clientY;
      let started = false;
      let hold: number | null = null;

      const begin = () => {
        const r = li.getBoundingClientRect();
        grabY = sy - r.top;
        ghost = li.cloneNode(true) as HTMLElement;
        ghost.classList.add("cat-ghost");
        ghost.style.width = r.width + "px";
        ghost.style.transform = `translate(${r.left}px,${r.top}px)`;
        document.body.appendChild(ghost);
        document.body.classList.add("dragging");
        const idx = Array.from(list.querySelectorAll("li[data-cat]")).findIndex((x) => x === li);
        cur = { id, at: idx };
        setDrag(cur);
        started = true;
      };
      if (touch) {
        li.classList.add("lifting");
        hold = window.setTimeout(() => {
          hold = null;
          begin();
        }, 320);
      }
      const move = (ev: globalThis.PointerEvent) => {
        if (!started) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
          if (touch) {
            if (hold) clearTimeout(hold);
            hold = null;
            li.classList.remove("lifting");
            return; // 터치는 꾹 누르기 전에 움직이면 스크롤
          }
          begin();
        }
        if (ghost) ghost.style.transform = `translate(${ghost.getBoundingClientRect().left}px,${ev.clientY - grabY}px)`;
        place(ev.clientY);
        ev.preventDefault();
      };
      const up = () => {
        if (hold) clearTimeout(hold);
        hold = null;
        li.classList.remove("lifting");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        if (!started) return;
        // 놓은 직후 따라오는 클릭은 무시 (수정 패널이 열리지 않게)
        const stop = (c: MouseEvent) => {
          c.stopPropagation();
          c.preventDefault();
        };
        document.addEventListener("click", stop, { capture: true, once: true });
        setTimeout(() => document.removeEventListener("click", stop, { capture: true }), 0);
        const d = cur;
        ghost?.remove();
        ghost = null;
        document.body.classList.remove("dragging");
        cur = null;
        setDrag(null);
        if (d) {
          const rs = rows();
          cb.current(d.id, d.at > 0 ? rs[d.at - 1].dataset.cat! : null);
        }
      };
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    }
    const blockScroll = (e: TouchEvent) => {
      if (cur) e.preventDefault();
    };
    list.addEventListener("pointerdown", onDown);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => {
      list.removeEventListener("pointerdown", onDown);
      document.removeEventListener("touchmove", blockScroll);
      ghost?.remove();
    };
  }, [listRef]);

  return drag;
}

export function Categories(p: CategoriesProps) {
  /** 새 카테고리 모달 */
  const [adding, setAdding] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const catDrag = useCatReorder(listRef, p.onMove);
  const { editCat, setEditCat } = p;
  const editing = editCat ? (p.cats.find((c) => c.id === editCat) ?? null) : null;

  const totals = new Map<string, number>(); // 완료 포함 — 삭제 확인 문구용
  for (const t of p.todos) if (t.categoryId) totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + 1);
  const used = p.cats.map((c) => c.color);

  return (
    <section>
      {/* 제목 줄 오른쪽 끝 ＋ → 새 카테고리 모달 */}
      <div className="sect-head">
        <p className="sect-label">카테고리</p>
        <button className="sect-add" aria-label="카테고리 추가" title="카테고리 추가" onClick={() => setAdding(true)}>
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 2.2v7.6M2.2 6h7.6" />
          </svg>
        </button>
      </div>
      <ul className="cats" ref={listRef}>
        {p.cats.map((c, i) => (
          <li
            key={c.id}
            data-cat={c.id}
            className={catDrag?.id === c.id ? "ghosted" : ""}
            // 끌고 있는 항목을 뺀 순서에서 at 번째 앞에 자리표시 → 그 자리를 비워 둠
            style={
              catDrag && catDrag.id !== c.id && p.cats.filter((x) => x.id !== catDrag.id).indexOf(c) === catDrag.at
                ? { marginTop: "var(--cat-ph, 30px)" }
                : undefined
            }
            data-i={i}
          >
            {/* 누르면 카테고리 상세 모달 (이름·색 수정, 삭제) */}
            <button
              className={"cat" + (editCat === c.id ? " on" : "") + (p.dropCat === c.id ? " drop" : "")}
              data-drop={"cat:" + c.id}
              aria-haspopup="dialog"
              aria-label={c.name + " 카테고리 상세"}
              onClick={() => setEditCat(c.id)}
            >
              <span className="dot" style={cvar(c.color)} />
              <span className="nm">{c.name}</span>
            </button>
          </li>
        ))}
        {/* 카테고리 없는 할 일: 카드를 끌어다 놓으면 카테고리가 떼어짐 (수정할 건 없음) */}
        <li style={catDrag && catDrag.at >= p.cats.length - 1 ? { marginTop: "var(--cat-ph, 30px)" } : undefined}>
          <div className={"cat nocat" + (p.dropCat === NO_CAT ? " drop" : "")} data-drop={"cat:" + NO_CAT}>
            <span className="dot" style={cvar(NOCAT_COLOR)} />
            <span className="nm">카테고리 없음</span>
          </div>
        </li>
      </ul>
      {adding && <CatModal count={0} usedColors={used} onSave={(name, color) => p.onAdd(name, color)} onClose={() => setAdding(false)} />}
      {editing && (
        <CatModal
          key={editing.id}
          cat={editing}
          count={totals.get(editing.id) ?? 0}
          usedColors={used}
          onSave={(name, color) => p.onUpdate(editing.id, { name, color })}
          onDelete={() => p.onDelete(editing.id)}
          onClose={() => setEditCat(null)}
        />
      )}
    </section>
  );
}

const MONTHS_EN = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

interface TodayBlockProps {
  /** 보여줄 날 (일간이면 고른 날, 그 밖엔 오늘) */
  dateKey: string;
  todayKey: string;
  total: number;
  done: number;
}

/**
 * 사이드바 맨 위: "OCTOBER 2026 / 26 / 2026년 10월 26일 월요일" + 그날의 할 일(마친 수/전체) 진행 막대
 */
export function TodayBlock({ dateKey, todayKey, total, done }: TodayBlockProps) {
  const d = parse(dateKey);
  const isToday = dateKey === todayKey;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <section className="todayblk" aria-label="오늘의 할 일">
      <p className="tb-month">
        {MONTHS_EN[d.getMonth()]} {d.getFullYear()}
      </p>
      <p className="tb-num">{d.getDate()}</p>
      <p className="tb-dow">
        {d.getFullYear()}년 {d.getMonth() + 1}월 {d.getDate()}일 {DOW[(d.getDay() + 6) % 7]}요일
      </p>
      <div className="tb-prog">
        <span>{isToday ? "오늘의 할 일" : "이 날의 할 일"}</span>
        <b>
          {done} / {total}
        </b>
      </div>
      <div className="tb-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <i style={{ width: pct + "%" }} />
      </div>
    </section>
  );
}
