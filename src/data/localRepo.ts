import type { Category, Memo, Todo } from "../lib/types";
import type { Repo, Snapshot } from "./repo";

/** Supabase 연결 전 개발·체험용. 이 브라우저 localStorage에만 저장 */
const KEY = "dodo:v1";

type Deletable<T> = T & { deletedAt?: string | null };
interface Stored {
  categories: Deletable<Category>[];
  todos: Deletable<Todo>[];
  memos: Memo[];
}

function read(): Stored {
  const raw = localStorage.getItem(KEY);
  if (!raw) return { categories: [], todos: [], memos: [] };
  // 파싱이 실패하면 빈 값으로 덮어쓰지 않고 에러를 낸다 — 데이터 보존이 우선
  const s = JSON.parse(raw) as Stored;
  return { categories: s.categories ?? [], todos: s.todos ?? [], memos: s.memos ?? [] };
}

function write(s: Stored) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

function mutate(fn: (s: Stored) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const s = read();
      fn(s);
      write(s);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

const live = <T,>(x: Deletable<T>) => !x.deletedAt;
const strip = <T,>({ deletedAt: _d, ...rest }: Deletable<T>) => rest as T;

export const localRepo: Repo = {
  async load(): Promise<Snapshot> {
    const s = read();
    return {
      categories: s.categories.filter(live).map(strip<Category>),
      todos: s.todos.filter(live).map(strip<Todo>),
      memos: s.memos,
    };
  },
  insertTodo: (t) => mutate((s) => void s.todos.push({ ...t, deletedAt: null })),
  updateTodo: (id, patch) =>
    mutate((s) => {
      const t = s.todos.find((x) => x.id === id);
      if (!t) throw new Error("todo not found: " + id);
      Object.assign(t, patch);
    }),
  deleteTodo: (id) =>
    mutate((s) => {
      const t = s.todos.find((x) => x.id === id);
      if (t) t.deletedAt = new Date().toISOString();
    }),
  restoreTodo: (id) =>
    mutate((s) => {
      const t = s.todos.find((x) => x.id === id);
      if (t) t.deletedAt = null;
    }),
  insertCategory: (c) => mutate((s) => void s.categories.push({ ...c, deletedAt: null })),
  updateCategory: (id, patch) =>
    mutate((s) => {
      const c = s.categories.find((x) => x.id === id);
      if (!c) throw new Error("category not found: " + id);
      Object.assign(c, patch);
    }),
  deleteCategory: (id) =>
    mutate((s) => {
      s.todos.forEach((t) => {
        if (t.categoryId === id) t.categoryId = null;
      });
      const c = s.categories.find((x) => x.id === id);
      if (c) c.deletedAt = new Date().toISOString();
    }),
  saveMemo: (scope, period, body) =>
    mutate((s) => {
      const m = s.memos.find((x) => x.scope === scope && x.period === period);
      if (m) m.body = body;
      else s.memos.push({ scope, period, body });
    }),
  async deleteAccount() {
    localStorage.removeItem(KEY);
  },
};
