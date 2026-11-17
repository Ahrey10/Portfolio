import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Theme } from "./hooks";
import { poseRider, SEAT } from "./riderPose";

const river = (z: number) => Math.sin(z * 0.06) * 5;
const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const heightAt = (x: number, z: number) => {
  const e = smooth((Math.abs(x - river(z)) - 7) / 22);
  return e * (14 + Math.sin(x * 0.11 + z * 0.07) * 4 + Math.cos(z * 0.13) * 3) + Math.sin(x * 0.3 + z * 0.2) * 0.4 * e - (1 - e) * 0.6;
};
const dot = () => {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.beginPath(); g.arc(16, 16, 15, 0, 6.3); g.fill();
  return new THREE.CanvasTexture(c);
};
const BIKE_SCALE = 2.3, BEHIND = 11.5; // bike size and how far ahead of the camera it rides // bike size and how far ahead of the camera it rides
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const PAL = {
  light: { sky: 0xdbe7e0, low: 0x5f8f5a, high: 0x9aa596, snow: 0xf2f5f0, leaf: 0x2f6b45, trunk: 0x5b4636, peak: 0x8fa39a, water: 0x474d52, cloud: 0xffffff, cloudA: 0.85, sun: 0xffe2a8, hemi: [0xffffff, 0x6a8a64, 1.0], dir: [0xfff1d6, 1.1], mote: 0xffffff },
  dark: { sky: 0x0b120f, low: 0x1d3a27, high: 0x3a4a44, snow: 0x8da0a8, leaf: 0x16382a, trunk: 0x2a2018, peak: 0x23322c, water: 0x1b2024, cloud: 0x3a4a52, cloudA: 0.35, sun: 0xdfe8ff, hemi: [0x6f86b0, 0x0c1410, 0.55], dir: [0x9fb6ff, 0.35], mote: 0xe8ff9a },
} as const;

