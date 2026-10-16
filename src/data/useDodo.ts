import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bucket, Category, MemoScope, Todo } from "../lib/types";
import { bucketOf, dateOf, memoKey, nextColor } from "../lib/types";
import { byRank, rankAfter, rankLast } from "../lib/rank";
import type { Repo } from "./repo";

export interface Toast {
  id: number;
  text: string;
  kind: "info" | "err";
  action?: { label: string; run: () => void };
}

const DEFAULT_CATS = [
  { name: "집안일", color: "--cat-3" }, // 살구
  { name: "공부", color: "--cat-9" }, // 하늘
];

const uuid = () => crypto.randomUUID();

/** 앞 단어 마지막 글자에 받침이 있으면 "이", 없으면 "가" (한글이 아니면 "가") */
function iGa(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return "가";
  return code % 28 ? "이" : "가";
}

/**
 * 화면 상태 + 저장 동기화.
 * 모든 변경은 낙관적으로 화면에 먼저 반영하고, 저장이 실패하면 알리고 서버 상태를 다시 불러온다.
 * (스냅샷 롤백 대신 재조회 — 연속 조작이 겹쳐도 "서버가 진실"이라 꼬이지 않는다)
 */
export function useDodo(repo: Repo | null) {
  const [cats, setCatsState] = useState<Category[]>([]);
  /** memoKey(scope, period) → 본문 */
  const [memos, setMemosState] = useState<Record<string, string>>({});
  const memosRef = useRef(memos);
  const setMemos = (next: Record<string, string>) => {
    memosRef.current = next;
    setMemosState(next);
  };
  const [todos, setTodosState] = useState<Todo[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [toasts, setToasts] = useState<Toast[]>([]);

  // 액션은 렌더 사이에 연달아 불릴 수 있어서, 항상 최신 값을 ref로 읽는다
  const catsRef = useRef(cats);
  const todosRef = useRef(todos);
  const pending = useRef(0);
  const toastSeq = useRef(0);
  // 첫 로드가 겹치면(StrictMode 이중 실행, 빠른 재시도) 기본 카테고리가 두 번 생기지 않게 하나로 합침
  const inflight = useRef<{ repo: Repo; p: Promise<void> } | null>(null);
  const stale = useRef(false);
  const saveSeq = useRef(0); // 불러오는 사이에 저장이 시작됐는지 판별용

  const setCats = (next: Category[]) => {
    catsRef.current = next;
    setCatsState(next);
  };
  const setTodos = (next: Todo[]) => {
    todosRef.current = next;
    setTodosState(next);
  };

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (text: string, kind: Toast["kind"] = "info", action?: Toast["action"]) => {
      const id = ++toastSeq.current;
      setToasts((ts) => [...ts.slice(-2), { id, text, kind, action }]);
      setTimeout(() => dismiss(id), kind === "err" ? 8000 : 6000);
    },
    [dismiss],
  );

  const reload = useCallback(
    (silent: boolean): Promise<void> => {
      if (!repo) return Promise.resolve();
      if (inflight.current?.repo === repo) return inflight.current.p;

      const run = async () => {
        if (!silent) setStatus("loading");
        try {
          const seq = saveSeq.current;
          const snap = await repo.load();
          if (silent && (pending.current > 0 || seq !== saveSeq.current)) {
            // 저장 중인 변경을 덮어쓰지 않음. 저장이 끝나면(이미 끝났으면 바로) 다시 불러옴
            stale.current = true;
            if (pending.current === 0) setTimeout(() => reloadRef.current(true), 0);
            return;
          }
          stale.current = false;
          let categories = snap.categories;
          if (snap.fresh) {
            // 첫 방문: 기본 카테고리 생성 (사용자가 전부 지운 경우엔 다시 만들지 않음)
            categories = [];
            for (const d of DEFAULT_CATS) {
              const c: Category = { id: uuid(), ...d, rank: rankLast(categories) };
              await repo.insertCategory(c);
              categories.push(c);
            }
          }
          setCats([...categories].sort(byRank));
          setTodos(snap.todos);
          setMemos(Object.fromEntries(snap.memos.map((m) => [memoKey(m.scope, m.period), m.body])));
          setStatus("ready");
        } catch (e) {
          console.error(e);
          if (silent) toast("최신 데이터를 못 불러왔어요. 연결을 확인해 주세요.", "err");
          else setStatus("error");
        }
      };

      const p = run().finally(() => {
        if (inflight.current?.p === p) inflight.current = null;
      });
      inflight.current = { repo, p };
      return p;
    },
    [repo, toast],
  );

  useEffect(() => {
    setCats([]);
    setTodos([]);
    setMemos({});
    if (repo) reload(false);
    else setStatus("idle");
  }, [repo, reload]);

  // 다른 기기에서 바꾼 내용: 탭에 다시 돌아올 때 새로 불러옴
  useEffect(() => {
    if (!repo) return;
    const onVis = () => {
      if (document.visibilityState === "visible" && pending.current === 0) reload(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [repo, reload]);

  // 저장 중에 창을 닫으려 하면 경고
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (pending.current > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const save = useCallback(
    (remote: () => Promise<void>) => {
      pending.current++;
      saveSeq.current++;
      remote()
        .catch((e) => {
          console.error(e);
          // 원인 파악용으로 DB 오류 코드·메시지를 짧게 덧붙임 (예: 23503 foreign key …)
          const detail = e && typeof e === "object" ? [(e as { code?: string }).code, (e as { message?: string }).message].filter(Boolean).join(" ") : "";
          toast("저장하지 못했어요. 마지막으로 저장된 상태로 되돌릴게요." + (detail ? ` (${detail.slice(0, 120)})` : ""), "err");
          stale.current = true;
        })
        .finally(() => {
          pending.current--;
          if (pending.current === 0 && stale.current) reload(true);
        });
    },
    [reload, toast],
  );

  const sortedIn = (b: Bucket, exceptId?: string) =>
    todosRef.current.filter((t) => bucketOf(t) === b && t.id !== exceptId).sort(byRank);

  const actions = useMemo(() => {
    if (!repo) return null;
    const patchTodo = (id: string, patch: Partial<Omit<Todo, "id">>) => {
      setTodos(todosRef.current.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      save(() => repo.updateTodo(id, patch));
    };

    return {
      addTodo(bucket: Bucket, text: string, categoryId: string | null) {
        const t: Todo = { id: uuid(), text, categoryId, date: dateOf(bucket), done: false, rank: rankLast(sortedIn(bucket)) };
        setTodos([...todosRef.current, t]);
        save(() => repo.insertTodo(t));
        return t.id;
      },
      toggleDone(id: string) {
        const t = todosRef.current.find((x) => x.id === id);
        if (t) patchTodo(id, { done: !t.done });
      },
      /** 제목·카테고리 수정 — 바뀐 게 있을 때만 저장 */
      editTodo(id: string, patch: { text: string; categoryId: string | null }) {
        const t = todosRef.current.find((x) => x.id === id);
        if (!t) return;
        const diff: Partial<Todo> = {};
        if (patch.text !== t.text) diff.text = patch.text;
        if (patch.categoryId !== t.categoryId) diff.categoryId = patch.categoryId;
        if (Object.keys(diff).length) patchTodo(id, diff);
      },
      setCategory(id: string, categoryId: string | null) {
        const t = todosRef.current.find((x) => x.id === id);
        if (t && t.categoryId !== categoryId) patchTodo(id, { categoryId });
      },
      /** bucket 칸에서 prevId 바로 뒤로 옮김. categoryId를 넘기면(null 포함) 카테고리도 바꿈 */
      moveTodo(id: string, bucket: Bucket, prevId: string | null, categoryId?: string | null) {
        const t = todosRef.current.find((x) => x.id === id);
        if (!t) return;
        const date = dateOf(bucket);
        const catChange = categoryId !== undefined && categoryId !== t.categoryId;
        if (t.date === date && !catChange) {
          const full = sortedIn(bucket);
          const i = full.findIndex((x) => x.id === id);
          if ((full[i - 1]?.id ?? null) === prevId) return; // 제자리
        }
        const patch: Partial<Todo> = { date, rank: rankAfter(sortedIn(bucket, id), prevId) };
        if (catChange) patch.categoryId = categoryId;
        patchTodo(id, patch);
      },
      deleteTodo(id: string) {
        const t = todosRef.current.find((x) => x.id === id);
        if (!t) return;
        setTodos(todosRef.current.filter((x) => x.id !== id));
        save(() => repo.deleteTodo(id));
        const name = t.text.length > 18 ? t.text.slice(0, 18) + "…" : t.text;
        toast(`[${name}]${iGa(t.text.length > 18 ? "…" : t.text)} 삭제되었습니다.`, "info", {
          label: "실행 취소",
          run: () => {
            if (todosRef.current.some((x) => x.id === id)) return;
            setTodos([...todosRef.current, t]);
            save(() => repo.restoreTodo(id));
          },
        });
      },
      addCategory(name: string) {
        const list = catsRef.current;
        const c: Category = { id: uuid(), name, color: nextColor(list.map((x) => x.color)), rank: rankLast(list) };
        setCats([...list, c]);
        save(() => repo.insertCategory(c));
      },
      updateCategory(id: string, patch: Partial<Pick<Category, "name" | "color">>) {
        const c = catsRef.current.find((x) => x.id === id);
        if (!c) return;
        if ((patch.name === undefined || patch.name === c.name) && (patch.color === undefined || patch.color === c.color)) return;
        setCats(catsRef.current.map((x) => (x.id === id ? { ...x, ...patch } : x)));
        save(() => repo.updateCategory(id, patch));
      },
      deleteCategory(id: string) {
        const list = catsRef.current;
        const c = list.find((x) => x.id === id);
        if (!c) return;
        const moved = todosRef.current.filter((t) => t.categoryId === id).length;
        setTodos(todosRef.current.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)));
        setCats(list.filter((x) => x.id !== id));
        save(() => repo.deleteCategory(id));
        toast(
          `[${c.name}]${iGa(c.name)} 삭제되었습니다.` + (moved ? ` 할 일 ${moved}개는 [카테고리 없음]으로 이동했습니다.` : ""),
        );
      },
      saveMemo(scope: MemoScope, period: string, body: string) {
        const k = memoKey(scope, period);
        if ((memosRef.current[k] ?? "") === body) return;
        setMemos({ ...memosRef.current, [k]: body });
        save(() => repo.saveMemo(scope, period, body));
      },
      exportJson() {
        const blob = new Blob(
          [JSON.stringify({ exportedAt: new Date().toISOString(), categories: catsRef.current, todos: todosRef.current, memos: memosRef.current }, null, 2)],
          { type: "application/json" },
        );
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `dodo-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, save, toast]);

  return { cats, todos, memos, status, toasts, dismiss, actions, retry: () => reload(false) };
}

export type Actions = NonNullable<ReturnType<typeof useDodo>["actions"]>;
