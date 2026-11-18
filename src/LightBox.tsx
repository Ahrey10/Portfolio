import { useEffect, useRef, useState } from "react";

export interface Slide { src: string; name: string }

const Arrow = ({ flip = false }: { flip?: boolean }) => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={flip ? { transform: "scaleX(-1)" } : undefined}><path d="m15 5-7 7 7 7" /></svg>;
const Close = () => <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>;

/**
 * Screenshot preview. A plain overlay rather than <dialog>, because the browser top layer would hide the custom cursor.
 * Esc closes, arrow keys step through, Tab stays inside, focus returns to the opener.
 */
export default function Lightbox({ slides, index, onIndex, onClose }: { slides: Slide[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [bad, setBad] = useState(false);
  const s = slides[index], many = slides.length > 1;
  const step = (k: number) => onIndex((index + k + slides.length) % slides.length);

  useEffect(() => setBad(false), [index]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const html = document.documentElement, prev = html.style.overflow;
    html.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>(".lb-close")?.focus();
    return () => { html.style.overflow = prev; opener?.focus(); };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && many) step(1);
      else if (e.key === "ArrowLeft" && many) step(-1);
      else if (e.key === "Tab") {
        const f = [...(box.current?.querySelectorAll<HTMLElement>("button") ?? [])];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  });

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-labelledby="lb-title" ref={box} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <figure className="lb-panel">
        <div className="lb-bar">
          <span className="lb-dots" aria-hidden="true"><i /><i /><i /></span>
          <h3 id="lb-title">{s.name}</h3>
          {many && <span className="lb-count mono" aria-live="polite">{index + 1} / {slides.length}</span>}
          <button type="button" className="lb-btn lb-close" onClick={onClose} aria-label="Close preview"><Close /></button>
        </div>
        <div className="lb-stage">
          {bad ? <p className="lb-missing">Preview unavailable.</p> : <img key={s.src} src={s.src} alt={`${s.name} screenshot, blurred to protect client data`} onError={() => setBad(true)} />}
          {many && <>
            <button type="button" className="lb-btn lb-prev" onClick={() => step(-1)} aria-label="Previous screenshot"><Arrow /></button>
            <button type="button" className="lb-btn lb-next" onClick={() => step(1)} aria-label="Next screenshot"><Arrow flip /></button>
          </>}
        </div>
        <figcaption className="lb-note">Blurred and redacted to protect client confidentiality.</figcaption>
      </figure>
    </div>
  );
}
