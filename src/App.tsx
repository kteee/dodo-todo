import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Bucket, Todo } from "./lib/types";
import { NONE, NO_CAT, bucketOf, memoKey, type MemoScope } from "./lib/types";
import { DOW, addDays, addMonths, firstOfMonth, key, mondayOf, parse } from "./lib/date";
import { byRank } from "./lib/rank";
import { holidayName } from "./lib/holidays";
import { localRepo } from "./data/localRepo";
import { supabaseRepo } from "./data/supabase";
import { signIn, signOut, useAuth } from "./data/auth";
import { useDodo } from "./data/useDodo";
import { useDrag, type DragState } from "./hooks/useDrag";
import { useToday } from "./hooks/useToday";
import { Column, MonthGrid, NOCAT_COLOR, displayOrder, type BoardCtx } from "./components/Board";
import { SideColumn } from "./components/SideColumn";
import { Categories, MiniCal } from "./components/Sidebar";
import { GoogleButton, TopNav, ViewSwitch, type View } from "./components/TopNav";
import { OptionsMenu } from "./components/OptionsMenu";
import { MyPage } from "./components/MyPage";
import { Search } from "./components/Search";
import { Toasts } from "./components/Toasts";
import { isPhone, usePhone } from "./hooks/usePhone";

/* 보기 옵션은 이 브라우저에만 기억 (사생활 모드 등에서 저장이 막혀도 기본값으로 동작) */
const INBOX_PREF = "dodo:showInbox";
const MEMO_PREF = "dodo:showMemo";
const DEFAULT_VIEW_PREF = "dodo:defaultView"; // 앱을 열 때 처음 보여줄 보기
function readView(): View {
  try {
    const v = localStorage.getItem(DEFAULT_VIEW_PREF);
    if (v === "day" || v === "week" || v === "month") return v;
  } catch {
    /* 저장소를 못 읽으면 기본값 */
  }
  // 정한 적 없으면: 폰은 하루 보기(한 화면에 하루가 딱 맞음), 큰 화면은 주간
  return isPhone() ? "day" : "week";
}
const WIDE_PREF = "dodo:wideWeek"; // 주간 "가로 보기"(한 줄). 기본은 두 줄
const HIDE_DONE_PREF = "dodo:hideDone";
const GROUP_PREF = "dodo:groupBy";
const FOLD_PREF = "dodo:sideFolded"; // 가로 보기에서 왼쪽 달력·카테고리 접기
function readPref(k: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(k);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function writePref(k: string, v: boolean) {
  try {
    localStorage.setItem(k, v ? "1" : "0");
  } catch {
    /* 저장 못 해도 이번 화면에서는 적용됨 */
  }
}

export default function App() {
  const auth = useAuth();
  const userId = auth.status === "in" ? auth.account.id : null;
  // 사용자가 바뀌면 저장소도 새로 — 이전 사용자 데이터가 섞이지 않게
  const repo = useMemo(() => (!userId ? null : auth.mode === "local" ? localRepo : supabaseRepo()), [userId, auth.mode]);
  const store = useDodo(repo);
  const { cats, todos, actions } = store;

  const today = useToday();
  const todayKey = key(today);
  const [defaultView, setDefaultViewState] = useState<View>(readView);
  const setDefaultView = (v: View) => {
    setDefaultViewState(v);
    try {
      localStorage.setItem(DEFAULT_VIEW_PREF, v);
    } catch {
      /* 저장 못 해도 이번 화면에서는 적용됨 */
    }
  };
  const [view, setView] = useState<View>(defaultView);
  const [selected, setSelected] = useState(todayKey);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [calMonth, setCalMonth] = useState(() => firstOfMonth(today));
  const [hideDone, setHideDoneState] = useState(() => readPref(HIDE_DONE_PREF, false));
  const setHideDone = (v: boolean) => {
    setHideDoneState(v);
    writePref(HIDE_DONE_PREF, v);
  };
  const [showInbox, setShowInbox] = useState(() => readPref(INBOX_PREF, true));
  const [showMemo, setShowMemo] = useState(() => readPref(MEMO_PREF, true));
  const [wide, setWide] = useState(() => readPref(WIDE_PREF, false));
  const twoRows = !wide;
  // 폰: 달력·카테고리는 왼쪽 서랍으로, 주간은 7일을 세로로 쌓고, 좌우로 쓸어 넘겨 날짜 이동
  const phone = usePhone();
  const [drawer, setDrawer] = useState(false);
  const [folded, setFolded] = useState(() => readPref(FOLD_PREF, false));
  const toggleFold = (v: boolean) => {
    setFolded(v);
    writePref(FOLD_PREF, v);
  };
  const [groupBy, setGroupByState] = useState(() => readPref(GROUP_PREF, false));
  const setGroupBy = (v: boolean) => {
    setGroupByState(v);
    writePref(GROUP_PREF, v);
  };
  const [openBucket, setOpenBucket] = useState<Bucket | null>(null);
  const [editCat, setEditCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; caret: number | null; chip: boolean } | null>(null);
  const editingId = editing?.id ?? null;
  const setEditingId = useCallback(
    (id: string | null, caret: number | null = null, chip = false) => setEditing(id ? { id, caret, chip } : null),
    [],
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null); // 검색으로 찾아간 카드
  const [newId, setNewId] = useState<string | null>(null); // 방금 추가한 카드
  const [poppedId, setPoppedId] = useState<string | null>(null); // 방금 체크한 카드

  const byBucket = useMemo(() => {
    const m = new Map<Bucket, Todo[]>();
    for (const t of todos) {
      const b = bucketOf(t);
      const arr = m.get(b);
      if (arr) arr.push(t);
      else m.set(b, [t]);
    }
    m.forEach((arr) => arr.sort(byRank));
    return m;
  }, [todos]);

  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);
  // 카테고리 없음, 또는 지워진 카테고리를 가리키면 null
  const catOf = useCallback((id: string | null) => (id ? (catMap.get(id) ?? null) : null), [catMap]);
  const inBucket = useCallback((b: Bucket) => byBucket.get(b) ?? [], [byBucket]);
  const shown = useCallback(
    (b: Bucket) => {
      // 완료한 할 일은 칸 맨 아래로 (남은 일끼리·완료끼리는 직접 정한 순서 유지)
      const items = inBucket(b).filter((t) => !hideDone || !t.done);
      return [...items.filter((t) => !t.done), ...items.filter((t) => t.done)];
    },
    [inBucket, hideDone],
  );

  const ctxBase = { cats, catOf, inBucket, shown, groupBy, openBucket, setOpenBucket };

  const onDrop = (d: DragState) => {
    if (!actions) return;
    if (d.catTarget) {
      actions.setCategory(d.id, d.catTarget === NO_CAT ? null : d.catTarget);
      return;
    }
    if (!d.zone) return;
    const mini = view === "month" && d.zone !== NONE;
    const items = displayOrder({ ...ctxBase, drag: null } as BoardCtx, d.zone, mini).filter((t) => t.id !== d.id);
    const at = d.beforeId ? items.findIndex((t) => t.id === d.beforeId) : -1;
    const prev = at >= 0 ? (items[at - 1] ?? null) : (items[items.length - 1] ?? null);
    let catId: string | null | undefined; // undefined = 카테고리는 그대로
    if (groupBy && !mini) {
      // 카테고리별 보기에선 놓인 그룹의 카테고리로 바뀜 ("카테고리 없음" 그룹이면 null)
      const anchor = at >= 0 ? items[at] : prev;
      if (anchor) catId = catOf(anchor.categoryId)?.id ?? null;
    }
    actions.moveTodo(d.id, d.zone, prev?.id ?? null, catId);
  };

  const drag = useDrag((id) => {
    const t = todos.find((x) => x.id === id);
    if (!t) return null;
    const c = catOf(t.categoryId);
    return { text: t.text, catName: c?.name ?? "", color: c?.color ?? NOCAT_COLOR };
  }, onDrop);

  const ctx: BoardCtx = {
    ...ctxBase,
    drag,
    onAdd: (b, text, catId) => {
      const id = actions?.addTodo(b, text, catId);
      if (id) {
        setNewId(id);
        setTimeout(() => setNewId((n) => (n === id ? null : n)), 400);
      }
    },
    onToggle: (id) => {
      setPoppedId(id);
      setTimeout(() => setPoppedId((p) => (p === id ? null : p)), 400);
      actions?.toggleDone(id);
    },
    onDelete: (id) => actions?.deleteTodo(id),
    editingId,
    editingCaret: editing?.caret ?? null,
    editingChip: editing?.chip ?? false,
    setEditingId,
    onEdit: (id, patch) => actions?.editTodo(id, patch),
    flashId,
    newId,
    poppedId,
  };

  // Esc: 열린 것들 닫기 / 바깥 클릭: 계정 메뉴 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setOpenBucket(null);
      setEditCat(null);
      setDrawer(false);
      setEditingId(null); // 할 일 수정 취소 (저장 안 함)
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.(".acct")) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  /* ── 탐색 ── */
  const changeView = (v: View) => {
    setView(v);
    if (v === "week") setWeekStart(mondayOf(parse(selected)));
    if (v === "month") setCalMonth(firstOfMonth(parse(selected)));
    setOpenBucket(null);
  };
  const pickDay = (k: string) => {
    setSelected(k);
    setWeekStart(mondayOf(parse(k)));
    if (view === "month") setCalMonth(firstOfMonth(parse(k)));
  };
  const step = (n: number) => {
    if (view === "day") {
      const d = addDays(parse(selected), n);
      setSelected(key(d));
      setWeekStart(mondayOf(d));
      setCalMonth(firstOfMonth(d));
    } else if (view === "week") {
      const w = addDays(weekStart, 7 * n);
      setWeekStart(w);
      setCalMonth(firstOfMonth(w));
    } else {
      setCalMonth(addMonths(calMonth, n));
    }
  };
  /** 검색 결과로 이동: 그 할 일이 보이는 날짜·주·달로 옮기고, 카드를 잠깐 반짝여서 찾기 쉽게 */
  const goToTodo = (t: Todo) => {
    if (t.date) {
      const d = parse(t.date);
      setSelected(t.date);
      setWeekStart(mondayOf(d));
      setCalMonth(firstOfMonth(d));
    } else if (!showInbox) {
      setShowInbox(true); // 언젠가 할 일이 꺼져 있으면 켜서 보여줌
      writePref(INBOX_PREF, true);
    }
    if (t.done && hideDone) setHideDone(false); // 완료 숨기기 중이면 풀어야 보임
    setFlashId(t.id);
    setTimeout(() => {
      document.querySelector(`.card[data-id="${t.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 60);
    setTimeout(() => setFlashId((f) => (f === t.id ? null : f)), 1800);
  };

  /** 폰에서 보드를 좌우로 쓸어 넘기면 이전·다음 날/주/달. 입력칸 안이나 카드 드래그 중엔 무시 */
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const onSwipeStart = (e: React.TouchEvent) => {
    if (!phone || (e.target as Element).closest("input, textarea, select")) return;
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onSwipeEnd = (e: React.TouchEvent) => {
    const st = swipe.current;
    swipe.current = null;
    if (!st || document.body.classList.contains("dragging")) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x;
    const dy = t.clientY - st.y;
    if (Date.now() - st.t < 600 && Math.abs(dx) > 70 && Math.abs(dy) < 50) step(dx < 0 ? 1 : -1);
  };

  const goToday = () => {
    setSelected(todayKey);
    setWeekStart(mondayOf(today));
    setCalMonth(firstOfMonth(today));
  };

  // 왼쪽 접기는 가로 보기(주간 한 줄)에서만 — 칸이 좁은 보기라서
  // 왼쪽 접기는 가로 보기(주간 한 줄)에서만 — 칸이 좁은 보기라서
  const canFold = view === "week" && wide;
  const sideFolded = canFold && folded;

  /* ── 오른쪽 칸: 보고 있는 기간의 메모 + 언젠가 할 일 ── */
  const [memoScope, memoPeriod]: [MemoScope, string] =
    view === "day" ? ["day", selected] : view === "week" ? ["week", key(weekStart)] : ["month", key(calMonth).slice(0, 7)];
  const hasSide = showMemo || showInbox;
  const weekTwoRows = view === "week" && twoRows && !phone;
  const memoProps = {
    scope: memoScope,
    period: memoPeriod,
    value: store.memos[memoKey(memoScope, memoPeriod)] ?? "",
    onSave: (sc: MemoScope, pe: string, body: string) => actions?.saveMemo(sc, pe, body),
    onDirty: (d: boolean) => actions?.markDirty("memo", d),
  };
  // 두 줄 보기: 메모는 7일 뒤 남는 8번째 칸, 언젠가 할 일은 맨 오른쪽 세로 칸(두 줄 높이)으로 따로
  // 메모를 끄면 8번째 칸이 비어 선이 끊기므로, 빈 칸을 하나 채워 테두리를 이어줌
  const side = weekTwoRows ? (
    <>
      {showMemo ? (
        <SideColumn className="slot-memo" showMemo showInbox={false} memo={memoProps} ctx={ctx} />
      ) : (
        <div className="col filler" aria-hidden="true" />
      )}
      {showInbox && <SideColumn className="slot-inbox" showMemo={false} showInbox memo={memoProps} ctx={ctx} />}
    </>
  ) : !hasSide ? null : (
    <SideColumn showMemo={showMemo} showInbox={showInbox} memo={memoProps} ctx={ctx} />
  );

  /* ── 보드 ── */
  let label: ReactNode;
  let board: ReactNode;
  if (view === "week") {
    const a = weekStart;
    const b = addDays(weekStart, 6);
    label = (
      <>
        <span className="yr">{a.getFullYear()}</span>
        {a.getMonth() + 1}월 {a.getDate()}일 - {b.getMonth() + 1}월 {b.getDate()}일
      </>
    );
    board = (
      <>
        {Array.from({ length: 7 }, (_, i) => {
          const d = addDays(weekStart, i);
          const k = key(d);
          const hol = holidayName(k);
          return (
            <Column
              key={k}
              bucket={k}
              label={DOW[i]}
              dnum={d.getDate()}
              holiday={hol}
              // 공휴일은 일요일처럼 빨간 글씨
              cls={(k === todayKey ? " is-today" : "") + (hol || i === 6 ? " sun" : i === 5 ? " sat" : "")}
              ctx={ctx}
            />
          );
        })}
        {side}
      </>
    );
  } else if (view === "day") {
    const sd = parse(selected);
    const si = (sd.getDay() + 6) % 7;
    label = (
      <>
        <span className="yr">{sd.getFullYear()}</span>
        {sd.getMonth() + 1}월 {sd.getDate()}일 {DOW[si]}요일
      </>
    );
    board = (
      <>
        <Column
          key={selected}
          bucket={selected}
          label={DOW[si] + "요일"}
          dnum={sd.getDate()}
          holiday={holidayName(selected)}
          cls={(selected === todayKey ? " is-today" : "") + (holidayName(selected) || si === 6 ? " sun" : si === 5 ? " sat" : "")}
          ctx={ctx}
        />
        {side}
      </>
    );
  } else {
    label = (
      <>
        <span className="yr">{calMonth.getFullYear()}</span>
        {calMonth.getMonth() + 1}월
      </>
    );
    board = (
      <>
        {phone ? (
          <MiniCal
            big
            calMonth={calMonth}
            onMonth={(n) => setCalMonth(addMonths(calMonth, n))}
            weekStart={weekStart}
            showWeek={false}
            selected={selected}
            todayKey={todayKey}
            inBucket={inBucket}
            catOf={catOf}
            onPick={(k) => {
              pickDay(k);
              setView("day");
              setOpenBucket(null);
            }}
          />
        ) : (
          <MonthGrid calMonth={calMonth} todayKey={todayKey} ctx={ctx} />
        )}
        {side}
      </>
    );
  }

  const account = auth.status === "in" ? auth.account : null;
  const ready = store.status === "ready" && !!actions;

  let main: ReactNode;
  if (auth.status === "loading" || (userId && (store.status === "loading" || store.status === "idle"))) {
    main = (
      <div className="gate">
        <p>불러오는 중…</p>
      </div>
    );
  } else if (auth.status === "out") {
    main = (
      <div className="gate">
        <div>
          <p>로그인 후 이용해주세요.</p>
          <GoogleButton onClick={() => signIn()} />
          <a className="gate-privacy" href="/privacy">
            개인정보 처리방침
          </a>
        </div>
      </div>
    );
  } else if (store.status === "error") {
    main = (
      <div className="gate">
        <div>
          <h3>데이터를 불러오지 못했어요</h3>
          <p>네트워크 연결을 확인하고 다시 시도해 주세요. 저장된 할 일은 안전해요.</p>
          <button className="signin" onClick={store.retry}>
            다시 시도
          </button>
        </div>
      </div>
    );
  } else {
    main = (
      <div className={"board v-" + view + (hasSide ? "" : " no-inbox") + (weekTwoRows ? " two-rows" + (showInbox ? " inbox-col" : "") : "")}>{board}</div>
    );
  }

  // 로그아웃 상태: 헤더만 두고, 달력·보드 없이 깨끗한 화면에 로그인 안내만
  if (auth.status === "out") {
    return (
      <div className="page">
        <TopNav
          account={null}
          isLocal={false}
          menuOpen={false}
          setMenuOpen={setMenuOpen}
          onSignOut={() => signOut()}
        />
        <main className="signed-out">
          <p>로그인 후 이용해주세요.</p>
          <GoogleButton onClick={() => signIn()} />
          <a className="gate-privacy" href="/privacy">
            개인정보 처리방침
          </a>
        </main>
      </div>
    );
  }

  // 마이페이지 (/my): 헤더 + 내 정보·메뉴
  if (location.pathname.replace(/\/$/, "") === "/my" && account) {
    return (
      <div className="page">
        <TopNav account={account} isLocal={auth.mode === "local"} menuOpen={menuOpen} setMenuOpen={setMenuOpen} onSignOut={() => signOut()} />
        <MyPage
          account={account}
          isLocal={auth.mode === "local"}
          onExport={ready ? actions.exportJson : null}
          onDeleteAccount={async () => {
            if (!actions) throw new Error("not ready");
            await actions.deleteAccount();
          }}
        />
      </div>
    );
  }

  const sideInner = (
    <>
      <MiniCal
        calMonth={calMonth}
        onMonth={(n) => setCalMonth(addMonths(calMonth, n))}
        weekStart={weekStart}
        showWeek={view === "week"}
        selected={selected}
        todayKey={todayKey}
        inBucket={inBucket}
        catOf={catOf}
        onPick={(k) => {
          pickDay(k);
          setDrawer(false);
        }}
      />
      {ready && (
        <Categories
          cats={cats}
          todos={todos}
          editCat={editCat}
          setEditCat={setEditCat}
          dropCat={drag?.catTarget ?? null}
          onAdd={actions.addCategory}
          onUpdate={actions.updateCategory}
          onMove={actions.moveCategory}
          onDelete={actions.deleteCategory}
        />
      )}
    </>
  );

  return (
    <div className="page">
      <TopNav
        search={ready ? <Search todos={todos} catOf={catOf} onPick={goToTodo} /> : null}
        account={account}
        isLocal={auth.mode === "local"}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        onSignOut={() => signOut()}
      />
      <div className={"app" + (sideFolded ? " side-folded" : "") + (phone ? " phone" : "")}>
        {phone ? (
          drawer && (
            <div className="drawer-back" onClick={() => setDrawer(false)}>
              <aside className="side drawer" onClick={(e) => e.stopPropagation()} aria-label="달력과 카테고리">
                {sideInner}
              </aside>
            </div>
          )
        ) : sideFolded ? (
          // 접힌 상태: 얇은 띠에 펼치기 버튼만
          <aside className="side folded">
            <button className="side-toggle" aria-label="달력·카테고리 펼치기" title="펼치기" onClick={() => toggleFold(false)}>
              »
            </button>
          </aside>
        ) : (
        <aside className="side">
          {sideInner}
          {canFold && (
            <button className="side-fold" onClick={() => toggleFold(true)}>
              « 접기
            </button>
          )}
        </aside>
        )}
        <main className="main" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          <div className="topbar">
            {phone && (
              <button className="side-btn" aria-label="달력과 카테고리 열기" aria-expanded={drawer} onClick={() => setDrawer(true)}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="2" y="3" width="12" height="11" rx="2" />
                  <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
                </svg>
              </button>
            )}
            <h2 className={"range r-" + view}>{label}</h2>
            <div className="nav">
              <button aria-label="이전" onClick={() => step(-1)}>
                ‹
              </button>
              <button className="today" onClick={goToday}>
                오늘
              </button>
              <button aria-label="다음" onClick={() => step(1)}>
                ›
              </button>
            </div>
            {/* 오른쪽 끝: "어떻게 볼지" — 일간·주간·월간 + 보기 옵션(접힘, 맨 끝) */}
            <div className="topbar-right">
            <ViewSwitch view={view} onView={changeView} />
            <OptionsMenu>
              <p className="optsec">시작 화면</p>
              {/* 한 줄 버튼식 선택 */}
              <div className="optseg" role="radiogroup" aria-label="시작 화면">
                {([
                  ["day", "일간"],
                  ["week", "주간"],
                  ["month", "월간"],
                ] as [View, string][]).map(([v, name]) => (
                  <button key={v} role="radio" aria-checked={defaultView === v} onClick={() => setDefaultView(v)}>
                    {name}
                  </button>
                ))}
              </div>
              <p className="optsec">보기 옵션</p>
              <label className="togg">
                <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> 완료 숨기기
              </label>
              {/* 주간 보기 전용: 기본은 두 줄(월~목 / 금~일+메모), 켜면 7일을 한 줄로 가로로 펼침 */}
              {view === "week" && !phone && (
                <label className="togg">
                  <input
                    type="checkbox"
                    checked={wide}
                    onChange={(e) => {
                      setWide(e.target.checked);
                      writePref(WIDE_PREF, e.target.checked);
                    }}
                  />{" "}
                  가로 보기
                </label>
              )}
              <label className="togg">
                <input type="checkbox" checked={groupBy} onChange={(e) => setGroupBy(e.target.checked)} /> 카테고리별 보기
              </label>
              <label className="togg">
                <input
                  type="checkbox"
                  checked={showMemo}
                  onChange={(e) => {
                    setShowMemo(e.target.checked);
                    writePref(MEMO_PREF, e.target.checked);
                  }}
                />{" "}
                메모 보기
              </label>
              <label className="togg">
                <input
                  type="checkbox"
                  checked={showInbox}
                  onChange={(e) => {
                    setShowInbox(e.target.checked);
                    writePref(INBOX_PREF, e.target.checked);
                  }}
                />{" "}
                날짜 미정 보기
              </label>
            </OptionsMenu>
            </div>
          </div>
          {main}
        </main>
      </div>
      {store.net.offline && (
        <div className="netbar" role="status">
          연결이 끊겼어요. 저장 대기 중 {store.net.waiting}건 — 연결되면 자동으로 저장돼요.
        </div>
      )}
      <Toasts toasts={store.toasts} dismiss={store.dismiss} />
    </div>
  );
}

