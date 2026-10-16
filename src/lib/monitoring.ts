import * as Sentry from "@sentry/react";

/**
 * 에러 알림 (Sentry). 배포판 + VITE_SENTRY_DSN 이 있을 때만 켜짐.
 *
 * 개인정보 원칙: 할 일·메모 내용과 사용자 정보는 보내지 않는다.
 * - dataCollection: 사용자 정보·쿠키·헤더·쿼리·요청/응답 본문·변수값 전부 안 보냄
 * - 클릭·입력 기록(ui.*)과 콘솔 출력(console) 기록은 버림
 *   → 카드 글자가 "클릭한 요소"로, DB 오류의 details("Failing row contains …")가 콘솔 인자로 섞여 들어가는 걸 막음
 * - 요청 주소의 ?쿼리는 잘라냄
 * - DB 오류는 코드+메시지만 남김 (Postgres details 에는 행 내용이 들어 있을 수 있음)
 */
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const enabled = import.meta.env.PROD && !!dsn;

if (enabled) {
  Sentry.init({
    dsn,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0,
    beforeBreadcrumb(b) {
      if (b.category?.startsWith("ui.") || b.category === "console") return null;
      if ((b.category === "fetch" || b.category === "xhr") && typeof b.data?.url === "string") {
        b.data.url = b.data.url.split("?")[0];
      }
      return b;
    },
  });
}

/** DB 오류 객체(code, message, details…)에서 코드와 메시지만 */
export function describeError(e: unknown): string {
  if (e && typeof e === "object") {
    const { code, message } = e as { code?: unknown; message?: unknown };
    return [code, message].filter((v) => typeof v === "string" && v).join(" ");
  }
  return String(e);
}

/** 콘솔에 남기고, 배포판이면 Sentry 로도 보냄. where = 어디서 났는지 (예: "save") */
export function report(e: unknown, where: string) {
  // 배포판 콘솔에는 코드·메시지만 (details 에 행 내용이 들어갈 수 있음). 개발 중엔 원본 그대로
  if (import.meta.env.DEV) console.error(e);
  else console.error(`[${where}] ${describeError(e)}`);
  if (!enabled) return;
  const err = e instanceof Error ? new Error(e.message) : new Error(describeError(e) || "unknown error");
  if (e instanceof Error) err.stack = e.stack;
  Sentry.captureException(err, { tags: { where } });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
