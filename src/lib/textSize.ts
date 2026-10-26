/**
 * 글자 크기 설정: 보통 · 크게. 이 브라우저에만 기억.
 * 아무것도 고르지 않으면 "자동" — 1600px 이상 큰 화면에서는 크게(110%), 그 밖엔 보통.
 * CSS 는 글자 크기를 rem 으로 적어 두고 <html data-size="…"> 와 미디어쿼리로 기준값만 바꾼다 (레이아웃 px 는 그대로)
 */
export type TextSize = "normal" | "large";

export const TEXT_SIZES: [TextSize, string][] = [
  ["normal", "보통"],
  ["large", "크게"],
];

const PREF = "dodo:size";
/** 자동일 때 "크게"가 되는 화면 폭 — styles.css 의 @media (min-width) 와 같은 값 */
export const LARGE_FROM = 1600;

/** 저장된 선택. 없으면 null(자동) */
export function readTextSize(): TextSize | null {
  try {
    const v = localStorage.getItem(PREF);
    return v === "normal" || v === "large" ? v : null;
  } catch {
    return null;
  }
}

/** 지금 화면에 실제로 적용되는 크기 (자동이면 화면 폭으로 판단) */
export function effectiveTextSize(pref: TextSize | null): TextSize {
  if (pref) return pref;
  return typeof window !== "undefined" && window.innerWidth >= LARGE_FROM ? "large" : "normal";
}

export function applyTextSize(s: TextSize | null) {
  const el = document.documentElement;
  if (s) el.dataset.size = s;
  else delete el.dataset.size;
}

export function saveTextSize(s: TextSize) {
  applyTextSize(s);
  try {
    localStorage.setItem(PREF, s);
  } catch {
    /* 저장 못 해도 이번 화면에서는 적용됨 */
  }
}
