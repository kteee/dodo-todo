import type { Category, Memo, MemoScope, Todo } from "../lib/types";

export interface Snapshot {
  categories: Category[];
  todos: Todo[];
  memos: Memo[];
}

/** 저장소 경계. 화면은 이 인터페이스만 알고, 로컬/Supabase 중 뭘 쓰는지는 모른다 */
export interface Repo {
  load(): Promise<Snapshot>;
  insertTodo(t: Todo): Promise<void>;
  updateTodo(id: string, patch: Partial<Omit<Todo, "id">>): Promise<void>;
  /** 소프트 삭제 — 되돌리기 가능 */
  deleteTodo(id: string): Promise<void>;
  restoreTodo(id: string): Promise<void>;
  insertCategory(c: Category): Promise<void>;
  updateCategory(id: string, patch: Partial<Omit<Category, "id">>): Promise<void>;
  /** 카테고리를 지우고 그 안의 할 일은 "카테고리 없음"으로 (원자적으로) */
  deleteCategory(id: string): Promise<void>;
  /** 기간 하나에 메모 하나 — 있으면 덮어쓰고 없으면 만듦 */
  saveMemo(scope: MemoScope, period: string, body: string): Promise<void>;
  /** 회원 탈퇴: 계정과 모든 데이터를 즉시 영구 삭제 */
  deleteAccount(): Promise<void>;
}
