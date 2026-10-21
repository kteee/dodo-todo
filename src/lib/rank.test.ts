import { describe, expect, it } from "vitest";
import { byRank, rankAfter, rankLast } from "./rank";

const mk = (ranks: string[]) => ranks.map((rank, i) => ({ id: "t" + i, rank }));
const sorted = (xs: { id: string; rank: string }[]) => [...xs].sort(byRank);

describe("byRank", () => {
  it("rank 바이트 순, 같으면 id 순 (DB collate C 와 같은 규칙)", () => {
    const xs = [
      { id: "b", rank: "a1" },
      { id: "a", rank: "a1" },
      { id: "c", rank: "a0" },
      { id: "d", rank: "Zz" }, // 대문자가 소문자보다 앞
    ];
    expect(sorted(xs).map((x) => x.id)).toEqual(["d", "c", "a", "b"]);
  });
});

describe("rankAfter / rankLast", () => {
  it("빈 칸에 처음 넣기, 맨 뒤·맨 앞·사이에 넣기", () => {
    const first = rankLast([]);
    expect(first).toBeTypeOf("string");
    const list = mk([first]);
    const last = rankLast(list);
    expect(last > first).toBe(true);
    const front = rankAfter(list, null);
    expect(front < first).toBe(true);
    const mid = rankAfter(mk([first, last]), "t0");
    expect(mid > first && mid < last).toBe(true);
  });

  it("prevId 가 목록에 없으면(이미 지워진 항목 등) 맨 뒤", () => {
    const list = mk(["a0", "a1"]);
    expect(rankAfter(list, "ghost") > "a1").toBe(true);
  });

  it("맨 앞에 100번 연달아 넣어도 순서가 유지되고 키가 겹치지 않는다 (보관함 위 입력칸)", () => {
    const list: { id: string; rank: string }[] = [];
    for (let i = 0; i < 100; i++) {
      const rank = rankAfter(sorted(list), null);
      list.push({ id: "n" + i, rank });
    }
    const order = sorted(list).map((x) => x.id);
    expect(order).toEqual([...Array(100)].map((_, i) => "n" + (99 - i)));
    expect(new Set(list.map((x) => x.rank)).size).toBe(100);
  });

  it("같은 두 항목 사이에 50번 끼워 넣어도 순서가 유지된다 (연속 드래그)", () => {
    const list = mk(["a0", "a1"]);
    let prev = "t0";
    for (let i = 0; i < 50; i++) {
      const rank = rankAfter(sorted(list), prev);
      const id = "m" + i;
      list.push({ id, rank });
      prev = id;
    }
    const order = sorted(list).map((x) => x.id);
    expect(order[0]).toBe("t0");
    expect(order[order.length - 1]).toBe("t1");
    expect(order.slice(1, -1)).toEqual([...Array(50)].map((_, i) => "m" + i));
  });

  it("두 기기에서 같은 키가 생겨 앞뒤 키가 같아도 예외 없이 키를 만든다 — 순서보다 저장 성공이 우선", () => {
    const list = mk(["a0", "a0"]); // 라이브러리는 a >= b 면 예외를 던짐
    expect(() => rankAfter(list, "t0")).not.toThrow();
    expect(rankAfter(list, "t0") > "a0").toBe(true);
  });
});
