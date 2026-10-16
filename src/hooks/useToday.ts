import { useEffect, useState } from "react";
import { key, startOfToday } from "../lib/date";

/** 탭을 켜둔 채 자정을 넘겨도 "오늘"이 따라가게 — 1분마다, 그리고 탭에 돌아올 때 확인 */
export function useToday() {
  const [today, setToday] = useState(startOfToday);
  useEffect(() => {
    const tick = () =>
      setToday((prev) => {
        const now = startOfToday();
        return key(now) === key(prev) ? prev : now;
      });
    const iv = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return today;
}
