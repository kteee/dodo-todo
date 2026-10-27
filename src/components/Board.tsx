import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type ReactNode } from "react";
import type { Bucket, Category, Todo } from "../lib/types";
import { NO_CAT } from "../lib/types";
import { DOW, addDays, key, mondayOf } from "../lib/date";
import { holidayName } from "../lib/holidays";
import type { DragState } from "../hooks/useDrag";

export const cvar = (color: string) => ({ "--c": `var(${color})` }) as CSSProperties;
/** 카테고리 없는 할 일의 점·고스트 색 */
export const NOCAT_COLOR = "--ink-3";

export interface BoardCtx {
  cats: Category[];
  /** 카테고리 없음(또는 지워진 카테고리)이면 null */
  catOf: (id: string | null) => Category | null;
  /** 칸에 있는 전체 할 일(정렬됨) */
  inBucket: (b: Bucket) => Todo[];
  /** 필터·완료숨김 적용 후 화면에 보이는 순서 */
  shown: (b: Bucket) => Todo[];
  groupBy: boolean;
  openBucket: Bucket | null;
  setOpenBucket: (b: Bucket | null) => void;
  drag: DragState | null;
  onAdd: (b: Bucket, text: string, catId: string | null, first?: boolean) => void;
  /** 지금 수정 중인 할 일 (한 번에 하나) */
  editingId: string | null;
  /** 수정을 시작할 때 커서를 둘 글자 위치 (null이면 끝) */
  editingCaret: number | null;
  /** 칩을 눌러서 수정을 시작했으면 카테고리 목록을 바로 엶 */
  editingChip: boolean;
  /** 검색으로 찾아간 카드 — 잠깐 반짝임 */
  flashId: string | null;
  /** 방금 추가한 카드 — 내려앉는 효과 */
  newId: string | null;
  /** 방금 체크한 카드 — 체크 표시가 톡 튀어나옴 */
  poppedId: string | null;
  setEditingId: (id: string | null, caret?: number | null, chip?: boolean) => void;
  onEdit: (id: string, patch: { text: string; categoryId: string | null }) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function Card({ t, mini, ctx }: { t: Todo; mini?: boolean; ctx: BoardCtx }) {
  const c = ctx.catOf(t.categoryId);
  const editing = ctx.editingId === t.id;
  const [leaving, setLeaving] = useState(false); // 삭제될 때 짧게 사라지는 효과 후 실제 삭제
  const cls =
    "card" +
    (t.done ? " done" : "") +
    (mini ? " mini" : "") +
    // 수정 중에는 카테고리 없는 카드도 칩 줄을 열어서 "카테고리 없음" 칩으로 고를 수 있게
    (c || editing ? "" : " nocat") +
    (editing ? " is-editing" : "") +
    (ctx.flashId === t.id ? " flash" : "") +
    (ctx.newId === t.id ? " enter" : "") +
    (ctx.poppedId === t.id && t.done ? " pop" : "") +
    (leaving ? " leaving" : "") +
    (ctx.drag?.id === t.id ? " ghosted" : "");
  return (
    // 카드를 누르면 그 자리에서 바로 수정 (모양은 그대로, 누른 위치에 커서). 체크·삭제 버튼은 제외.
    // 끌면 드래그 — 드래그 직후의 클릭은 useDrag가 막아줌
    <li
      className={cls}
      data-id={t.id}
      style={cvar(c?.color ?? NOCAT_COLOR)}
      onClick={(e) => {
        if (editing || (e.target as Element).closest("button")) return;
        const onChip = !!(e.target as Element).closest(".chip");
        ctx.setEditingId(t.id, caretOffsetAt(e.clientX, e.clientY, e.currentTarget.querySelector(".txt")), onChip);
      }}
    >
      <button className="check" aria-label={t.done ? "완료 취소" : "완료"} onClick={() => ctx.onToggle(t.id)}>
        <svg viewBox="0 0 12 12">
          <polyline points="2,6.3 4.7,9 10,3.2" />
        </svg>
      </button>
      {editing ? <InlineEditor t={t} ctx={ctx} /> : <span className="txt" title={t.text}>{t.text}</span>}
      {c && !editing && <span className="chip">{c.name}</span>}
      {!editing && (
        <button
          className="del"
          aria-label="삭제"
          onClick={() => {
            if (leaving) return;
            setLeaving(true);
            setTimeout(() => ctx.onDelete(t.id), 160);
          }}
        >
          ×
        </button>
      )}
    </li>
  );
}

/** 클릭한 화면 좌표가 제목 글자 몇 번째 자리인지 — 수정칸에서 그 자리에 커서를 두려고 */
function caretOffsetAt(x: number, y: number, txt: Element | null): number | null {
  if (!txt) return null;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos && txt.contains(pos.offsetNode)) return pos.offset;
  const range = document.caretRangeFromPoint?.(x, y);
  if (range && txt.contains(range.startContainer)) return range.startOffset;
  return null; // 제목 밖(칩, 여백)을 눌렀으면 끝에
}

