import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Privacy } from "./components/Privacy";
import { SiteFooter } from "./components/SiteFooter";
import { supabase } from "./data/supabase";
import { ErrorBoundary } from "./lib/monitoring";
import "./styles.css";
import { applyFont, readFont } from "./lib/font";
import { applyTextSize, readTextSize } from "./lib/textSize";

// 저장해 둔 글꼴을 첫 화면을 그리기 전에 적용 (깜빡임 없이)
applyFont(readFont());
applyTextSize(readTextSize());

// 배포판에서 Supabase 환경변수가 빠지면 조용히 "로컬 모드"(브라우저에만 저장)로 돌아가는 사고를 막음
const misconfigured = import.meta.env.PROD && !supabase;

// 화면 코드에서 예외가 나도 하얀 화면 대신 안내를 보여줌 (Sentry가 켜져 있으면 자동 보고)
const crashed = (
  <div className="page">
    <div className="gate">
      <div>
        <h3>문제가 생겼어요</h3>
        <p>저장된 기록은 안전해요. 새로고침해 주세요.</p>
        <button className="signin" onClick={() => location.reload()}>
          새로고침
        </button>
      </div>
    </div>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary fallback={crashed}>
    {location.pathname.replace(/\/$/, "") === "/privacy" ? (
      // 개인정보 처리방침은 로그인·설정과 상관없이 누구나 볼 수 있어야 함
      <>
        <Privacy />
        <div className="page page-footer-only">
          <SiteFooter />
        </div>
      </>
    ) : misconfigured ? (
      <div className="page">
        <div className="gate">
          <div>
            <h3>서비스 설정 오류</h3>
            <p>잠시 후 다시 접속해 주세요. 문제가 계속되면 관리자에게 알려주세요.</p>
          </div>
        </div>
      </div>
    ) : (
      <App />
    )}
    </ErrorBoundary>
  </StrictMode>,
);
