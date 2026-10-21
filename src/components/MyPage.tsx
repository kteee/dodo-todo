import { useState } from "react";
import type { Account } from "../data/auth";
import { report } from "../lib/monitoring";
import { ConfirmDialog } from "./Sidebar";

interface Props {
  account: Account;
  isLocal: boolean;
  onExport: (() => void) | null;
  /** 회원 탈퇴 — 실패하면 throw */
  onDeleteAccount: () => Promise<void>;
}

/** 마이페이지: 내 정보 + 메뉴(데이터 내보내기, 개인정보 처리방침, 회원 탈퇴) */
export function MyPage({ account, isLocal, onExport, onDeleteAccount }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = async () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      await onDeleteAccount();
      location.href = "/"; // 계정이 사라졌으니 처음 화면(로그인 안내)으로
    } catch (e) {
      report(e, "deleteAccount");
      setBusy(false);
      setError("탈퇴를 처리하지 못했습니다. 잠시 후 다시 시도하거나 개인정보 처리방침의 연락처로 문의해 주세요.");
    }
  };

  return (
    <main className="mypage">
      <a className="mypage-back" href="/">
        ← 보드로 돌아가기
      </a>
      <h1>마이페이지</h1>

      <section className="mypage-profile">
        <span className="avatar avatar-lg">
          {account.picture ? <img src={account.picture} alt="" referrerPolicy="no-referrer" /> : account.initial}
        </span>
        <div className="mypage-who">
          <div className="mypage-name">{account.name}</div>
          <div className="mypage-email">{account.email}</div>
          <div className="mypage-via">{isLocal ? "로컬 모드 (이 브라우저에만 저장)" : "Google 계정으로 로그인"}</div>
        </div>
      </section>

      <ul className="mypage-menu">
        {onExport && (
          <li>
            <button onClick={onExport}>
              <span>
                <b>데이터 내보내기</b>
                <small>할 일, 카테고리, 메모 데이터를 JSON 파일로 내려받아요</small>
              </span>
              <i aria-hidden="true">›</i>
            </button>
          </li>
        )}
        <li>
          <a href="/privacy">
            <span>
              <b>개인정보 처리방침</b>
            </span>
            <i aria-hidden="true">›</i>
          </a>
        </li>
        <li>
          <button className="danger" onClick={() => setConfirming(true)} disabled={busy}>
            <span>
              <b>{busy ? "탈퇴 처리 중…" : "회원 탈퇴"}</b>
              <small>계정과 모든 기록이 즉시 삭제되며 되돌릴 수 없어요</small>
            </span>
            <i aria-hidden="true">›</i>
          </button>
        </li>
      </ul>
      {error && <p className="mypage-error">{error}</p>}

      {/* 두두 다른 서비스로 가는 작은 바닥글 (헤더의 서비스 모음 버튼 대신) */}
      <footer className="mypage-family">
        <span className="mf-label">두두 서비스</span>
        <a href="https://dododiary.com">두두 홈</a>
        <span className="mf-dot" aria-hidden="true">·</span>
        <span className="mf-now" aria-current="page">투두리스트</span>
        <span className="mf-dot" aria-hidden="true">·</span>
        <span className="mf-soon">북로그 (준비 중)</span>
      </footer>

      {confirming && (
        <ConfirmDialog
          title="정말 탈퇴하시겠습니까?"
          body="계정과 모든 데이터가 즉시 영구 삭제되며 복구할 수 없습니다. 필요하면 먼저 데이터를 내보내 주세요."
          confirmLabel="탈퇴"
          onConfirm={withdraw}
          onCancel={() => setConfirming(false)}
        />
      )}
    </main>
  );
}
