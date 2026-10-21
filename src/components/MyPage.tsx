import { useState } from "react";
import type { Account } from "../data/auth";
import { report } from "../lib/monitoring";
import { ConfirmDialog } from "./Sidebar";

interface Props {
  account: Account;
  isLocal: boolean;
  onExport: (() => void) | null;
  /** 투두 그만두기 — 이 서비스 기록만 삭제. 실패하면 throw */
  onDeleteTodoData: () => Promise<void>;
  /** 두두 계정 탈퇴 — 계정과 모든 두두 서비스 기록 삭제. 실패하면 throw */
  onDeleteAccount: () => Promise<void>;
}

type Danger = "todo" | "account";

/**
 * 마이페이지: 내 정보 + 메뉴(데이터 내보내기, 개인정보 처리방침, 투두 기록 삭제) + 두두 계정(탈퇴).
 * 두두 계정은 투두·북로그·블로그가 같이 쓰므로 "이 서비스만 그만두기"와 "계정 탈퇴"를 따로 둔다
 * (구글·네이버처럼: 서비스 그만두기는 서비스 안에서, 계정 탈퇴는 계정 메뉴에서)
 */
export function MyPage({ account, isLocal, onExport, onDeleteTodoData, onDeleteAccount }: Props) {
  const [confirming, setConfirming] = useState<Danger | null>(null);
  const [busy, setBusy] = useState<Danger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const run = async (what: Danger) => {
    setConfirming(null);
    setBusy(what);
    setError(null);
    try {
      if (what === "todo") {
        await onDeleteTodoData();
        setCleared(true);
        setBusy(null);
      } else {
        await onDeleteAccount();
        location.href = "/"; // 계정이 사라졌으니 처음 화면(로그인 안내)으로
      }
    } catch (e) {
      report(e, what === "todo" ? "deleteTodoData" : "deleteAccount");
      setBusy(null);
      setError(
        (what === "todo" ? "기록을 삭제하지 못했습니다." : "탈퇴를 처리하지 못했습니다.") +
          " 잠시 후 다시 시도하거나 개인정보 처리방침의 연락처로 문의해 주세요.",
      );
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
          <button className="danger" onClick={() => setConfirming("todo")} disabled={busy !== null}>
            <span>
              <b>{busy === "todo" ? "삭제 중…" : cleared ? "투두 기록을 모두 삭제했어요" : "투두 기록 모두 삭제"}</b>
              <small>할 일, 카테고리, 메모가 즉시 삭제되며 되돌릴 수 없어요. 계정과 다른 두두 서비스는 그대로예요</small>
            </span>
            <i aria-hidden="true">›</i>
          </button>
        </li>
      </ul>

      {/* 두두 계정: 투두·북로그·블로그가 같이 쓰는 계정. 탈퇴는 전부 삭제라 투두 메뉴와 떼어 둠 */}
      <h2 className="mypage-sub">두두 계정</h2>
      <ul className="mypage-menu">
        <li>
          <button className="danger" onClick={() => setConfirming("account")} disabled={busy !== null}>
            <span>
              <b>{busy === "account" ? "탈퇴 처리 중…" : "두두 계정 탈퇴"}</b>
              <small>투두·북로그 등 모든 두두 서비스의 기록과 계정이 즉시 삭제되며 되돌릴 수 없어요</small>
            </span>
            <i aria-hidden="true">›</i>
          </button>
        </li>
      </ul>
      {error && <p className="mypage-error">{error}</p>}

      {confirming === "todo" && (
        <ConfirmDialog
          title="투두 기록을 모두 삭제할까요?"
          body="할 일, 카테고리, 메모가 즉시 영구 삭제되며 복구할 수 없습니다. 두두 계정과 다른 서비스의 기록은 그대로 남습니다. 필요하면 먼저 데이터를 내보내 주세요."
          confirmLabel="삭제"
          onConfirm={() => run("todo")}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "account" && (
        <ConfirmDialog
          title="정말 두두 계정을 탈퇴하시겠습니까?"
          body="계정과 투두·북로그 등 모든 두두 서비스의 데이터가 즉시 영구 삭제되며 복구할 수 없습니다. 필요하면 먼저 각 서비스에서 데이터를 내보내 주세요."
          confirmLabel="탈퇴"
          onConfirm={() => run("account")}
          onCancel={() => setConfirming(null)}
        />
      )}
    </main>
  );
}
