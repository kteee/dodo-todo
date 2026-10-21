/**
 * 저장 큐. 모든 저장은 들어온 순서대로 하나씩 보낸다. (useDodo 가 씀 — 화면 상태와 떼어 놓아 단독으로 시험 가능)
 * - 순서 보장: "삭제 → 실행 취소"나 연속 드래그가 서버에 뒤바뀐 순서로 닿지 않는다
 * - 네트워크 오류(오프라인 등)면 작업을 버리지 않고 큐에 둔 채 잠시 뒤 다시 보낸다 (3초부터 두 배씩, 최대 30초)
 * - 서버가 거부한 오류(제약 위반 등)면 그 작업만 버리고 알린 뒤(onFail), 큐가 비면 onIdle
 */
export interface SaveQueueOpts {
  /** 서버까지 못 간 오류인지 (true 면 재시도, false 면 버림) */
  isNetworkError(e: unknown): boolean;
  /** 밀림 상태가 바뀔 때 (배너용). waiting = 밀린 작업 수 */
  onNet(s: { offline: boolean; waiting: number }): void;
  /** 서버가 거부해서 버린 작업 */
  onFail(e: unknown): void;
  /** 큐가 비어 더 할 일이 없을 때 (pump 마다) */
  onIdle(): void;
}

interface Job {
  run: () => Promise<void>;
  tries: number;
}

export function createSaveQueue(o: SaveQueueOpts) {
  const queue: Job[] = [];
  let running = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearRetry = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const pump = () => {
    if (running) return;
    const job = queue[0];
    if (!job) {
      o.onIdle();
      return;
    }
    running = true;
    job
      .run()
      .then(() => {
        queue.shift();
        if (job.tries > 0) o.onNet({ offline: false, waiting: 0 });
      })
      .catch((e) => {
        if (o.isNetworkError(e)) {
          // 작업을 큐에 그대로 두고 잠시 뒤 다시 시도 (retryNow 가 오면 더 빨리)
          job.tries++;
          o.onNet({ offline: true, waiting: queue.length });
          clearRetry();
          retryTimer = setTimeout(() => {
            retryTimer = null;
            pump();
          }, Math.min(30000, 3000 * 2 ** Math.min(job.tries - 1, 4)));
          running = false;
          return;
        }
        queue.shift();
        o.onFail(e);
      })
      .then(() => {
        if (!running) return; // 재시도 대기 중
        running = false;
        pump();
      });
  };

  return {
    push(run: () => Promise<void>) {
      queue.push({ run, tries: 0 });
      pump();
    },
    /** 연결이 돌아왔을 때: 재시도 대기를 끊고 바로 보냄 */
    retryNow() {
      clearRetry();
      pump();
    },
    /** 아직 서버에 반영되지 않은 작업 수 (진행 중 포함) */
    get pending() {
      return queue.length;
    },
  };
}
