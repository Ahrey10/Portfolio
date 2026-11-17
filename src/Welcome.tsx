import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { usePrefersReducedMotion } from "./hooks";
import { poseWelcome } from "./riderPose";

THREE.Cache.enabled = true; // the portfolio background reuses the downloaded model
const MIN_MS = 2600, MAX_MS = 7000;

const Bike = () => (
  <svg viewBox="0 0 48 28" width="52" height="30" aria-hidden="true" className="w-bike-svg">
    <circle cx="9" cy="20" r="6" /><circle cx="39" cy="20" r="6" />
    <path d="M9 20 20 10h10l9 10M20 10l-4-4h-4M30 10l4-5h6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Welcome screen: your avatar bows hello while a motorcycle rides along the loading road. */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const reduced = usePrefersReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [out, setOut] = useState(false);
  const [hasModel, setHasModel] = useState(true);

  useEffect(() => {
    if (reduced) { onDone(); return; }
    const el = host.current!;
    let loaded = false, minDone = false, left = false, raf = 0;
    const leave = () => { if (left) return; left = true; setOut(true); setTimeout(onDone, 700); };
    const check = () => { if (loaded && minDone) leave(); };
    const timers = [setTimeout(() => { minDone = true; check(); }, MIN_MS), setTimeout(leave, MAX_MS)];
    const fake = setInterval(() => setProgress((p) => (p < 90 ? p + 3 : p)), 120);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(380, 475);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 380 / 475, 0.1, 50);
    camera.position.set(0, 1, 4.8); camera.lookAt(0, 0.92, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 4, 5); scene.add(sun);

    let wave: ((t: number) => void) | null = null, avatar: THREE.Object3D | null = null;
    new GLTFLoader().load("/models/rider.glb", (gltf) => {
      if (left && !avatar) { /* finished waiting already */ }
      avatar = gltf.scene;
      avatar.traverse((o) => { o.frustumCulled = false; });
      wave = poseWelcome(avatar);
      scene.add(avatar);
      loaded = true; setProgress(100); check();
    }, (ev) => { if (ev.total) setProgress((p) => Math.max(p, Math.round((ev.loaded / ev.total) * 100))); },
    () => { setHasModel(false); loaded = true; check(); });

    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      if (avatar && wave) { wave(t); avatar.rotation.y = Math.sin(t * 0.8) * 0.08; }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      timers.forEach(clearTimeout); clearInterval(fake); cancelAnimationFrame(raf);
      scene.traverse((n) => {
        const m = n as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          Object.values(x).forEach((v) => { const tx = v as THREE.Texture | null; if (tx?.isTexture) tx.dispose(); });
          x.dispose();
        });
        (n as THREE.SkinnedMesh).skeleton?.dispose();
      });
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, [reduced, onDone]);

  if (reduced) return null;
  return (
    <div className={`welcome ${out ? "out" : ""}`} role="status" aria-label="Welcome">
      <div className="w-stage">
        <div ref={host} className="w-model" style={{ display: hasModel ? undefined : "none" }} aria-hidden="true" />
        <div className="w-text">
          <p className="w-hi">{"Welcome".split("").map((c, k) => <span key={k} style={{ animationDelay: `${k * 70}ms` }}>{c}</span>)}</p>
          <p className="w-sub">Hi, I’m Rey Mar. Thanks for stopping by.</p>
          <div className="w-road" aria-hidden="true">
            <span className="w-fill" style={{ width: `${progress}%` }} />
            <span className="w-bike" style={{ left: `${progress}%` }}><Bike /></span>
          </div>
          <p className="w-pct mono">Warming up the engine · {progress}%</p>
        </div>
      </div>
    </div>
  );
}