export default function Background({ theme }: { theme: Theme }) {
  const host = useRef<HTMLDivElement>(null);
  const apply = useRef<(t: Theme) => void>(() => {});

  useEffect(() => {
    const el = host.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 25, 110);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 220);
    const hemi = new THREE.HemisphereLight();
    const dir = new THREE.DirectionalLight();
    dir.position.set(20, 30, -20);
    scene.add(hemi, dir);

    // Terrain: valley with a winding river, coloured by height (grass, rock, snow).
    const tg = new THREE.PlaneGeometry(120, 120, 90, 90);
    tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i) - 20));
    tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(tp.count * 3), 3));
    const ground = new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    ground.position.z = -20;
    scene.add(ground);

    // Road: asphalt ribbon, edge lines, dashed centre line and roadside posts, all following the valley curve.
    const roadMat = new THREE.MeshLambertMaterial();
    const edgeMat = new THREE.MeshBasicMaterial(), dashMat = new THREE.MeshBasicMaterial(), postMat = new THREE.MeshLambertMaterial();
    const ribbon = (w: number, off: number, y: number, mat: THREE.Material) => {
      const g = new THREE.PlaneGeometry(w, 120, 1, 120);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) + off + river(p.getZ(i) - 20)); p.setY(i, y); }
      const m = new THREE.Mesh(g, mat); m.position.z = -20; return m;
    };
    scene.add(ribbon(7, 0, -0.45, roadMat), ribbon(0.14, -3.1, -0.43, edgeMat), ribbon(0.14, 3.1, -0.43, edgeMat));
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 2), dashMat, 30);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), postMat, 48);
    const d = new THREE.Object3D();
    for (let i = 0; i < 30; i++) { const z = 36 - i * 4; d.position.set(river(z), -0.42, z); d.rotation.set(0, Math.atan(Math.cos(z * 0.06) * 0.3), 0); d.updateMatrix(); dashes.setMatrixAt(i, d.matrix); }
    d.rotation.set(0, 0, 0);
    for (let i = 0; i < 48; i++) { const z = 38 - (i >> 1) * 5; d.position.set(river(z) + (i & 1 ? 4 : -4), -0.15, z); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); }
    scene.add(dashes, posts);

    // Motorcycle with rider, seen from behind, riding just ahead of the camera.
    const bikeMat = new THREE.MeshLambertMaterial({ flatShading: true });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1b2024, flatShading: true });
    const bike = new THREE.Group(), wheels: THREE.Mesh[] = [];
    const part = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); bike.add(o); return o; };
    [-0.85, 0.85].forEach((z) => wheels.push(part(new THREE.TorusGeometry(0.32, 0.08, 8, 18).rotateY(Math.PI / 2), darkMat, 0, 0.4, z)));
    part(new THREE.BoxGeometry(0.2, 0.25, 1.5), darkMat, 0, 0.6, 0);
    part(new THREE.BoxGeometry(0.32, 0.28, 0.5), bikeMat, 0, 0.86, -0.3);
    part(new THREE.BoxGeometry(0.3, 0.1, 0.8), darkMat, 0, 0.8, 0.35);
    part(new THREE.BoxGeometry(0.3, 0.05, 0.05), darkMat, 0, 1.08, -0.3);
    // Simple stand-in rider, removed as soon as the avatar model has loaded.
    const stand = [part(new THREE.BoxGeometry(0.42, 0.62, 0.3), bikeMat, 0, 1.3, 0.2), part(new THREE.SphereGeometry(0.2, 12, 10), bikeMat, 0, 1.85, 0.05)];
    stand[0].rotation.x = -0.3;
    part(new THREE.BoxGeometry(0.1, 0.1, 0.04), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 0, 0.85, 0.77);
    bike.scale.setScalar(BIKE_SCALE);
    bike.rotation.order = "YXZ"; // pitch and lean stay relative to the bike's own heading
    const head = new THREE.SpotLight(0xfff2cc, 0, 45, 0.5, 0.6);
    head.position.set(0, 1, -0.9); head.target.position.set(0, 0, -12);
    bike.add(head, head.target);
    bike.position.set(river(30 - BEHIND), -0.45, 30 - BEHIND);
    scene.add(bike);

    // Your avatar (GLB): seated on the bike in a riding pose.
    let disposed = false;
    new GLTFLoader().load("/models/rider.glb", (gltf) => {
      if (disposed) return;
      const rider = gltf.scene;
      rider.traverse((o) => { o.frustumCulled = false; }); // skinned meshes are posed after load
      rider.position.set(SEAT.x, SEAT.y, SEAT.z);
      rider.rotation.y = Math.PI; // the avatar faces +z, the bike rides towards -z
      rider.scale.setScalar(SEAT.scale);
      bike.add(rider);
      poseRider(rider);
      stand.forEach((o) => { bike.remove(o); o.geometry.dispose(); });
    }, undefined, () => { /* model missing or failed: keep the stand-in rider */ });

    // Distant peaks with snow caps.
    const peakMat = new THREE.MeshLambertMaterial({ flatShading: true });
    const snowMat = new THREE.MeshLambertMaterial({ flatShading: true });
    for (let i = 0; i < 7; i++) {
      const h = rnd(26, 42), r = rnd(14, 20), x = -66 + i * 22 + rnd(-5, 5);
      const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), peakMat);
      p.position.set(x, h / 2 - 2, -84);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.3, 6), snowMat);
      cap.position.set(x, h - h * 0.15 - 2, -84);
      scene.add(p, cap);
    }

    // Pine forest: three instanced meshes (two foliage tiers + trunk).
    const N = 320;
    const tier1 = new THREE.ConeGeometry(1.7, 4.5, 7).translate(0, 3.4, 0);
    const tier2 = new THREE.ConeGeometry(1.2, 3.5, 7).translate(0, 5.6, 0);
    const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6).translate(0, 0.9, 0);
    const leafMat = new THREE.MeshLambertMaterial({ flatShading: true });
    const trunkMat = new THREE.MeshLambertMaterial();
    const f1 = new THREE.InstancedMesh(tier1, leafMat, N), f2 = new THREE.InstancedMesh(tier2, leafMat, N), tr = new THREE.InstancedMesh(trunkG, trunkMat, N);
    const o = new THREE.Object3D(), tone = new THREE.Color();
    let placed = 0;
    while (placed < N) {
      const x = rnd(-58, 58), z = rnd(-78, 34), y = heightAt(x, z);
      if (Math.abs(x - river(z)) < 9 || y > 10) continue;
      o.position.set(x, y, z);
      o.scale.setScalar(rnd(0.7, 1.7));
      o.rotation.y = rnd(0, 6.28);
      o.updateMatrix();
      [f1, f2, tr].forEach((m) => m.setMatrixAt(placed, o.matrix));
      f1.setColorAt(placed, tone.setScalar(rnd(0.8, 1.15)));
      f2.setColorAt(placed, tone);
      placed++;
    }
    scene.add(f1, f2, tr);

    // Sun / moon with halo.
    const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 24), new THREE.MeshBasicMaterial({ fog: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 24), new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.18 }));
    sun.position.set(24, 24, -92); halo.position.copy(sun.position);
    scene.add(sun, halo);

    // Clouds drift across the sky.
    const cloudMat = new THREE.MeshBasicMaterial({ transparent: true, fog: false });
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rnd(2.5, 4.5), 10, 8), cloudMat);
        s.position.set(k * 3 - 6, rnd(-1, 1), rnd(-1.5, 1.5)); s.scale.y = 0.55; g.add(s);
      }
      g.position.set(rnd(-80, 80), rnd(20, 30), rnd(-80, -30));
      clouds.push(g); scene.add(g);
    }

    // Birds (day only): two flapping wings each.
    const wingG = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1.3, 0.1, -0.5, 1.1, 0, 0.6]), 3));
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x1d2a21, side: THREE.DoubleSide, fog: false });
    const birds = new THREE.Group();
    const flock: { g: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; ph: number; sp: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group(), l = new THREE.Mesh(wingG, birdMat), r = new THREE.Mesh(wingG, birdMat);
      l.scale.x = -1; g.add(l, r); g.scale.setScalar(0.8);
      g.position.set(rnd(-70, 70), rnd(14, 22), rnd(-45, -8));
      flock.push({ g, l, r, ph: rnd(0, 6), sp: rnd(2, 4) }); birds.add(g);
    }
    scene.add(birds);

    // Stars (night) and motes: pollen by day, fireflies by night.
    const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, fog: false, map: dot(), alphaTest: 0.4, transparent: true }));
    const sa = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) { sa[i * 3] = rnd(-130, 130); sa[i * 3 + 1] = rnd(14, 70); sa[i * 3 + 2] = -100; }
    stars.geometry.setAttribute("position", new THREE.BufferAttribute(sa, 3));
    const ma = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) { const mz = rnd(-60, 30); ma[i * 3] = river(mz) + rnd(-14, 14); ma[i * 3 + 1] = rnd(0.5, 6); ma[i * 3 + 2] = mz; }
    const motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.18, transparent: true, depthWrite: false, map: dot() }));
    motes.geometry.setAttribute("position", new THREE.BufferAttribute(ma, 3));
    scene.add(stars, motes);

    apply.current = (t) => {
      const p = PAL[t], night = t === "dark";
      const sky = new THREE.Color(p.sky);
      scene.background = sky; (scene.fog as THREE.Fog).color.copy(sky);
      hemi.color.setHex(p.hemi[0]); hemi.groundColor.setHex(p.hemi[1]); hemi.intensity = p.hemi[2];
      dir.color.setHex(p.dir[0]); dir.intensity = p.dir[1];
      const c = tg.attributes.color as THREE.BufferAttribute, col = new THREE.Color();
      const lo = new THREE.Color(p.low), hi = new THREE.Color(p.high), sn = new THREE.Color(p.snow);
      for (let i = 0; i < tp.count; i++) {
        const y = tp.getY(i);
        col.copy(lo).lerp(hi, smooth((y - 2) / 7));
        if (y > 10) col.lerp(sn, smooth((y - 10) / 3));
        c.setXYZ(i, col.r, col.g, col.b);
      }
      c.needsUpdate = true;
      leafMat.color.setHex(p.leaf); trunkMat.color.setHex(p.trunk);
      peakMat.color.setHex(p.peak); snowMat.color.setHex(p.snow);
      roadMat.color.setHex(p.water); edgeMat.color.setHex(night ? 0x9aa89f : 0xf0f3ee); dashMat.color.setHex(night ? 0xb9a860 : 0xe8c25a);
      postMat.color.setHex(night ? 0x8a968f : 0xdfe6df); bikeMat.color.setHex(night ? 0x52b788 : 0x2b5636); head.intensity = night ? 300 : 0;
      cloudMat.color.setHex(p.cloud); cloudMat.opacity = p.cloudA;
      (sun.material as THREE.MeshBasicMaterial).color.setHex(p.sun);
      (halo.material as THREE.MeshBasicMaterial).color.setHex(p.sun);
      const mm = motes.material as THREE.PointsMaterial;
      mm.color.setHex(p.mote); mm.opacity = night ? 0.95 : 0.5; mm.size = night ? 0.3 : 0.15;
      mm.blending = night ? THREE.AdditiveBlending : THREE.NormalBlending; mm.needsUpdate = true;
      stars.visible = night; birds.visible = !night;
    };
    apply.current(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

    const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
    resize(); addEventListener("resize", resize);

    let mx = 0, my = 0, prog = 0, raf = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    const onScroll = () => { prog = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); };
    addEventListener("pointermove", onMove); addEventListener("scroll", onScroll, { passive: true });
    camera.position.set(river(30), 4.8, 30);
    const clock = new THREE.Clock();

    const tick = () => {
      const dt = clock.getDelta(), t = clock.elapsedTime;
      if (!reduce) {
        // Scroll walks the camera down the valley; the pointer adds parallax.
        const z = 30 - prog * 54, x = river(z) + mx * 3, y = 4.8 + prog * 1.5 - my;
        camera.position.x += (x - camera.position.x) * 0.05;
        camera.position.y += (y - camera.position.y) * 0.05;
        camera.position.z += (z - camera.position.z) * 0.06;
        // The bike rides ahead of the camera, leans into bends and its wheels turn as you scroll.
        const bz = camera.position.z - BEHIND;
        bike.position.set(river(bz), -0.45 + Math.sin(t * 28) * 0.004, bz);
        bike.rotation.set(0, Math.atan(Math.cos(bz * 0.06) * 0.3), Math.sin(bz * 0.06) * 0.2);
        wheels.forEach((w) => { w.rotation.x = camera.position.z * -1.4; });
        clouds.forEach((c) => { c.position.x += dt * 0.8; if (c.position.x > 95) c.position.x = -95; });
        flock.forEach((b) => {
          b.g.position.x += dt * b.sp; if (b.g.position.x > 80) b.g.position.x = -80;
          const f = Math.sin(t * 8 + b.ph) * 0.55; b.l.rotation.z = -f; b.r.rotation.z = f;
          b.g.position.y += Math.sin(t + b.ph) * 0.01;
        });
        motes.position.y = Math.sin(t * 0.5) * 0.6; motes.rotation.y = t * 0.02;
      }
      camera.lookAt(bike.position.x, 2.5, bike.position.z - 12);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    onScroll(); tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize); removeEventListener("pointermove", onMove); removeEventListener("scroll", onScroll);
      scene.traverse((n) => {
        const m = n as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          Object.values(x).forEach((v) => { const t = v as THREE.Texture | null; if (t?.isTexture) t.dispose(); });
          x.dispose();
        });
        (n as THREE.SkinnedMesh).skeleton?.dispose();
      });
      renderer.dispose(); el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const el = host.current!;
    el.style.opacity = "0"; // quick crossfade so the scene recolours smoothly
    const id = setTimeout(() => { apply.current(theme); el.style.opacity = "1"; }, 220);
    return () => clearTimeout(id);
  }, [theme]);
  return <div ref={host} className="bg3d" aria-hidden="true" />;
}