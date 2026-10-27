import type { ReactNode } from "react";
import type { View } from "./TopNav";

/** 보기 전환: 일간·주간·월간 + 보관함(날짜 없는 할 일). 보관함은 보기와 별개 토글이라 따로 받음 */
export type Tab = View | "inbox";
/** 주간 보기: 두 줄(월~목/금~일) · 가로(7일 한 줄) · 세로(7일을 위에서 아래로) */
export type WeekLayout = "rows" | "wide" | "vert";
export const WEEK_LAYOUTS: [WeekLayout, string][] = [
  ["rows", "2줄"],
  ["vert", "세로"],
  ["wide", "가로"],
];

interface Props {
  /** 지금 보고 있는 것 (보관함이 열려 있으면 "inbox") */
  tab: Tab;
  onTab: (t: Tab) => void;
  /** 보관함 탭 옆 숫자 — 날짜 없는 남은 할 일 수 */
  inboxCount: number;
  /** 큰 제목 / 한 줄 설명 */
  title: string;
  sub: string;
  /** ‹ 오늘 › — 보관함에선 없음 */
  onStep?: (n: number) => void;
  onToday?: () => void;
  /** 제목 왼쪽에 붙는 버튼(사이드바 펼치기, 폰 서랍 열기) */
  left?: ReactNode;
  /** 둘째 줄 오른쪽: 보기 전환 옆 보기 옵션 버튼(팝업) */
  options?: ReactNode;
  /** 첫째 줄 오른쪽: 주 행동 버튼 (＋ 할 일 추가) */
  action?: ReactNode;
}

const TABS: [Tab, string][] = [
  ["day", "일간"],
  ["week", "주간"],
  ["month", "월간"],
  ["inbox", "보관함"],
];

/**
 * 헤더 아래 제목 영역: 1줄 = 제목 | ＋ 할 일 추가, 2줄 = ‹ 오늘 › + 설명 | 보기 전환 + 보기 옵션.
 * 아래 가로선으로 본문(사이드바 + 보드)과 나뉨
 */
export function TitleBar({ tab, onTab, inboxCount, title, sub, onStep, onToday, left, options, action }: Props) {
  return (
    <div className="titlebar" data-tab={tab}>
      <div className="tl">
        <div className="h1row">
          {left}
          <h1>{title}</h1>
        </div>
        {/* 둘째 줄: ‹ 오늘 › 왼쪽, 그 옆에 한 줄 설명 */}
        <div className="row2">
          {onStep && onToday && (
            <div className="nav">
              <button aria-label="이전" onClick={() => onStep(-1)}>
                ‹
              </button>
              <button className="today" onClick={onToday}>
                오늘
              </button>
              <button aria-label="다음" onClick={() => onStep(1)}>
                ›
              </button>
            </div>
          )}
          {sub && <p className="sub">{sub}</p>}
        </div>
      </div>
      <div className="tr">
        {/* 1줄 오른쪽: 주 행동 (＋ 할 일 추가) */}
        {action && <div className="tr-top">{action}</div>}
        {/* 2줄 오른쪽: 보기 전환(일간·주간·월간·보관함) + 보기 옵션(조절 슬라이더) */}
        <div className="viewopts">
          <div className="vswitch" role="tablist" aria-label="보기 전환">
            {TABS.map(([t, name]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => onTab(t)}>
                {t === "inbox" && (
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M2 9.5V12a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 14 12V9.5M2 9.5 3.6 3.8A1.2 1.2 0 0 1 4.75 3h6.5a1.2 1.2 0 0 1 1.15.8L14 9.5M2 9.5h3.2l1 1.8h3.6l1-1.8H14" />
                  </svg>
                )}
                {name}
                {t === "inbox" && inboxCount > 0 && <span className="cnt">{inboxCount}</span>}
              </button>
            ))}
          </div>
          {options}
        </div>
      </div>
    </div>
  );
}
