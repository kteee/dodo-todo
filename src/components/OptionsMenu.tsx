import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 설정 버튼(톱니바퀴) — 누르면 시작 화면·보기 옵션이 펼쳐짐. 바깥 클릭·Esc로 닫힘.
 */
export function OptionsMenu({ children }: { children: ReactNode }) {
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
    <div className="optmenu" ref={box}>
      <button
        className={"optbtn" + (open ? " on" : "")}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="설정"
        onClick={() => setOpen((o) => !o)}
        title="설정"
      >
        {/* 톱니바퀴 아이콘 */}
        <svg className="gear" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.9 4.6 1.7 1.7 0 0 0 9.97 3V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.9 1.7 1.7 0 0 0 21 9.97h.09a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1.03Z" />
        </svg>
      </button>
      {open && (
        <div className="optpop" role="group" aria-label="설정">
          {children}
        </div>
      )}
    </div>
  );
}
