/**
 * 글자 크기 설정: 보통 · 크게. 이 브라우저에만 기억.
 * 아무것도 고르지 않으면 보통. "크게"는 110%.
 * CSS 는 글자 크기를 rem 으로 적어 두고 <html data-size="…"> 와 미디어쿼리로 기준값만 바꾼다 (레이아웃 px 는 그대로)
 */
export type TextSize = "normal" | "large";

export const TEXT_SIZES: [TextSize, string][] = [
  ["normal", "보통"],
  ["large", "크게"],
];

const PREF = "dodo:size";

/** 저장된 선택. 없으면 null(자동) */
export function readTextSize(): TextSize | null {
  try {
    const v = localStorage.getItem(PREF);
    return v === "normal" || v === "large" ? v : null;
  } catch {
    return null;
  }
}

/** 지금 적용되는 크기 — 고른 게 없으면 보통 (화면 폭에 따라 자동으로 키우지 않음) */
export function effectiveTextSize(pref: TextSize | null): TextSize {
  return pref ?? "normal";
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
