import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePhone } from "../hooks/usePhone";
import type { Account } from "../data/auth";

export type View = "day" | "week" | "month";

const VIEWS: [View, string][] = [
  ["day", "일간"],
  ["week", "주간"],
  ["month", "월간"],
];

interface Props {
  /** 로고 오른쪽(보드 열)에 들어갈 검색창 */
  search?: ReactNode;
  account: Account | null;
  isLocal: boolean;
  menuOpen: boolean;
  setMenuOpen: (o: boolean) => void;
  onSignOut: () => void;
}

function Avatar({ a }: { a: Account }) {
  return <span className="avatar">{a.picture ? <img src={a.picture} alt="" referrerPolicy="no-referrer" /> : a.initial}</span>;
}

/**
 * Google 로그인 버튼 — Google 브랜드 가이드(Sign in with Google) 준수:
 * 공식 4색 G 로고(변형·단색화 금지), 흰 배경 + #747775 테두리 + #1F1F1F 글자(다크: #131314 / #8E918F / #E3E3E3),
 * 로고와 글자 사이 간격, 공식 한국어 문구 "Google 계정으로 로그인".
 */
export function GoogleButton({ onClick, size = "md" }: { onClick: () => void; size?: "sm" | "md" }) {
  return (
    <button className={"gsi-btn gsi-" + size} onClick={onClick}>
      <svg className="gsi-logo" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      <span className="gsi-text">Google 계정으로 로그인</span>
    </button>
  );
}

/** 일간·주간·월간 전환 — 날짜 줄 오른쪽 끝에 둠 */
export function ViewSwitch({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <div
      className="views"
      role="tablist"
      aria-label="보기 전환"
      style={{ "--i": VIEWS.findIndex(([v]) => v === view) } as CSSProperties}
    >
      {/* 선택된 버튼 뒤로 미끄러지는 진한 칸 */}
      <span className="views-thumb" aria-hidden="true" />
      {VIEWS.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={view === v} onClick={() => onView(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function TopNav({ search, account, isLocal, menuOpen, setMenuOpen, onSignOut }: Props) {
  // 폰: 검색창 대신 돋보기 버튼(프로필 왼쪽). 누르면 아래 줄에 검색창이 열리고 바로 입력 가능
  const phone = usePhone();
  const [searchOpen, setSearchOpen] = useState(false);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchOpen) return;
    const input = row.current?.querySelector("input");
    input?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);
  const searchSlot = !phone ? (
    search
  ) : (
    <>
      {searchOpen && search && (
        <div
          ref={row}
          className="search-row"
          onBlur={(e) => {
            // 검색어 없이 다른 데를 누르면 조용히 닫힘
            const input = row.current?.querySelector("input");
            if (!row.current?.contains(e.relatedTarget as Node) && !input?.value) setSearchOpen(false);
          }}
        >
          {search}
          <button className="search-close" onClick={() => setSearchOpen(false)}>
            취소
          </button>
        </div>
      )}
      {search && (
        <button className="search-btn" aria-label="할 일 검색" aria-expanded={searchOpen} onClick={() => setSearchOpen((o) => !o)}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
        </button>
      )}
    </>
  );
  return (
    <header className="topnav">
      <a className="logo" href="/">
        <span className="mark" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <polyline points="2.5,8.5 6.2,12 13.5,4" />
          </svg>
        </span>
        <span className="word">DoDo</span>
        <span className="tag">todolist</span>
      </a>
      {/* 로고 오른쪽 영역은 아래 할 일 보드와 같은 열에서 시작 — 검색창 왼쪽 끝이 보드 왼쪽 끝과 맞음 */}
      <div className="topnav-main">
      {searchSlot}
      <div className="acct">
        {/* 로그아웃 상태에선 헤더에 로그인 버튼을 두지 않음 — 화면 가운데 버튼 하나로 */}
        {!account ? null : (
          <>
            <button className="acctbtn" aria-expanded={menuOpen} aria-label={account.name + " 계정 메뉴"} onClick={() => setMenuOpen(!menuOpen)}>
              <Avatar a={account} />
              <span className="who">{account.name}</span>
              <span className="caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {menuOpen && (
              <div className="acctmenu">
                <div className="me">
                  <Avatar a={account} />
                  <span className="txt2">
                    <div className="nm2">{account.name}</div>
                    <div className="em">{account.email}</div>
                  </span>
                </div>
                {isLocal && <div className="note">Supabase를 연결하면 구글 로그인과 기기 간 동기화가 켜져요.</div>}
                <div className="rule" />
                {/* 데이터 내보내기·처리방침·탈퇴는 마이페이지 안으로 */}
                <a className="mi" href="/my">
                  마이페이지
                </a>
                {!isLocal && (
                  <button
                    className="mi out"
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                  >
                    로그아웃
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </header>
  );
}
