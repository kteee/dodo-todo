/** 글꼴 설정: 기본(IBM Plex Sans KR) · 맑은 고딕 · 명조(본명조 = Noto Serif KR). 이 브라우저에만 기억 */
export type Font = "base" | "gothic" | "serif";

export const FONTS: [Font, string][] = [
  ["base", "기본"],
  ["gothic", "고딕"],
  ["serif", "명조"],
];

const PREF = "dodo:font";

export function readFont(): Font {
  try {
    const v = localStorage.getItem(PREF);
    return v === "gothic" || v === "serif" ? v : "base";
  } catch {
    return "base";
  }
}

/** <html data-font="…"> 로 CSS 변수(--sans, --mono)를 바꿈. 기본이면 속성을 지움 */
export function applyFont(f: Font) {
  const el = document.documentElement;
  if (f === "base") delete el.dataset.font;
  else el.dataset.font = f;
}

export function saveFont(f: Font) {
  applyFont(f);
  try {
    localStorage.setItem(PREF, f);
  } catch {
    /* 저장 못 해도 이번 화면에서는 적용됨 */
  }
}
