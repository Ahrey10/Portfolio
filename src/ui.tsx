import { useEffect, useState, type ReactNode } from "react";
import { usePrefersReducedMotion, useCardTilt, useInView } from "./hooks";

const KEYS = ["Warehouse Management System", "Client Portal", "Integrated Billing System", "CRM", "WMS", "reusable website template", "standard base", "code reviews", "responsive", "QR code scanner", "VILT", "customer codes", "QNE", "Swagger", "end to end", "Laravel", "Node.js", "browsers"];
const RE = new RegExp(`(${KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");

export const Highlight = ({ children }: { children: ReactNode }) => <mark className="hl">{children}</mark>;
export const Highlighted = ({ text }: { text: string }) => (
  <>{text.split(RE).map((t, i) => (i % 2 ? <Highlight key={i}>{t}</Highlight> : t))}</>
);

export const Leaf = () => (
  <svg className="leaf" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M14 2C6 2 2 6 2 11c0 1.2.3 2.2.8 3C4 9 7 7 10 6 7.500 7.800 5.500 10.500 5 14c6 0 9-4 9-12z" fill="currentColor" /></svg>
);

/** Slides in from alternating sides, tilts toward the cursor, follows it with a spotlight. */
export function Card({ i = 0, className = "", children }: { i?: number; className?: string; children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [ref, shown] = useInView<HTMLDivElement>();
  const tilt = useCardTilt(reduced);
  return (
    <div ref={ref} className={`slide ${shown || reduced ? "in" : ""} ${i % 2 ? "from-r" : "from-l"}`} style={{ transitionDelay: `${(i % 3) * 80}ms` }}>
      <article className={`card ${className}`} {...tilt}>{children}</article>
    </div>
  );
}

const DEFAULT_SHOT = "/systems/default.svg";
/** Browser-style frame; falls back to the placeholder when no image is given or it fails to load. */
export function Shot({ src, name }: { src?: string; name: string }) {
  const [bad, setBad] = useState(!src);
  return (
    <figure className="frame">
      <figcaption><i /><i /><i /><span>{name}</span></figcaption>
      <img src={bad ? DEFAULT_SHOT : src} alt={bad ? `${name} preview placeholder` : `${name} screenshot, blurred to protect client data`} loading="lazy" onError={() => setBad(true)} />
    </figure>
  );
}

export function Logo() {
  const [bad, setBad] = useState(false);
  return (
    <a href="#top" className="brand" aria-label="Rey Mar Britania, back to top">
      {bad ? <span className="mono">RB</span> : <img src="/logo.jpg" alt="" width={42} height={42} onError={() => setBad(true)} />}
    </a>
  );
}

export function Welcome({ onDone }: { onDone: () => void }) {
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(false);
  useEffect(() => {
    if (reduced) { onDone(); return; }
    const a = setTimeout(() => setOut(true), 2300), b = setTimeout(onDone, 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [reduced, onDone]);
  if (reduced) return null;
  return (
    <div className={`welcome ${out ? "out" : ""}`} role="status" aria-label="Welcome">
      <p className="w-hi">{"Welcome".split("").map((c, k) => <span key={k} style={{ animationDelay: `${k * 70}ms` }}>{c}</span>)}</p>
      <span className="w-line" />
    </div>
  );
}
