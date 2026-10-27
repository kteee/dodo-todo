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
import { Column, DayView, InboxSection, MemoSection, MonthGrid, NOCAT_COLOR, displayOrder, type BoardCtx } from "./components/Board";
import { MemoBox } from "./components/SideColumn";
import { Categories, MiniCal, TodayBlock } from "./components/Sidebar";
import { GoogleButton, TopNav, type View } from "./components/TopNav";
import { OptionsMenu } from "./components/OptionsMenu";
import { TitleBar, WEEK_LAYOUTS, type Tab, type WeekLayout } from "./components/TitleBar";
import { QuickAdd } from "./components/QuickAdd";
import { MyPage } from "./components/MyPage";
import { Search } from "./components/Search";
import { Toasts } from "./components/Toasts";
import { SiteFooter } from "./components/SiteFooter";
import { isPhone, usePhone } from "./hooks/usePhone";
import { FONTS, readFont, saveFont, type Font } from "./lib/font";
import { TEXT_SIZES, effectiveTextSize, readTextSize, saveTextSize, type TextSize } from "./lib/textSize";

/* 보기 옵션은 이 브라우저에만 기억 (사생활 모드 등에서 저장이 막혀도 기본값으로 동작) */
const MEMO_PREF = "dodo:showMemo";
const WEEK_LAYOUT_PREF = "dodo:weekLayout"; // 주간 보기: rows(두 줄, 기본) · wide(가로 한 줄) · vert(세로)
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
const HIDE_DONE_PREF = "dodo:hideDone";
const CAT_SHOW_PREF = "dodo:catShow"; // 할 일의 카테고리 표시: chip(기본) · dot · none
type CatShow = "chip" | "dot" | "none";
const CAT_SHOWS: [CatShow, string][] = [
  ["chip", "칩"],
  ["dot", "점"],
  ["none", "숨김"],
];
const GROUP_PREF = "dodo:groupBy";
const FOLD_PREF = "dodo:sideFolded"; // 왼쪽 달력·카테고리 접기 (날짜 줄 왼쪽 버튼)
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
  // 두두다이어리 홈(dododiary.com)의 로그인 화면에서 "Google 계정으로 로그인"을 누르면 ?login=google 로 넘어옴
  // → 로그인 안 된 상태면 바로 구글 로그인 시작, 이미 로그인돼 있으면 주소만 정리하고 보드로
  useEffect(() => {
    if (auth.status === "loading") return;
    const q = new URLSearchParams(location.search);
    if (q.get("login") !== "google") return;
    q.delete("login");
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash);
    if (auth.status === "out") signIn();
  }, [auth.status]);
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
  const [font, setFontState] = useState<Font>(readFont);
  /** 글자 크기: 저장된 선택(없으면 자동). 자동일 땐 화면 폭으로 "보통/크게" 중 지금 적용된 쪽을 표시 */
  const [textSize, setTextSizeState] = useState<TextSize | null>(readTextSize);
  const [view, setView] = useState<View>(defaultView);
  const [selected, setSelected] = useState(todayKey);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [calMonth, setCalMonth] = useState(() => firstOfMonth(today));
  const [hideDone, setHideDoneState] = useState(() => readPref(HIDE_DONE_PREF, false));
  const [catShow, setCatShowState] = useState<CatShow>(() => {
    try {
      const v = localStorage.getItem(CAT_SHOW_PREF);
      return v === "dot" || v === "none" ? v : "chip";
    } catch {
      return "chip";
    }
  });
  const setCatShow = (v: CatShow) => {
    setCatShowState(v);
    try {
      localStorage.setItem(CAT_SHOW_PREF, v);
    } catch {
      /* 저장 못 해도 이번 화면에서는 적용됨 */
    }
  };
  // 모양은 CSS가 html[data-cat] 로 바꿈 (글자 크기 설정과 같은 방식)
  useEffect(() => {
    document.documentElement.dataset.cat = catShow;
  }, [catShow]);
  const setHideDone = (v: boolean) => {
    setHideDoneState(v);
    writePref(HIDE_DONE_PREF, v);
  };
  /** 보관함(날짜 없는 할 일)을 본문에 펼친 상태 — 제목 영역의 보기 전환 4번째 탭. 보기(view)는 그대로 둔 채 겹쳐 열림 */
  const [inboxOpen, setInboxOpen] = useState(false);
  /** 헤더 ＋ 할 일 추가 팝업 */
  const [quickOpen, setQuickOpen] = useState(false);
  const [showMemo, setShowMemo] = useState(() => readPref(MEMO_PREF, true));
  const [weekLayout, setWeekLayoutState] = useState<WeekLayout>(() => {
    try {
      const v = localStorage.getItem(WEEK_LAYOUT_PREF);
      return v === "wide" || v === "vert" ? v : "rows";
    } catch {
      return "rows";
    }
  });
  const setWeekLayout = (l: WeekLayout) => {
    setWeekLayoutState(l);
    try {
      localStorage.setItem(WEEK_LAYOUT_PREF, l);
    } catch {
      /* 저장 못 해도 이번 화면에서는 적용됨 */
    }
  };
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
  // 카드를 누르면 그 자리 수정 대신 "할 일 상세" 모달 — 이름·날짜·카테고리를 한곳에서 바꿈
  const editingId: string | null = null;
  const [detailId, setDetailId] = useState<string | null>(null);
  const setEditingId = useCallback((id: string | null) => setDetailId(id), []);
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
  const detailTodo = detailId ? (todos.find((t) => t.id === detailId) ?? null) : null;
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
    const moving = todos.find((t) => t.id === d.id);
    const grouped = groupBy && !mini && d.group !== null;
    let prev: Todo | null;
    if (grouped) {
      // 손가락이 있던 그룹 안에서만 자리를 정함. beforeId 가 그 그룹 밖(다음 그룹 첫 카드)이면 그룹 맨 아래
      const inG = items.filter((t) => (catOf(t.categoryId)?.id ?? NO_CAT) === d.group);
      const at = d.beforeId ? inG.findIndex((t) => t.id === d.beforeId) : -1;
      prev = at >= 0 ? (inG[at - 1] ?? null) : (inG[inG.length - 1] ?? null);
      // 그룹이 비어 있으면(첫 카드) 앞 그룹의 마지막 카드 뒤
      if (!prev && !inG.length) {
        const flatAt = d.beforeId ? items.findIndex((t) => t.id === d.beforeId) : -1;
        prev = flatAt >= 0 ? (items[flatAt - 1] ?? null) : (items[items.length - 1] ?? null);
      }
    } else {
      const at = d.beforeId ? items.findIndex((t) => t.id === d.beforeId) : -1;
      prev = at >= 0 ? (items[at - 1] ?? null) : (items[items.length - 1] ?? null);
    }
    let catId: string | null | undefined; // undefined = 카테고리는 그대로
    if (grouped && moving && bucketOf(moving) === d.zone) {
      // 카테고리별 보기에서 같은 칸 안에서 다른 그룹으로 옮기면 그 그룹의 카테고리로 바뀜 ("카테고리 없음" 그룹이면 null).
      // 다른 날짜로 옮기는 건 날짜만 바꾸는 것 — 그 날에 내 카테고리 그룹이 없다고 해서 남의 카테고리로 바뀌면 안 됨
      catId = d.group === NO_CAT ? null : d.group;
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
    onAdd: (b, text, catId, first) => {
      const id = actions?.addTodo(b, text, catId, first);
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
    editingCaret: null,
    editingChip: false,
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
  const onTab = (t: Tab) => {
    if (t === "inbox") {
      setInboxOpen(true);
      return;
    }
    setInboxOpen(false);
    changeView(t);
  };
  /** 헤더 ＋ 할 일 추가: 팝업으로 할 일·날짜·카테고리를 받아 추가 */
  const quickAdd = () => setQuickOpen(true);
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
    } else {
      setInboxOpen(true); // 날짜 없는 할 일은 보관함(보기 전환 탭)에
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

  // 왼쪽 달력·카테고리 접기: 어느 보기에서나 (제목 왼쪽 버튼). 폰은 서랍이라 해당 없음
  const sideFolded = !phone && folded;

  /* ── 오른쪽 칸: 보고 있는 기간의 메모 + 언젠가 할 일 ── */
  const [memoScope, memoPeriod]: [MemoScope, string] =
    view === "day" ? ["day", selected] : view === "week" ? ["week", key(weekStart)] : ["month", key(calMonth).slice(0, 7)];
  const memoProps = {
    scope: memoScope,
    period: memoPeriod,
    value: store.memos[memoKey(memoScope, memoPeriod)] ?? "",
    onSave: (sc: MemoScope, pe: string, body: string) => actions?.saveMemo(sc, pe, body),
    onDirty: (d: boolean) => actions?.markDirty("memo", d),
  };
  /** 보기 맨 아래 접이식 메모 (일간은 DayView 안에서 그림) */
  const memoSection = showMemo ? (
    <MemoSection memo={<MemoBox {...memoProps} bare autoGrow />} memoText={memoProps.value} label={view === "week" ? "주간 메모" : "월간 메모"} />
  ) : null;

  /* ── 제목 영역 문구 ── */
  const stats = (keys: string[]) => {
    let total = 0;
    let done = 0;
    for (const k of keys) {
      for (const t of inBucket(k)) {
        total++;
        if (t.done) done++;
      }
    }
    return { total, done };
  };
  const weekKeys = Array.from({ length: 7 }, (_, i) => key(addDays(weekStart, i)));
  const inboxLeft = inBucket("none").filter((t) => !t.done).length;
  let title: string;
  let sub: string;
  // 일·주·월 공통 부제: 할 일이 없으면 한 문장, 있으면 진행 상황
  const progress = (total: number, done: number) => (total === 0 ? "할 일이 없습니다." : `${total}개의 할 일 중 ${done}개를 완료했어요.`);
  if (inboxOpen) {
    title = "보관함";
    sub = inboxLeft ? `아직 날짜를 정하지 않은 ${inboxLeft}개의 할 일이 있어요.` : "할 일이 없습니다.";
  } else if (view === "day") {
    const sd = parse(selected);
    const { total, done } = stats([selected]);
    title = `${sd.getFullYear()}년 ${sd.getMonth() + 1}월 ${sd.getDate()}일`;
    sub = progress(total, done);
  } else if (view === "week") {
    const a = weekStart;
    const b = addDays(weekStart, 6);
    const { total, done } = stats(weekKeys);
    title = `${a.getMonth() + 1}월 ${a.getDate()}일 – ${b.getMonth() + 1}월 ${b.getDate()}일`;
    sub = progress(total, done);
  } else {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const days = new Date(y, m + 1, 0).getDate();
    const { total, done } = stats(Array.from({ length: days }, (_, i) => key(new Date(y, m, i + 1))));
    title = `${y}년 ${m + 1}월`;
    sub = progress(total, done);
  }
  const sideDate = view === "day" ? selected : todayKey;
  const sideStats = stats([sideDate]);

  /* ── 보드 ── */
  let board: ReactNode;
  if (view === "week") {
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
              topRight={k === todayKey ? "오늘" : d.getDate() === 1 ? `${d.getMonth() + 1}월` : undefined}
              countStyle="open"
              ctx={ctx}
            />
          );
        })}
      </>
    );
  } else if (view === "day") {
    board = (
      <DayView
        dateKey={selected}
        todayKey={todayKey}
        weekStart={weekStart}
        onPick={(k) => {
          setInboxOpen(false);
          pickDay(k);
        }}
        ctx={ctx}
        memo={showMemo ? <MemoBox {...memoProps} bare autoGrow /> : null}
        memoText={memoProps.value}
      />
    );
  } else {
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
  } else if (inboxOpen) {
    main = (
      <div className="board v-inbox">
        <InboxSection ctx={ctx} />
      </div>
    );
  } else {
    main = (
      <>
        <div className={"board v-" + view + " no-inbox" + (view === "week" && weekLayout !== "rows" ? " " + weekLayout : "")}>{board}</div>
        {view !== "day" && memoSection}
      </>
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
        </main>
        <SiteFooter />
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
          onDeleteTodoData={async () => {
            if (!actions) throw new Error("not ready");
            await actions.deleteTodoData();
          }}
          onDeleteAccount={async () => {
            if (!actions) throw new Error("not ready");
            await actions.deleteAccount();
          }}
        />
        <SiteFooter />
      </div>
    );
  }

  const sideInner = (
    <>
      <TodayBlock dateKey={sideDate} todayKey={todayKey} total={sideStats.total} done={sideStats.done} />
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
          setInboxOpen(false);
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

  /* 보기 옵션 — 제목 줄 ‹ 오늘 › 오른쪽 끝 (주간이면 배치 전환도) */
  const viewOptions = ready ? (
    <OptionsMenu
      label="보기 옵션"
      className="viewopt"
      icon={
        /* 조절 슬라이더 아이콘: 가로 선 두 개 + 손잡이 */
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 5h12M2 11h12" />
          <circle cx="10" cy="5" r="1.9" fill="var(--bg)" />
          <circle cx="6" cy="11" r="1.9" fill="var(--bg)" />
        </svg>
      }
    >
      {view === "week" && !inboxOpen && !phone && (
        <>
          <p className="optsec">주간 보기</p>
          <div className="optseg" role="radiogroup" aria-label="주간 보기">
            {WEEK_LAYOUTS.map(([l, name]) => (
              <button key={l} role="radio" aria-checked={weekLayout === l} onClick={() => setWeekLayout(l)}>
                {name}
              </button>
            ))}
          </div>
        </>
      )}
        <p className="optsec">카테고리 표시</p>
        <div className="optseg" role="radiogroup" aria-label="카테고리 표시">
          {CAT_SHOWS.map(([v, name]) => (
            <button key={v} role="radio" aria-checked={catShow === v} onClick={() => setCatShow(v)}>
              {name}
            </button>
          ))}
        </div>
        <p className="optsec">보기 옵션</p>
        <label className="togg">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> 완료 숨기기
        </label>
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
    </OptionsMenu>
  ) : null;

  /* 설정(톱니바퀴) — 헤더 오른쪽: 시작 화면·글꼴·글자 크기 */
  const options = (
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
        <p className="optsec">글꼴</p>
        <div className="optseg" role="radiogroup" aria-label="글꼴">
          {FONTS.map(([f, name]) => (
            <button
              key={f}
              role="radio"
              aria-checked={font === f}
              data-font-preview={f}
              onClick={() => {
                setFontState(f);
                saveFont(f);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <p className="optsec">글자 크기</p>
        <div className="optseg" role="radiogroup" aria-label="글자 크기">
          {TEXT_SIZES.map(([sz, name]) => (
            <button
              key={sz}
              role="radio"
              aria-checked={effectiveTextSize(textSize) === sz}
              onClick={() => {
                setTextSizeState(sz);
                saveTextSize(sz);
              }}
            >
              {name}
            </button>
          ))}
        </div>
    </OptionsMenu>
  );

  return (
    <div className="page">
      <TopNav
        search={ready ? <Search todos={todos} catOf={catOf} onPick={goToTodo} /> : null}
        options={ready ? options : undefined}
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
        ) : sideFolded ? null : (
          <aside className="side">
            {/* 왼쪽 영역 맨 위: [달력 | 날짜 미정] 탭 + 오른쪽 끝에 이 영역을 접는 버튼 */}
            <div className="side-top">
              <button className="side-tg" aria-label="달력·카테고리 접기" title="접기" onClick={() => toggleFold(true)}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
                  <path d="M6 2.5v11" />
                </svg>
              </button>
            </div>
            {sideInner}
          </aside>
        )}
        <main className="main" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>
          <TitleBar
            tab={inboxOpen ? "inbox" : view}
            onTab={onTab}
            inboxCount={inboxLeft}
            title={title}
            sub={sub}
            onStep={inboxOpen ? undefined : step}
            onToday={inboxOpen ? undefined : goToday}
            options={viewOptions}
            action={
              ready ? (
                <button className="quickadd" onClick={quickAdd} title="할 일 추가">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 3v10M3 8h10" />
                  </svg>
                  <span>할 일 추가</span>
                </button>
              ) : null
            }
            left={
              <>
                {sideFolded && (
                  <button className="side-tg" aria-label="달력·카테고리 펼치기" title="펼치기" onClick={() => toggleFold(false)}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
                      <path d="M6 2.5v11" />
                    </svg>
                  </button>
                )}
                {phone && (
                  <button className="side-btn" aria-label="달력과 카테고리 열기" aria-expanded={drawer} onClick={() => setDrawer(true)}>
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <rect x="2" y="3" width="12" height="11" rx="2" />
                      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
                    </svg>
                  </button>
                )}
              </>
            }
          />
          {main}
        </main>
      </div>
      {store.net.offline && (
        <div className="netbar" role="status">
          연결이 끊겼어요. 저장 대기 중 {store.net.waiting}건 — 연결되면 자동으로 저장돼요.
        </div>
      )}
      {detailTodo && ready && (
        <QuickAdd
          key={detailTodo.id}
          todo={detailTodo}
          cats={cats}
          defaultDate={todayKey}
          onAdd={(b, text, catId) => {
            if (!actions) return;
            const t = detailTodo;
            actions.editTodo(t.id, { text, categoryId: catId });
            // 날짜가 바뀌면 그 날 맨 아래로
            if (b !== bucketOf(t)) {
              const there = inBucket(b).filter((x) => x.id !== t.id);
              actions.moveTodo(t.id, b, there[there.length - 1]?.id ?? null);
            }
          }}
          onClose={() => setDetailId(null)}
        />
      )}
      {quickOpen && ready && (
        <QuickAdd
          cats={cats}
          defaultDate={todayKey}
          onAdd={(b, text, catId) => {
            ctx.onAdd(b, text, catId);
            // 적은 날이 화면에 없으면 그 날 일간으로 가서 보여줌. 보관함이면 보관함 탭으로
            if (b === "none") setInboxOpen(true);
            else if (view === "day" && b !== selected) pickDay(b);
          }}
          onClose={() => setQuickOpen(false)}
        />
      )}
      <Toasts toasts={store.toasts} dismiss={store.dismiss} />
    </div>
  );
}

