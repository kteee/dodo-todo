import { useEffect, useRef, useState } from "react";

export interface DragState {
  id: string;
  /** 카테고리 위에 놓으면 카테고리만 바꿈 */
  catTarget: string | null;
  /** 날짜 칸(bucket). 한번 칸 위에 올라가면 칸 밖으로 나가도 마지막 칸을 유지 */
  zone: string | null;
  /** 자리표시가 이 카드 앞에 들어감. null이면 맨 끝 */
  beforeId: string | null;
  /** 자리표시 높이 = 집어 든 카드 높이 */
  h: number;
}

export interface GhostInfo {
  text: string;
  catName: string;
  color: string;
}

/**
 * 시안의 포인터 드래그를 그대로 옮긴 것. 마우스는 5px 움직이면 시작,
 * 터치는 320ms 꾹 눌러야 시작(그 전에 움직이면 스크롤로 양보).
 * 자리표시(.ph)는 React가 그리고, 손에 붙는 고스트만 DOM에 직접 붙인다.
 */
export function useDrag(getInfo: (id: string) => GhostInfo | null, onDrop: (d: DragState) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const cb = useRef({ getInfo, onDrop });
  cb.current = { getInfo, onDrop };

  useEffect(() => {
    let cur: DragState | null = null;
    let ghost: HTMLElement | null = null;
    let grabX = 0; // 카드 안에서 잡은 위치 — 고스트가 그 지점을 손가락 밑에 두고 따라옴
    let grabY = 0;

    const set = (next: DragState | null) => {
      if (cur && next && cur.catTarget === next.catTarget && cur.zone === next.zone && cur.beforeId === next.beforeId) return;
      cur = next;
      setDrag(next);
    };

    /** 카드를 그대로 복제해서 집어 든 것처럼 손을 따라오게 함. 원래 자리는 같은 높이의 빈칸으로 시작 */
    function begin(card: HTMLElement, id: string, x: number, y: number) {
      if (!cb.current.getInfo(id)) return false;
      const r = card.getBoundingClientRect();
      grabX = x - r.left;
      grabY = y - r.top;
      ghost = card.cloneNode(true) as HTMLElement;
      ghost.classList.remove("lifting", "ghosted");
      ghost.classList.add("drag-ghost");
      ghost.style.width = r.width + "px";
      ghost.style.transform = `translate(${r.left}px,${r.top}px)`;
      document.body.appendChild(ghost);
      document.body.classList.add("dragging");
      // 처음 자리표시는 원래 자리에 (목록이 갑자기 당겨지지 않게)
      const zone = card.closest<HTMLElement>('[data-drop^="date:"]');
      let next = card.nextElementSibling as HTMLElement | null;
      while (next && !next.classList.contains("card")) next = next.nextElementSibling as HTMLElement | null;
      set({ id, catTarget: null, zone: zone ? zone.dataset.drop!.slice(5) : null, beforeId: next?.dataset.id ?? null, h: r.height });
      return true;
    }

    function over(x: number, y: number) {
      if (!cur) return;
      const el = document.elementFromPoint(x, y);
      const cat = el?.closest<HTMLElement>('[data-drop^="cat:"]');
      if (cat) {
        set({ ...cur, catTarget: cat.dataset.drop!.slice(4) });
        return;
      }
      const zone = el?.closest<HTMLElement>('[data-drop^="date:"]');
      if (!zone) {
        if (cur.catTarget) set({ ...cur, catTarget: null });
        return;
      }
      const list = zone.querySelector(".list");
      const cards = list ? Array.from(list.querySelectorAll<HTMLElement>(".card")).filter((n) => n.dataset.id !== cur!.id) : [];
      let beforeId: string | null = null;
      for (const c of cards) {
        const r = c.getBoundingClientRect();
        if (y < r.top + r.height / 2) {
          beforeId = c.dataset.id!;
          break;
        }
      }
      set({ ...cur, catTarget: null, zone: zone.dataset.drop!.slice(5), beforeId });
    }

    /** 드래그를 놓은 직후 따라오는 클릭 한 번은 무시 — 안 그러면 카드가 수정 모드로 열림 */
    function swallowNextClick() {
      const stop = (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
      };
      document.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", stop, { capture: true }), 0);
    }

    function finish() {
      swallowNextClick();
      const d = cur;
      ghost?.remove();
      ghost = null;
      document.body.classList.remove("dragging");
      set(null);
      if (d && (d.catTarget || d.zone)) cb.current.onDrop(d);
    }

    function onDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const target = e.target as Element | null;
      const card = target?.closest?.<HTMLElement>(".card");
      // 버튼, 그리고 수정 중인 카드(입력칸에서 글자를 드래그로 선택하는 것)는 드래그하지 않음
      if (!card || target!.closest("button, input, select, textarea, .is-editing")) return;
      const id = card.dataset.id!;
      const touch = e.pointerType !== "mouse";
      const sx = e.clientX;
      const sy = e.clientY;
      let started = false;
      let hold: number | null = null;

      if (touch) {
        card.classList.add("lifting");
        hold = window.setTimeout(() => {
          hold = null;
          started = begin(card!, id, sx, sy);
        }, 320);
      }
      function move(ev: PointerEvent) {
        if (!started) {
          if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 5) return;
          if (touch) {
            if (hold) clearTimeout(hold);
            hold = null;
            card!.classList.remove("lifting");
            return;
          }
          started = begin(card!, id, sx, sy);
          if (!started) return;
        }
        over(ev.clientX, ev.clientY);
        if (ghost) ghost.style.transform = `translate(${ev.clientX - grabX}px,${ev.clientY - grabY}px)`;
        ev.preventDefault();
      }
      function up() {
        if (hold) clearTimeout(hold);
        hold = null;
        card!.classList.remove("lifting");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        document.removeEventListener("pointercancel", up);
        if (started) finish();
      }
      document.addEventListener("pointermove", move, { passive: false });
      document.addEventListener("pointerup", up);
      document.addEventListener("pointercancel", up);
    }

    // 터치 드래그 중엔 페이지가 스크롤되지 않게 (안 막으면 브라우저가 pointercancel을 보내 드래그가 끊김)
    const blockScroll = (e: TouchEvent) => {
      if (cur) e.preventDefault();
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("touchmove", blockScroll);
      ghost?.remove();
    };
  }, []);

  return drag;
}
