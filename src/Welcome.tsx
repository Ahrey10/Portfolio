import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./hooks";
import { BikeIcon } from "./ui";

const SHOW_MS = 2600, EXIT_MS = 850, STEP_MS = 120;

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
/** Loading line that changes as the progress moves along the road. */
const status = (p: number) => (p >= 100 ? "Ready to ride" : p >= 85 ? "Almost there" : p >= 60 ? "Fuelling up" : p >= 30 ? "Checking the mirrors" : "Warming up the engine");

/**
 * Welcome screen: a mountain backdrop, a greeting, and a motorcycle riding along the loading road.
 * It has no 3D scene of its own (CSS and SVG only), so it costs almost nothing to render while the page loads behind it.
 */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const reduced = usePrefersReducedMotion();
  const skip = useRef<() => void>(() => {});
  const [progress, setProgress] = useState(0);
  const [out, setOut] = useState(false);
  const [hello] = useState(greeting);
  const done = useRef(onDone); // a ref, so a new callback from the parent never restarts the timers
  done.current = onDone;

  useEffect(() => {
    if (reduced) { done.current(); return; }
    let left = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const leave = () => { if (left) return; left = true; setProgress(100); setOut(true); timers.push(setTimeout(() => done.current(), EXIT_MS)); };
    skip.current = leave;
    timers.push(setTimeout(leave, SHOW_MS));
    const step = (100 * STEP_MS) / (SHOW_MS - 200); // reach 100% just before the intro leaves
    const fill = setInterval(() => setProgress((p) => Math.min(100, Math.round(p + step))), STEP_MS);
    const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === "Escape") leave(); };
    addEventListener("keydown", key);
    return () => { timers.forEach(clearTimeout); clearInterval(fill); removeEventListener("keydown", key); };
  }, [reduced]);

  if (reduced) return null;
  return (
    <div className={`welcome ${out ? "out" : ""}`} role="region" aria-label="Welcome">
      <div className="w-sky" aria-hidden="true">
        <span className="w-sun" />
        <svg className="w-hills" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <path className="far" d="M0 190 120 120 230 170 360 80 470 150 600 95 720 160 850 70 980 150 1100 105 1230 165 1350 110 1440 140V320H0Z" />
          <path className="mid" d="M0 230 140 170 260 215 400 150 540 220 690 165 820 225 960 160 1110 230 1250 180 1440 220V320H0Z" />
          <path className="near" d="M0 275 180 230 330 268 520 222 700 270 880 228 1060 272 1240 236 1440 268V320H0Z" />
        </svg>
      </div>
      <div className="w-stage">
        <div className="w-text">
          <p className="w-greet mono">{hello} <span aria-hidden="true">👋</span></p>
          <p className="w-hi">{"Welcome".split("").map((c, k) => <span key={k} style={{ animationDelay: `${150 + k * 70}ms` }}>{c}</span>)}</p>
          <p className="w-sub">I’m <strong>Rey Mar</strong>, a full stack web developer. Thanks for stopping by, and make yourself at home.</p>
          <div className="w-road" role="progressbar" aria-label="Loading the portfolio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <span className="w-fill" style={{ width: `${progress}%` }} />
            <span className="w-bike" style={{ left: `${progress}%` }}><BikeIcon /></span>
          </div>
          <p className="w-pct mono"><span aria-live="polite">{status(progress)}</span> · {progress}%</p>
        </div>
      </div>
      <button type="button" className="w-skip" onClick={() => skip.current()}>Skip intro <kbd>Enter</kbd></button>
    </div>
  );
}
