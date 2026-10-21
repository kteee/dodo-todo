import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createSaveQueue } from "./saveQueue";

/** 밖에서 끝낼 수 있는 작업 */
function job() {
  let ok!: () => void, fail!: (e: unknown) => void;
  const p = new Promise<void>((res, rej) => {
    ok = res;
    fail = rej;
  });
  const run = vi.fn(() => p);
  return { run, ok, fail };
}
/** 네트워크 오류로 취급되는 오류 */
const NET = Object.assign(new Error("TypeError: Failed to fetch"), { net: true });
const flush = () => vi.advanceTimersByTimeAsync(0); // 가짜 타이머 아래서 마이크로태스크까지 비움

function setup() {
  const o = {
    isNetworkError: (e: unknown) => !!(e as { net?: boolean })?.net,
    onNet: vi.fn(),
    onFail: vi.fn(),
    onIdle: vi.fn(),
  };
  return { q: createSaveQueue(o), o };
}

/** 부를 때마다 새 작업을 만들고 기록 — 재시도 횟수·결과를 밖에서 조절 */
function flakyJob() {
  const runs: Array<ReturnType<typeof job>> = [];
  const run = vi.fn(() => {
    const j = job();
    runs.push(j);
    return j.run();
  });
  return { run, runs, last: () => runs[runs.length - 1] };
}

describe("저장 큐", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("들어온 순서대로 하나씩 보낸다 (앞 작업이 끝나야 다음이 시작)", async () => {
    const { q } = setup();
    const a = job(), b = job(), c = job();
    q.push(a.run);
    q.push(b.run);
    q.push(c.run);
    expect(a.run).toHaveBeenCalledTimes(1);
    expect(b.run).not.toHaveBeenCalled();
    expect(q.pending).toBe(3);

    a.ok();
    await flush();
    expect(b.run).toHaveBeenCalledTimes(1);
    expect(c.run).not.toHaveBeenCalled();
    expect(q.pending).toBe(2);

    b.ok();
    await flush();
    c.ok();
    await flush();
    expect(q.pending).toBe(0);
  });

  it("큐가 비면 onIdle", async () => {
    const { q, o } = setup();
    const a = job();
    q.push(a.run);
    expect(o.onIdle).not.toHaveBeenCalled();
    a.ok();
    await flush();
    expect(o.onIdle).toHaveBeenCalledTimes(1);
  });

  it("네트워크 오류면 작업을 버리지 않고 3초·6초 뒤에 다시 보내고, 뒤 작업은 기다린다", async () => {
    const { q, o } = setup();
    const flaky = flakyJob();
    const next = job();
    q.push(flaky.run);
    q.push(next.run);

    flaky.last().fail(NET);
    await flush();
    expect(o.onNet).toHaveBeenLastCalledWith({ offline: true, waiting: 2 });
    expect(next.run).not.toHaveBeenCalled(); // 순서 유지: 앞이 막히면 뒤도 기다림
    expect(q.pending).toBe(2);

    await vi.advanceTimersByTimeAsync(2999);
    expect(flaky.run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(flaky.run).toHaveBeenCalledTimes(2);

    flaky.last().fail(NET);
    await flush();
    await vi.advanceTimersByTimeAsync(6000); // 두 번째 재시도는 6초
    expect(flaky.run).toHaveBeenCalledTimes(3);

    flaky.last().ok();
    await flush();
    expect(o.onNet).toHaveBeenLastCalledWith({ offline: false, waiting: 0 });
    expect(next.run).toHaveBeenCalledTimes(1);
    expect(o.onFail).not.toHaveBeenCalled();
  });

  it("재시도 간격은 두 배씩 늘다가 최대 30초", async () => {
    const { q } = setup();
    const flaky = flakyJob();
    q.push(flaky.run);
    for (const wait of [3000, 6000, 12000, 24000, 30000, 30000]) {
      flaky.last().fail(NET);
      await flush();
      const before = flaky.run.mock.calls.length;
      await vi.advanceTimersByTimeAsync(wait - 1);
      expect(flaky.run).toHaveBeenCalledTimes(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(flaky.run).toHaveBeenCalledTimes(before + 1);
    }
  });

  it("retryNow(연결 복구)면 기다리지 않고 바로 다시 보내고, 예약된 타이머는 중복 실행되지 않는다", async () => {
    const { q } = setup();
    const flaky = flakyJob();
    q.push(flaky.run);
    flaky.last().fail(NET);
    await flush();
    q.retryNow();
    expect(flaky.run).toHaveBeenCalledTimes(2);
    flaky.last().ok();
    await flush();
    await vi.advanceTimersByTimeAsync(60000);
    expect(flaky.run).toHaveBeenCalledTimes(2);
  });

  it("서버가 거부한 오류는 그 작업만 버리고(onFail) 다음 작업을 이어 보낸다", async () => {
    const { q, o } = setup();
    const bad = job(), next = job();
    q.push(bad.run);
    q.push(next.run);
    const err = new Error("23503 foreign key");
    bad.fail(err);
    await flush();
    expect(o.onFail).toHaveBeenCalledWith(err);
    expect(next.run).toHaveBeenCalledTimes(1);
    expect(q.pending).toBe(1);
    next.ok();
    await flush();
    expect(q.pending).toBe(0);
    expect(o.onIdle).toHaveBeenCalled();
  });

  it("진행 중에 pump 를 더 불러도 동시에 두 개를 보내지 않는다", async () => {
    const { q } = setup();
    const a = job(), b = job();
    q.push(a.run);
    q.push(b.run);
    q.retryNow();
    expect(a.run).toHaveBeenCalledTimes(1);
    expect(b.run).not.toHaveBeenCalled();
    a.ok();
    await flush();
    expect(b.run).toHaveBeenCalledTimes(1);
  });
});
