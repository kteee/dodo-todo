import { useEffect, useRef, useState, type ReactNode } from "react";

/** 두두 서비스 — 서비스가 열리면 soon 을 지움 */
const APPS: { key: string; name: string; href: string; soon?: boolean; icon: ReactNode }[] = [
  {
    key: "todo",
    name: "투두리스트",
    href: "https://todo.dododiary.com",
    icon: <polyline points="3.5,8.5 6.8,11.6 12.5,4.6" />,
  },
  {
    key: "books",
    name: "북로그",
    href: "https://books.dododiary.com",
    soon: true,
    // 펼친 책: 양쪽 페이지가 아이콘 칸을 꽉 채우고, 가운데 책등 + 페이지마다 글줄 하나
    icon: (
      <>
        <path d="M8 3.9C6.3 2.8 4.1 2.4 1.6 2.6v10.1c2.5-.2 4.7.2 6.4 1.3 1.7-1.1 3.9-1.5 6.4-1.3V2.6C11.9 2.4 9.7 2.8 8 3.9z" />
        <path d="M8 3.9v10.1M3.8 6h2.3M9.9 6h2.3" />
      </>
    ),
  },
  {
    key: "ledger",
    name: "가계부",
    href: "https://ledger.dododiary.com",
    soon: true,
    icon: (
      <>
        <rect x="2.8" y="4" width="10.4" height="8" rx="1.6" />
        <path d="M2.8 6.8h10.4M10.2 9.6h1" />
      </>
    ),
  },
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
          {APPS.map((a) => {
            const inner = (
              <>
                <span className="apps-ico" aria-hidden="true">
                  <svg viewBox="0 0 16 16">{a.icon}</svg>
                </span>
                <span className="apps-name">{a.name}</span>
              </>
            );
            return a.soon ? (
              <span key={a.key} className="apps-tile soon" aria-disabled="true" aria-label={a.name + " (준비 중)"}>
                {inner}
              </span>
            ) : (
              <a
                key={a.key}
                className={"apps-tile" + (a.key === CURRENT ? " now" : "")}
                href={a.href}
                role="menuitem"
                aria-current={a.key === CURRENT ? "page" : undefined}
              >
                {inner}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
