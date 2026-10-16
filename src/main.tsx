import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { Privacy } from "./components/Privacy";
import { supabase } from "./data/supabase";
import "./styles.css";

// 배포판에서 Supabase 환경변수가 빠지면 조용히 "로컬 모드"(브라우저에만 저장)로 돌아가는 사고를 막음
const misconfigured = import.meta.env.PROD && !supabase;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {location.pathname.replace(/\/$/, "") === "/privacy" ? (
      // 개인정보 처리방침은 로그인·설정과 상관없이 누구나 볼 수 있어야 함
      <Privacy />
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
  </StrictMode>,
);
