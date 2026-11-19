import { memo, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion, useCardTilt, useInView } from "./hooks";
import { ICONS, type IconName } from "./icons";

const KEYS = ["Warehouse Management System", "Client Portal", "Integrated Billing System", "integrated business applications", "integrated systems", "reusable application template", "standard base", "code reviews", "responsive", "end to end", "QR code scanner", "VILT stack", "customer codes", "Swagger (OpenAPI)", "Laravel", "Node.js", "browsers", "APIs"];
const RE = new RegExp(`(${KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");

export const Highlight = ({ children }: { children: ReactNode }) => <mark className="hl">{children}</mark>;
export const Highlighted = memo(function Highlighted({ text }: { text: string }) {
  const parts = useMemo(() => text.split(RE), [text]);
  return <>{parts.map((t, i) => (i % 2 ? <Highlight key={i}>{t}</Highlight> : t))}</>;
});

export const Leaf = () => (
  <svg className="leaf" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M14 2C6 2 2 6 2 11c0 1.2.3 2.2.8 3C4 9 7 7 10 6 7.500 7.800 5.500 10.500 5 14c6 0 9-4 9-12z" fill="currentColor" /></svg>
);

/** Small side-view motorcycle with spinning wheels (welcome loader and the card ride-by). */
export const BikeIcon = () => (
  <svg viewBox="0 0 48 28" width="52" height="30" aria-hidden="true" className="bike-svg">
    <circle cx="9" cy="20" r="6" /><circle cx="39" cy="20" r="6" />
    <path d="M9 20 20 10h10l9 10M20 10l-4-4h-4M30 10l4-5h6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function SkillIcon({ name }: { name: IconName }) {
  const { d, line } = ICONS[name];
  return (
    <svg className="skill-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {line ? <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> : <path d={d} fill="currentColor" />}
    </svg>
  );
}

/** Slides in from alternating sides, tilts toward the cursor, follows it with a spotlight; a small motorcycle rides past as it arrives. */
export function Card({ i = 0, className = "", children }: { i?: number; className?: string; children: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [ref, shown] = useInView<HTMLDivElement>();
  const tilt = useCardTilt(reduced);
  const delay = `${(i % 3) * 80}ms`;
  return (
    <div ref={ref} className={`slide ${shown || reduced ? "in" : ""} ${i % 2 ? "from-r" : "from-l"}`} style={{ transitionDelay: delay, "--d": delay } as CSSProperties}>
      <article className={`card ${className}`} {...tilt}>
        {children}
        {!reduced && <span className="ride" aria-hidden="true"><span className="ride-bike"><BikeIcon /></span></span>}
      </article>
    </div>
  );
}

const DEFAULT_SHOT = "/systems/default.svg";
const Zoom = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2M11 8v6M8 11h6" /></svg>;
/** Browser-style frame; falls back to the placeholder when no image is given or it fails to load. Real screenshots open in the preview. */
export function Shot({ src, name, onOpen }: { src?: string; name: string; onOpen?: () => void }) {
  const [bad, setBad] = useState(!src);
  const img = <img src={bad ? DEFAULT_SHOT : src} alt={bad ? `${name} preview placeholder` : `${name} screenshot, blurred to protect client data`} loading="lazy" decoding="async" onError={() => setBad(true)} />;
  return (
    <figure className="frame">
      <figcaption><i /><i /><i /><span>{name}</span></figcaption>
      {bad || !onOpen ? img : (
        <button type="button" className="shot-open" onClick={onOpen} aria-label={`Preview ${name} screenshot`}>
          {img}<span className="shot-hint"><Zoom />Preview</span>
        </button>
      )}
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
