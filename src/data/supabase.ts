import { createClient } from "@supabase/supabase-js";
import type { Category, Memo, Todo } from "../lib/types";
import type { Repo, Snapshot } from "./repo";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Publishable key(sb_publishable_...) 권장. 예전 anon 키도 받아줌
const anon = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

/** 환경변수가 없으면 null → 앱은 로컬 모드로 동작 */
export const supabase =
  url && anon
    ? createClient(url, anon, {
        // keepalive: 탭을 닫는 순간 보낸 저장(메모 자동저장 등)도 끝까지 전송됨. 요청 본문은 최대 15KB 수준이라 64KB 한도 안
        global: { fetch: (input, init) => fetch(input, { ...init, keepalive: true }) },
      })
    : null;

interface TodoRow {
  id: string;
  text: string;
  category_id: string | null;
  date: string | null;
  done: boolean;
  rank: string;
}

const fromRow = (r: TodoRow): Todo => ({
  id: r.id,
  text: r.text,
  categoryId: r.category_id,
  date: r.date,
  done: r.done,
  rank: r.rank,
});

function toRow(p: Partial<Omit<Todo, "id">>) {
  const r: Record<string, unknown> = {};
  if (p.text !== undefined) r.text = p.text;
  if (p.categoryId !== undefined) r.category_id = p.categoryId;
  if (p.date !== undefined) r.date = p.date;
  if (p.done !== undefined) r.done = p.done;
  if (p.rank !== undefined) r.rank = p.rank;
  return r;
}

function check<T extends { error: unknown }>(res: T): T {
  if (res.error) throw res.error;
  return res;
}

/** Supabase는 한 번에 최대 1000행만 준다 — 오래 쓴 사용자도 다 받아오도록 페이지로 나눠 읽음 */
async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const client = supabase!;
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data } = check(
      await client.from(table).select(columns).is("deleted_at", null).order("id").range(from, from + page - 1),
    );
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

/** 메모는 소프트 삭제·id 컬럼이 없어서 따로 페이지 나눠 읽음 */
async function selectMemos(): Promise<Memo[]> {
  const page = 1000;
  const out: Memo[] = [];
  for (let from = 0; ; from += page) {
    const { data } = check(
      await supabase!.from("memos").select("scope,period,body").order("scope").order("period").range(from, from + page - 1),
    );
    const rows = (data ?? []) as Memo[];
    out.push(...rows);
    if (rows.length < page) return out;
  }
}

export function supabaseRepo(): Repo {
  const db = supabase!;
  return {
    async load(): Promise<Snapshot> {
      const [categories, todos, memos] = await Promise.all([
        selectAll<Category>("categories", "id,name,color,rank"),
        selectAll<TodoRow>("todos", "id,text,category_id,date,done,rank"),
        selectMemos(),
      ]);
      return { categories, todos: todos.map(fromRow), memos };
    },
    async insertTodo(t) {
      check(await db.from("todos").insert({ id: t.id, ...toRow(t) }));
    },
    async updateTodo(id, patch) {
      check(await db.from("todos").update(toRow(patch)).eq("id", id));
    },
    async deleteTodo(id) {
      check(await db.from("todos").update({ deleted_at: new Date().toISOString() }).eq("id", id));
    },
    async restoreTodo(id) {
      check(await db.from("todos").update({ deleted_at: null }).eq("id", id));
    },
    async insertCategory(c) {
      check(await db.from("categories").insert(c));
    },
    async updateCategory(id, patch) {
      check(await db.from("categories").update(patch).eq("id", id));
    },
    async deleteCategory(id) {
      check(await db.rpc("delete_category", { p_id: id }));
    },
    async deleteAccount() {
      check(await db.rpc("delete_my_account"));
      // 계정이 지워졌으니 이 브라우저의 로그인 정보만 정리 (서버 세션은 이미 없음)
      await db.auth.signOut({ scope: "local" });
    },
    async saveMemo(scope, period, body) {
      // user_id는 DB 기본값(auth.uid())으로 채워지고, 충돌 판정에도 그 값이 쓰임
      check(await db.from("memos").upsert({ scope, period, body }, { onConflict: "user_id,scope,period" }));
    },
  };
}
