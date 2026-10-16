/** "YYYY-MM-DD" 또는 "언젠가 할 일" 칸(날짜 없음)을 뜻하는 "none" */
export type Bucket = string;
export const NONE: Bucket = "none";

export interface Category {
  id: string;
  name: string;
  color: string; // "--cat-1" ~ "--cat-8"
  rank: string;
}

export interface Todo {
  id: string;
  text: string;
  categoryId: string | null; // null = 카테고리 없음
  date: string | null; // null = 날짜 없음 ("언젠가 할 일" 칸)
  done: boolean;
  rank: string; // 같은 칸 안에서의 순서 (fractional index)
}

export type MemoScope = "day" | "week" | "month";

export interface Memo {
  scope: MemoScope;
  /** day: YYYY-MM-DD / week: 그 주 월요일 YYYY-MM-DD / month: YYYY-MM */
  period: string;
  body: string;
}

export const memoKey = (scope: MemoScope, period: string) => scope + ":" + period;

/** 사이드바·필터에서 "카테고리 없음"을 가리키는 키 */
export const NO_CAT = "__none";

export const PALETTE = Array.from({ length: 16 }, (_, i) => `--cat-${i + 1}`);

/** 새 카테고리 색: 이웃한 색끼리 비슷하지 않게 색상환을 건너뛰며 고름 (안 쓴 색 우선) */
const PICK_ORDER = [9, 3, 6, 12, 1, 8, 4, 11, 7, 13, 5, 10, 2, 14, 15, 16].map((n) => `--cat-${n}`);
export function nextColor(used: string[]) {
  return PICK_ORDER.find((c) => !used.includes(c)) ?? PICK_ORDER[used.length % PICK_ORDER.length];
}

export const bucketOf = (t: Todo): Bucket => t.date ?? NONE;
export const dateOf = (b: Bucket): string | null => (b === NONE ? null : b);
