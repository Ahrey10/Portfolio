import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";

export type Theme = "light" | "dark";
const RM = "(prefers-reduced-motion: reduce)";

export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(() => matchMedia(RM).matches);
  useEffect(() => {
    const m = matchMedia(RM), f = () => setR(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  return r;
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try { const s = localStorage.getItem("theme"); if (s === "light" || s === "dark") return s; } catch { /* unavailable */ }
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

/** Cursor-tracking 3D tilt and spotlight position (CSS variables). */
export function useCardTilt(reduced: boolean) {
  if (reduced) return {};
  return {
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const el = e.currentTarget, r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(x - 0.5) * 8}deg`); el.style.setProperty("--rx", `${-(y - 0.5) * 8}deg`);
      el.style.setProperty("--mx", `${x * 100}%`); el.style.setProperty("--my", `${y * 100}%`);
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => { e.currentTarget.style.setProperty("--rx", "0deg"); e.currentTarget.style.setProperty("--ry", "0deg"); },
  };
}

/** One shared observer for every card (instead of one per card); each element registers its own callback. */
const inView = new Map<Element, (v: boolean) => void>();
const observers = new Map<number, IntersectionObserver>();
function watch(el: Element, threshold: number, cb: (v: boolean) => void): () => void {
  let io = observers.get(threshold);
  if (!io) { io = new IntersectionObserver((es) => es.forEach((e) => inView.get(e.target)?.(e.isIntersecting)), { threshold }); observers.set(threshold, io); }
  inView.set(el, cb); io.observe(el);
  return () => { inView.delete(el); io.unobserve(el); };
}

/** True while the element is in the viewport (reverses on scroll out). */
export function useInView<T extends HTMLElement>(threshold = 0.15): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => watch(ref.current!, threshold, setSeen), [threshold]);
  return [ref, seen];
}

export function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-45% 0px -50% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ids]);
  return active;
}
