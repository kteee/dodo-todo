import { addDays, key, parse } from "./date";

/**
 * 대한민국 공휴일 (「관공서의 공휴일에 관한 규정」 기준, 2026.4.30. 개정 반영: 노동절·제헌절 포함)
 *
 * - 양력 공휴일과 대체공휴일은 규칙으로 계산하고,
 * - 음력 공휴일(설날·부처님오신날·추석)과 선거일·임시공휴일만 해마다 아래 표에 추가한다.
 *   → 매년 연말에 다음 해 음력 날짜와 임시공휴일을 확인해서 LUNAR / EXTRA 에 넣을 것.
 */

/** 양력 공휴일. sub = 토·일과 겹치면 대체공휴일 대상 */
const FIXED: { md: string; name: string; sub: boolean; from?: number }[] = [
  { md: "01-01", name: "신정", sub: false },
  { md: "03-01", name: "삼일절", sub: true },
  { md: "05-01", name: "노동절", sub: true, from: 2026 },
  { md: "05-05", name: "어린이날", sub: true },
  { md: "06-06", name: "현충일", sub: false },
  { md: "07-17", name: "제헌절", sub: true, from: 2026 },
  { md: "08-15", name: "광복절", sub: true },
  { md: "10-03", name: "개천절", sub: true },
  { md: "10-09", name: "한글날", sub: true },
  { md: "12-25", name: "성탄절", sub: true },
];

/** 음력 공휴일의 양력 날짜 (설날·추석은 당일 기준, 앞뒤 하루씩 연휴) */
const LUNAR: Record<number, { seol: string; buddha: string; chuseok: string }> = {
  2026: { seol: "2026-02-17", buddha: "2026-05-24", chuseok: "2026-09-25" },
  2027: { seol: "2027-02-07", buddha: "2027-05-13", chuseok: "2027-09-15" },
};

/** 선거일·임시공휴일 (대체공휴일 없음) */
const EXTRA: Record<string, string> = {
  "2026-06-03": "지방선거",
};

const cache = new Map<number, Map<string, string>>();

const isWeekend = (k: string) => {
  const d = parse(k).getDay();
  return d === 0 || d === 6;
};

function build(year: number): Map<string, string> {
  const days = new Map<string, string>();
  const subBase: string[] = []; // 토·일에 걸리면 대체공휴일이 생기는 날
  const add = (k: string, name: string) => {
    if (!days.has(k)) days.set(k, name);
  };

  for (const f of FIXED) {
    if (f.from && year < f.from) continue;
    const k = `${year}-${f.md}`;
    add(k, f.name);
    if (f.sub) subBase.push(k);
  }
  for (const [k, name] of Object.entries(EXTRA)) if (k.startsWith(year + "-")) add(k, name);

  const lunar = LUNAR[year];
  const longBreaks: string[][] = []; // 설날·추석 3일 연휴
  if (lunar) {
    for (const [mid, name] of [
      [lunar.seol, "설날"],
      [lunar.chuseok, "추석"],
    ] as const) {
      const d = parse(mid);
      const span = [key(addDays(d, -1)), mid, key(addDays(d, 1))];
      add(span[0], name + " 전날");
      add(span[1], name);
      add(span[2], name + " 다음날");
      longBreaks.push(span);
    }
    add(lunar.buddha, "부처님오신날");
    subBase.push(lunar.buddha);
  }

  // 대체공휴일: 그다음 첫 번째 비공휴일 평일
  const nextFreeWeekday = (from: string) => {
    let d = addDays(parse(from), 1);
    while (isWeekend(key(d)) || days.has(key(d))) d = addDays(d, 1);
    return key(d);
  };
  // 국경일·어린이날·부처님오신날 등: 토·일 또는 다른 공휴일과 겹치면
  for (const k of subBase) {
    const name = days.get(k)!;
    if (isWeekend(k)) add(nextFreeWeekday(k), name + " 대체공휴일");
  }
  // 설날·추석 연휴: 일요일 또는 다른 공휴일과 겹치면 (토요일은 해당 없음) 연휴 다음 평일
  for (const span of longBreaks) {
    const name = days.get(span[1])!;
    const own = new Set([name + " 전날", name, name + " 다음날"]);
    if (span.some((k) => parse(k).getDay() === 0 || !own.has(days.get(k)!))) add(nextFreeWeekday(span[2]), name + " 대체공휴일");
  }
  return days;
}

/** "YYYY-MM-DD" 가 공휴일이면 이름, 아니면 null */
export function holidayName(k: string): string | null {
  const y = +k.slice(0, 4);
  let m = cache.get(y);
  if (!m) {
    m = build(y);
    cache.set(y, m);
  }
  return m.get(k) ?? null;
}
