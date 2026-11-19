import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { usePrefersReducedMotion } from "./hooks";
import { poseWelcome } from "./riderPose";
import { BikeIcon } from "./ui";
import { loadRider } from "./rider";

const MIN_MS = 2600, MAX_MS = 7000, EXIT_MS = 850;

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
/** Loading line that changes as the progress moves along the road. */
const status = (p: number) => (p >= 100 ? "Ready to ride" : p >= 85 ? "Almost there" : p >= 60 ? "Fuelling up" : p >= 30 ? "Checking the mirrors" : "Warming up the engine");

/** Welcome screen: a mountain backdrop, your avatar bowing hello, and a motorcycle riding along the loading road. */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const reduced = usePrefersReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const skip = useRef<() => void>(() => {});
  const [progress, setProgress] = useState(0);
  const [out, setOut] = useState(false);
  const [hasModel, setHasModel] = useState(true);
  const [hello] = useState(greeting);
  const done = useRef(onDone); // a ref, so a new callback from the parent never restarts the 3D scene
  done.current = onDone;

  useEffect(() => {
    if (reduced) { done.current(); return; }
    const el = host.current!;
    let loaded = false, minDone = false, left = false, raf = 0;
    const leave = () => { if (left) return; left = true; setOut(true); timers.push(setTimeout(() => done.current(), EXIT_MS)); };
    skip.current = leave;
    const check = () => { if (loaded && minDone) leave(); };
    const timers = [setTimeout(() => { minDone = true; check(); }, MIN_MS), setTimeout(leave, MAX_MS)];
    const fake = setInterval(() => setProgress((p) => (p < 90 ? p + 3 : p)), 120);
    const key = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === "Escape") leave(); };
    addEventListener("keydown", key);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(380, 475);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 380 / 475, 0.1, 50);
    camera.position.set(0, 1, 4.8); camera.lookAt(0, 0.92, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.6));
    const key1 = new THREE.DirectionalLight(0xfff4e6, 2.4); key1.position.set(2, 4, 5);
    const rim = new THREE.DirectionalLight(0xbfe3ff, 1.6); rim.position.set(-3, 3, -4); // soft back light so the outline glows
    scene.add(key1, rim);

    let bow: ((t: number) => void) | null = null, avatar: THREE.Object3D | null = null, gone = false;
    loadRider((f) => setProgress((p) => Math.max(p, Math.round(f * 100)))).then((a) => {
      if (gone) return;
      avatar = a; bow = poseWelcome(avatar); scene.add(avatar);
      loaded = true; setProgress(100); check();
    }, () => { if (gone) return; setHasModel(false); loaded = true; setProgress(100); check(); });

    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      if (avatar && bow) { bow(t); avatar.rotation.y = Math.sin(t * 0.8) * 0.08; }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      gone = true;
      timers.forEach(clearTimeout); clearInterval(fake); cancelAnimationFrame(raf); removeEventListener("keydown", key);
      // The avatar's geometry, materials and textures are shared with the background (see rider.ts), so they are not
      // disposed here; dropping this canvas's own WebGL context frees everything it uploaded.
      scene.traverse((n) => (n as THREE.SkinnedMesh).skeleton?.dispose());
      renderer.dispose(); renderer.forceContextLoss(); el.removeChild(renderer.domElement);
    };
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
        <div className="w-figure" style={{ display: hasModel ? undefined : "none" }} aria-hidden="true">
          <span className="w-glow" />
          <div ref={host} className="w-model" />
          <span className="w-shadow" />
        </div>
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
