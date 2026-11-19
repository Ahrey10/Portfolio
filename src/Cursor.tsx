import { memo, useEffect, useRef } from "react";

/** Custom cursor: a dot plus a trailing ring that reacts to links, cards and clicks. Fine pointers only. */
export default memo(function Cursor() {
  const dot = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const root = document.documentElement, d = dot.current!, r = ring.current!;
    const follow = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 0.18;
    root.classList.add("has-cursor");
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX; y = e.clientY; d.style.opacity = r.style.opacity = "";
      if (!raf) raf = requestAnimationFrame(loop);
      const t = e.target as Element | null;
      const kind = t?.closest("input,textarea") ? "text" : t?.closest("a,button") ? "link" : t?.closest(".card") ? "card" : "";
      d.dataset.kind = r.dataset.kind = kind;
    };
    const down = () => r.classList.add("press"), up = () => r.classList.remove("press");
    const hide = () => { d.style.opacity = r.style.opacity = "0"; };
    const loop = () => {
      rx += (x - rx) * follow; ry += (y - ry) * follow;
      d.style.transform = `translate3d(${x}px,${y}px,0)`; r.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0; // sleep once the ring has caught up
    };
    addEventListener("pointermove", move); addEventListener("pointerdown", down); addEventListener("pointerup", up);
    document.documentElement.addEventListener("mouseleave", hide);
    return () => {
      cancelAnimationFrame(raf); root.classList.remove("has-cursor");
      removeEventListener("pointermove", move); removeEventListener("pointerdown", down); removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("mouseleave", hide);
    };
  }, []);
  return (<><div ref={ring} className="cur-ring" aria-hidden="true" /><div ref={dot} className="cur-dot" aria-hidden="true" /></>);
});