/**
 * 제목 자리에 같은 글꼴·크기의 입력칸을 겹쳐서 "모양은 그대로, 커서만 깜박이게".
 * 줄바꿈되는 긴 제목도 같은 높이로 보이도록 textarea 높이를 내용에 맞춤.
 * 카테고리 칩은 같은 모양의 선택칸으로 바뀌어 눌러서 바꿀 수 있음.
 * Enter·바깥 클릭 = 저장, Esc = 취소(App). 제목을 비우면 원래대로.
 */
function InlineEditor({ t, ctx }: { t: Todo; ctx: BoardCtx }) {
  const [text, setText] = useState(t.text);
  const [cat, setCat] = useState(t.categoryId ?? "");
  const closed = useRef(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const select = useRef<HTMLSelectElement>(null);
  const catId = ctx.cats.some((c) => c.id === cat) ? cat : "";
  const c = ctx.catOf(catId || null);

  const fit = () => {
    const el = area.current;
    if (!el) return;
    // scrollHeight는 정수로 반올림돼서(56.25px → 56px) 원래 제목보다 살짝 작아짐 → 줄 수 × 줄 높이로 정확히 맞춤
    el.style.height = "0px";
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 18.75;
    el.style.height = Math.max(1, Math.round(el.scrollHeight / lh)) * lh + "px";
  };
  useLayoutEffect(() => {
    fit();
    const el = area.current;
    if (!el) return;
    if (ctx.editingChip && select.current) {
      // 칩을 눌러 들어왔으면 카테고리 목록을 바로 펼침 (지원 안 하는 브라우저는 포커스만)
      select.current.focus();
      try {
        select.current.showPicker?.();
      } catch {
        /* 사용자 동작 직후가 아니면 막힐 수 있음 — 포커스만 둬도 한 번 더 누르면 열림 */
      }
      return;
    }
    el.focus();
    const at = ctx.editingCaret ?? el.value.length;
    el.setSelectionRange(at, at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = () => {
    if (closed.current) return;
    closed.current = true;
    const v = text.replace(/\s*\n\s*/g, " ").trim(); // 붙여넣은 줄바꿈은 공백으로
    if (v) ctx.onEdit(t.id, { text: v.slice(0, 500), categoryId: catId || null });
    ctx.setEditingId(null);
  };
  // 저장 기준은 "카드 바깥을 실제로 눌렀을 때". 포커스 이동(blur)만 보면 카테고리 목록을 열고 닫을 때
  // 브라우저가 포커스를 잠깐 뺐다 돌려놓는 걸 바깥 클릭으로 오해해서 수정이 끝났다 다시 그려짐(깜빡임)
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    const li = area.current?.closest("li");
    const onDown = (e: PointerEvent) => {
      if (li && !li.contains(e.target as Node)) commitRef.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);
  // 키보드 Tab으로 카드 밖 요소로 나가는 경우만 blur로 저장 (relatedTarget이 확실히 바깥일 때)
  const blur = (e: FocusEvent<HTMLElement>) => {
    const to = e.relatedTarget as Node | null;
    const li = e.currentTarget.closest("li");
    if (to && li && !li.contains(to)) commit();
  };

  return (
    <>
      <textarea
        ref={area}
        className="txt txt-edit"
        aria-label="할 일 수정"
        rows={1}
        maxLength={500}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          fit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={blur}
      />
      {/* 보이는 건 원래 칩 그대로(폭도 이름 길이 그대로). 투명한 선택칸을 칩 위에 겹쳐서 누르면 목록만 열림.
          카테고리가 없으면 옅은 "카테고리 없음" 칩 */}
      {
        <span className={"chip chipwrap" + (c ? "" : " none")} style={cvar(c?.color ?? NOCAT_COLOR)}>
          {c?.name ?? "카테고리 없음"}
          <select ref={select} aria-label="카테고리" value={catId} onChange={(e) => setCat(e.target.value)} onBlur={blur}>
            <option value="">카테고리 없음</option>
            {ctx.cats.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </span>
      }
    </>
  );
}

function Composer({ bucket, ctx, formOnly, label = "＋ 할 일" }: { bucket: Bucket; ctx: BoardCtx; formOnly?: boolean; label?: string }) {
  if (ctx.openBucket === bucket) return <ComposerForm bucket={bucket} ctx={ctx} />;
  return formOnly ? null : (
    <button className="add" onClick={() => ctx.setOpenBucket(bucket)}>
      {label}
    </button>
  );
}

/** 열릴 때마다 새로 마운트 — 카테고리 기본값이 그때의 필터를 따라감 */
function ComposerForm({ bucket, ctx }: { bucket: Bucket; ctx: BoardCtx }) {
  const [text, setText] = useState("");
  const [cat, setCat] = useState(""); // "" = 카테고리 없음

  const catId = ctx.cats.some((c) => c.id === cat) ? cat : "";
  const commit = () => {
    const v = text.trim();
    if (!v) return;
    ctx.onAdd(bucket, v.slice(0, 500), catId || null);
    setText("");
  };
  // Enter: 등록하고 입력칸은 열어둠(연달아 입력)
  const submit = (e: FormEvent) => {
    e.preventDefault();
    commit();
  };
  // 바깥 클릭: 쓴 게 있으면 등록하고 닫음.
  // 포커스가 빠지는 것(blur)이 아니라 "입력칸 바깥을 실제로 눌렀을 때"를 기준으로 함 — 카테고리 목록을 열고 닫을 때
  // 브라우저가 포커스를 잠깐 빼는 걸 바깥 클릭으로 오해해서, 카테고리를 고르면 입력칸이 닫혀 등록이 안 되던 버그 수정
  const form = useRef<HTMLFormElement>(null);
  const outside = useRef(() => {});
  outside.current = () => {
    commit();
    ctx.setOpenBucket(null);
  };
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (form.current && !form.current.contains(e.target as Node)) outside.current();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);
  // 키보드 Tab으로 확실히 바깥 요소로 나갈 때만 blur로 처리
  const blur = (e: FocusEvent<HTMLFormElement>) => {
    const to = e.relatedTarget as Node | null;
    if (to && !e.currentTarget.contains(to)) outside.current();
  };

  return (
    // 선택한 카테고리 색을 칩 모양 선택칸에 입힘. 화면에선 선택칸이 위(CSS order), 탭 순서·커서는 제목칸이 먼저
    <form ref={form} className="composer" onSubmit={submit} onBlur={blur} style={cvar(ctx.catOf(catId || null)?.color ?? NOCAT_COLOR)}>
      <input type="text" placeholder="할 일" autoComplete="off" maxLength={500} autoFocus value={text} onChange={(e) => setText(e.target.value)} />
      <CatSelect cats={ctx.cats} value={catId} onChange={setCat} />
    </form>
  );
}

function CatSelect({ cats, value, onChange }: { cats: Category[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className={"catsel" + (value ? "" : " none")} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">카테고리 없음</option>
      {cats.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function CardList({ bucket, items, mini, ctx }: { bucket: Bucket; items: Todo[]; mini?: boolean; ctx: BoardCtx }) {
  const d = ctx.drag;
  const showPh = !!d && !d.catTarget && d.zone === bucket;
  const nodes: ReactNode[] = [];
  let placed = false;
  const ph = <li className="ph" key="__ph" style={d ? { height: d.h } : undefined} />;
  // 카테고리별 보기에서 드래그 중이면 자리표시는 손가락이 있는 그룹(d.group) 안에만 — 그룹 끝에 놓으면 그 그룹 맨 아래
  let curGroup: string | null = null;
  const inGroup = !!d && d.group !== null;
  const push = (t: Todo) => {
    if (showPh && !placed && d!.beforeId === t.id && (!inGroup || curGroup === d!.group)) {
      nodes.push(ph);
      placed = true;
    }
    nodes.push(<Card key={t.id} t={t} mini={mini} ctx={ctx} />);
  };

  const grouped = ctx.groupBy && !mini;
  if (grouped) {
    for (const g of groupItems(ctx, items)) {
      const gid = g.cat?.id ?? NO_CAT;
      curGroup = gid;
      nodes.push(
        <li className="grouphead" key={"g:" + gid} data-group={gid}>
          <span className="dot" style={cvar(g.cat?.color ?? NOCAT_COLOR)} />
          <span className="gname">{g.cat?.name ?? "카테고리 없음"}</span>
          <span className="gn">{g.items.length}</span>
        </li>,
      );
      g.items.forEach(push);
      if (showPh && !placed && inGroup && d!.group === gid) {
        nodes.push(ph);
        placed = true;
      }
    }
  } else {
    items.forEach(push);
  }
  if (showPh && !placed) nodes.push(ph);

  return <ul className={"list" + (grouped ? " grouped" : "")}>{nodes}</ul>;
}

/** 카테고리별 보기의 그룹: 카테고리 순서대로, "카테고리 없음"은 맨 뒤. 빈 그룹은 뺌 */
function groupItems(ctx: BoardCtx, items: Todo[]) {
  const out: { cat: Category | null; items: Todo[] }[] = [];
  for (const c of ctx.cats) {
    const g = items.filter((t) => t.categoryId === c.id);
    if (g.length) out.push({ cat: c, items: g });
  }
  const none = items.filter((t) => !ctx.catOf(t.categoryId));
  if (none.length) out.push({ cat: null, items: none });
  return out;
}

/** 화면에 보이는 순서 그대로 (카테고리별 보기면 그룹 순서) — 드롭 위치 계산에 씀 */
export function displayOrder(ctx: BoardCtx, b: Bucket, mini: boolean) {
  const items = ctx.shown(b);
  if (!ctx.groupBy || mini) return items;
  return groupItems(ctx, items).flatMap((g) => g.items);
}

interface ColProps {
  bucket: Bucket;
  label: string;
  dnum?: number;
  cls?: string;
  empty?: string;
  /** 제목 옆 ? 아이콘에 마우스를 올리면 보이는 설명 */
  hint?: string;
  /** 공휴일 이름 (요일 옆에 작게) */
  holiday?: string | null;
  /** 머리 오른쪽 위 작은 글자 — "오늘", 달이 바뀌는 날의 "11월" */
  topRight?: string;
  /** 개수 표기: ratio = "완료/전체", open = "N개의 할 일"(남은 것) */
  countStyle?: "ratio" | "open";
  ctx: BoardCtx;
}

export function Column({ bucket, label, dnum, cls = "", empty, hint, holiday, topRight, countStyle = "ratio", ctx }: ColProps) {
  const all = ctx.inBucket(bucket);
  const done = all.filter((t) => t.done).length; // 완료/전체
  const count = countStyle === "open" ? (all.length - done > 0 ? `${all.length - done}개의 할 일` : "") : all.length ? `${done}/${all.length}` : "";
  const items = ctx.shown(bucket);
  const dropHere = !!ctx.drag && !ctx.drag.catTarget && ctx.drag.zone === bucket;
  return (
    <section className={"col" + cls + (dropHere ? " drop" : "")} data-drop={"date:" + bucket}>
      <div className="colhead">
        {dnum !== undefined && <span className="dnum">{dnum}</span>}
        <span className="dow">{label}</span>
        {holiday && shortHoliday(holiday) && (
          <span className="hol-name" title={holiday}>
            {shortHoliday(holiday)}
          </span>
        )}
        {hint && (
          <span className="hint-ico" tabIndex={0} role="img" aria-label={hint} data-tip={hint}>
            ?
          </span>
        )}
        {topRight && <span className="col-tag">{topRight}</span>}
        <span className="n">{count}</span>
      </div>
      <div className="colbody">
        <CardList bucket={bucket} items={items} ctx={ctx} />
        {!items.length && empty && <p className="empty">{empty}</p>}
        <Composer bucket={bucket} ctx={ctx} />
      </div>
    </section>
  );
}

/**
 * 접이식 메모 섹션 (일간·주간·월간 맨 아래): "▾ 메모" 제목, 접으면 첫 줄 미리보기.
 * memo = <MemoBox bare autoGrow …/>
 */
const MEMO_OPEN_PREF = "dodo:memoOpen"; // 메모 섹션 펼침 여부 — 일·주·월 공통, 새로고침해도 유지

export function MemoSection({ memo, memoText = "", label = "메모" }: { memo: ReactNode; memoText?: string; label?: string }) {
  const [open, setOpenState] = useState(() => {
    try {
      return localStorage.getItem(MEMO_OPEN_PREF) !== "0";
    } catch {
      return true;
    }
  });
  const setOpen = (fn: (o: boolean) => boolean) =>
    setOpenState((o) => {
      const v = fn(o);
      try {
        localStorage.setItem(MEMO_OPEN_PREF, v ? "1" : "0");
      } catch {
        /* 저장 못 해도 이번 화면에서는 적용됨 */
      }
      return v;
    });
  const preview = memoText.trim().split("\n")[0]?.slice(0, 40) ?? "";
  return (
    <div className={"dv-done dv-memo" + (open ? "" : " closed")}>
      <button className="dv-tg" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <polyline points="2.5,4.5 6,8 9.5,4.5" />
        </svg>
        {label}
        {!open && preview && <span className="n preview">{preview}</span>}
      </button>
      {open && <div className="daymemo">{memo}</div>}
    </div>
  );
}

interface DayViewProps {
  dateKey: string;
  todayKey: string;
  /** 날짜 스트립에 보일 주의 월요일 */
  weekStart: Date;
  onPick: (k: string) => void;
  ctx: BoardCtx;
  /** 맨 아래 메모 칸 (메모 보기 꺼져 있으면 null) */
  memo?: ReactNode;
  /** 메모 본문 — 접혀 있을 때 첫 줄 미리보기용 */
  memoText?: string;
}

/**
 * 일간 보기: 위에 그 주 7일 날짜 스트립(고른 날은 회색 상자), "할 일 N" 밑줄 행 목록, ＋ 새로운 할 일 추가,
 * 접을 수 있는 "완료한 일 N", 맨 아래 메모. 칸 테두리 없이 행마다 밑줄만.
 * 드롭은 이 영역 어디에 놓아도 이 날짜로 (data-drop)
 */
export function DayView({ dateKey, todayKey, weekStart, onPick, ctx, memo, memoText = "" }: DayViewProps) {
  const items = ctx.shown(dateKey);
  const open = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done);
  const dropHere = !!ctx.drag && !ctx.drag.catTarget && ctx.drag.zone === dateKey;
  return (
    <section className={"dayview" + (dropHere ? " drop" : "")} data-drop={"date:" + dateKey}>
      <div className="weekstrip" role="tablist" aria-label="이 주의 날짜">
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i);
          const k = key(d);
          const hol = holidayName(k);
          const cls =
            "ws-day" +
            (k === dateKey ? " sel" : "") +
            (k === todayKey ? " today" : "") +
            (hol || i === 6 ? " sun" : i === 5 ? " sat" : "");
          return (
            <button key={k} role="tab" aria-selected={k === dateKey} className={cls} title={hol ?? undefined} onClick={() => onPick(k)}>
              <span className="ws-dow">{DOW[i]}</span>
              <span className="ws-num">{d.getDate()}</span>
              {/* 그 날 남은 할 일이 있으면 점 */}
              <i className={"ws-dot" + (ctx.shown(k).some((t) => !t.done) ? " on" : "")} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="dv-head">
        할 일<span className="n">{open.length}</span>
      </div>
      {/* 완료한 항목은 따로 접지 않고 목록 맨 아래로 */}
      <CardList bucket={dateKey} items={[...open, ...done]} ctx={ctx} />
      <Composer bucket={dateKey} ctx={ctx} label="＋ 새로운 할 일 추가" />
      {memo && <MemoSection memo={memo} memoText={memoText} label="일간 메모" />}
    </section>
  );
}

/** 칸이 좁으니 "광복절 대체공휴일" → "대체공휴일". 설날·추석 연휴의 앞뒤 날은 빨간 날로만 두고 글자는 당일에만 */
export const shortHoliday = (name: string) =>
  name.endsWith("대체공휴일") ? "대체공휴일" : name.endsWith(" 전날") || name.endsWith(" 다음날") ? "" : name;

export function InboxColumn({ ctx }: { ctx: BoardCtx }) {
  return (
    <Column
      bucket="none"
      label="보관함"
      hint="아직 날짜를 정하지 않은 할 일이에요. 날짜가 정해지면 원하는 날로 끌어다 놓으세요."
      cls=" unscheduled"
      ctx={ctx}
    />
  );
}

/**
 * 보관함: 날짜 없는 할 일. 일간 보기와 같은 구성 — "할 일 N" 라벨(아래 선) → 테두리 카드(완료는 맨 아래) → ＋ 새로운 할 일 추가.
 * 날짜 선택 줄·메모만 없음. 정해지면 달력으로 끌어다 놓음
 */
export function InboxSection({ ctx }: { ctx: BoardCtx }) {
  const items = ctx.shown("none");
  const open = items.filter((t) => !t.done);
  const done = items.filter((t) => t.done);
  const dropHere = !!ctx.drag && !ctx.drag.catTarget && ctx.drag.zone === "none";
  return (
    <section className={"dayview inbox-sec" + (dropHere ? " drop" : "")} data-drop="date:none" aria-label="보관함">
      <div className="dv-head">
        날짜 없는 할 일<span className="n">{open.length}</span>
      </div>
      <CardList bucket="none" items={[...open, ...done]} ctx={ctx} />
      <Composer bucket="none" ctx={ctx} label="＋ 새로운 할 일 추가" />
    </section>
  );
}

export type SideTab = "cal" | "inbox";

/**
 * 왼쪽 사이드바 맨 위 탭: [달력 | 날짜 미정 N]. 보기 전환과 같은 모양(작게).
 * 달력 탭을 보고 있을 때도 "날짜 미정" 탭 위로 카드를 끌어다 놓으면 날짜가 비워짐
 */
export function SideTabs({ tab, onTab, ctx }: { tab: SideTab; onTab: (t: SideTab) => void; ctx: BoardCtx }) {
  const n = ctx.inBucket("none").filter((t) => !t.done).length;
  const dropHere = tab === "cal" && !!ctx.drag && !ctx.drag.catTarget && ctx.drag.zone === "none";
  return (
    <div className="views side-tabs" role="tablist" aria-label="왼쪽 영역" style={{ "--i": tab === "cal" ? 0 : 1 } as CSSProperties}>
      <span className="views-thumb" aria-hidden="true" />
      <button role="tab" aria-selected={tab === "cal"} onClick={() => onTab("cal")}>
        달력
      </button>
      <button
        role="tab"
        aria-selected={tab === "inbox"}
        className={dropHere ? "drop" : undefined}
        data-drop={tab === "cal" ? "date:none" : undefined}
        onClick={() => onTab("inbox")}
      >
        보관함{n ? <b>{n}</b> : null}
      </button>
    </div>
  );
}

export function MonthGrid({ calMonth, todayKey, ctx }: { calMonth: Date; todayKey: string; ctx: BoardCtx }) {
  const start = mondayOf(calMonth);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="month">
      <div className="mdow">
        {DOW.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mgrid">
        {cells.map((d, i) => {
          const k = key(d);
          const hol = holidayName(k);
          const wk = hol || i % 7 === 6 ? " sun" : i % 7 === 5 ? " sat" : "";
          const dropHere = !!ctx.drag && !ctx.drag.catTarget && ctx.drag.zone === k;
          const cls =
            "mcell" + wk + (d.getMonth() !== calMonth.getMonth() ? " out" : "") + (k === todayKey ? " is-today" : "") + (dropHere ? " drop" : "");
          return (
            <div key={k} className={cls} data-drop={"date:" + k}>
              <div className="mhead">
                <span className="mnum">{d.getDate()}</span>
                {hol && shortHoliday(hol) && (
                  <span className="mhol" title={hol}>
                    {shortHoliday(hol)}
                  </span>
                )}
                <button className="plus" aria-label="할 일 추가" onClick={() => ctx.setOpenBucket(k)}>
                  ＋
                </button>
                {k === todayKey ? (
                  <span className="mtag">오늘</span>
                ) : d.getDate() === 1 && d.getMonth() !== calMonth.getMonth() ? (
                  <span className="mtag">{d.getMonth() + 1}월</span>
                ) : null}
              </div>
              <CardList bucket={k} items={ctx.shown(k)} mini ctx={ctx} />
              <Composer bucket={k} ctx={ctx} formOnly />
            </div>
          );
        })}
      </div>
    </div>
  );
}
