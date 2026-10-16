import { generateKeyBetween } from "fractional-indexing";

interface Ranked {
  id: string;
  rank: string;
}

/** 정렬 키는 바이트 순서로 비교 (DB의 collate "C"와 같은 규칙). 같으면 id로 고정 */
export function byRank(a: Ranked, b: Ranked) {
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function between(a: string | null, b: string | null) {
  try {
    return generateKeyBetween(a, b);
  } catch {
    // 두 기기에서 같은 키가 생긴 경우 등 a >= b — 순서보다 저장 성공이 우선
    return generateKeyBetween(a, null);
  }
}

/** sorted(옮기는 항목 제외, 정렬됨)에서 prevId 바로 뒤에 들어갈 키. prevId가 null이면 맨 앞 */
export function rankAfter(sorted: Ranked[], prevId: string | null): string {
  if (!prevId) return between(null, sorted[0]?.rank ?? null);
  const i = sorted.findIndex((x) => x.id === prevId);
  if (i < 0) return rankLast(sorted);
  return between(sorted[i].rank, sorted[i + 1]?.rank ?? null);
}

export function rankLast(sorted: Ranked[]): string {
  return between(sorted[sorted.length - 1]?.rank ?? null, null);
}
