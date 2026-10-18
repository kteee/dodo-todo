import { useEffect, useRef, useState } from "react";

/** 두두 패밀리 — 서비스가 열리면 href 를 채우고 soon 을 지움 */
const APPS: { key: string; name: string; desc: string; href: string; soon?: boolean }[] = [
  { key: "todo", name: "두두 투두", desc: "주간 할 일 보드", href: "https://todo.dododiary.com" },
  { key: "books", name: "두두 독서노트", desc: "한 문장·필사·느낌·요약", href: "https://books.dododiary.com", soon: true },
  { key: "ledger", name: "두두 가계부", desc: "다이어리처럼 쓰는 가계부", href: "https://ledger.dododiary.com", soon: true },
];
const CURRENT = "todo";

/** 헤더의 두두 서비스 모음 버튼 (프로필 왼쪽). 누르면 패밀리 목록, 바깥 클릭·Esc 로 닫힘 */
export function AppsMenu() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="apps" ref={box}>
      <button className="apps-btn" aria-label="두두 서비스 모음" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="3.5" cy="3.5" r="1.4" />
          <circle cx="8" cy="3.5" r="1.4" />
          <circle cx="12.5" cy="3.5" r="1.4" />
          <circle cx="3.5" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="12.5" cy="8" r="1.4" />
          <circle cx="3.5" cy="12.5" r="1.4" />
          <circle cx="8" cy="12.5" r="1.4" />
          <circle cx="12.5" cy="12.5" r="1.4" />
        </svg>
      </button>
      {open && (
        <div className="apps-pop" role="menu" aria-label="두두 서비스">
          <p className="apps-title">두두 시리즈</p>
          {APPS.map((a) =>
            a.soon ? (
              <div key={a.key} className="apps-item soon" aria-disabled="true">
                <span className="apps-mark" aria-hidden="true" />
                <span className="apps-txt">
                  <b>{a.name}</b>
                  <small>{a.desc}</small>
                </span>
                <em>준비 중</em>
              </div>
            ) : (
              <a key={a.key} className={"apps-item" + (a.key === CURRENT ? " now" : "")} href={a.href} role="menuitem" aria-current={a.key === CURRENT ? "page" : undefined}>
                <span className="apps-mark" aria-hidden="true" />
                <span className="apps-txt">
                  <b>{a.name}</b>
                  <small>{a.desc}</small>
                </span>
                {a.key === CURRENT && <em>지금</em>}
              </a>
            ),
          )}
        </div>
      )}
    </div>
  );
}
