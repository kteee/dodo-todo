import type { CSSProperties, ReactNode } from "react";
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
  onSignIn: () => void;
  onSignOut: () => void;
  onExport: (() => void) | null;
}

function Avatar({ a }: { a: Account }) {
  return <span className="avatar">{a.picture ? <img src={a.picture} alt="" referrerPolicy="no-referrer" /> : a.initial}</span>;
}

export function GoogleButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="signin" onClick={onClick}>
      <span className="gmark" aria-hidden="true">
        G
      </span>
      Google로 로그인
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

export function TopNav({ search, account, isLocal, menuOpen, setMenuOpen, onSignIn, onSignOut, onExport }: Props) {
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
      {search}
      <div className="acct">
        {!account ? (
          <GoogleButton onClick={onSignIn} />
        ) : (
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
                {onExport && (
                  <button
                    className="mi"
                    onClick={() => {
                      setMenuOpen(false);
                      onExport();
                    }}
                  >
                    데이터 내보내기 (JSON)
                  </button>
                )}
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
