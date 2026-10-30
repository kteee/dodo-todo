/** 화면 테마: 자동(기기 설정 따라) · 밝게 · 어둡게. 이 브라우저에만 기억 */
export type Theme = "auto" | "light" | "dark";

export const THEMES: [Theme, string][] = [
  ["auto", "자동"],
  ["light", "밝게"],
  ["dark", "어둡게"],
];

const PREF = "dodo:theme";

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(PREF);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

/** <html data-theme="…"> 로 styles.css 의 밝은/어두운 색을 고름. 자동이면 속성을 지워 기기 설정(prefers-color-scheme)을 따름 */
export function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === "auto") delete el.dataset.theme;
  else el.dataset.theme = t;
}

export function saveTheme(t: Theme) {
  applyTheme(t);
  try {
    localStorage.setItem(PREF, t);
  } catch {
    /* 저장 못 해도 이번 화면에서는 적용됨 */
  }
}
