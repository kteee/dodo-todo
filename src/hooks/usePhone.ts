import { useEffect, useState } from "react";

/** 폰 화면 기준(가로 640px 이하). 데스크톱 창을 좁혀도 같은 레이아웃이 됨 */
export const PHONE_QUERY = "(max-width: 640px)";

export const isPhone = () => typeof matchMedia !== "undefined" && matchMedia(PHONE_QUERY).matches;

export function usePhone(): boolean {
  const [phone, setPhone] = useState(isPhone);
  useEffect(() => {
    const mq = matchMedia(PHONE_QUERY);
    const on = () => setPhone(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}
