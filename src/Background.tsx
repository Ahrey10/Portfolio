import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Theme } from "./hooks";
import { poseRider, SEAT } from "./riderPose";

const BIKE_SCALE = 2.3, BEHIND = 11.5; // bike size and how far ahead of the camera it rides
const RIDE = 78; // distance the camera travels down the road as you scroll (ends just before the tunnel)
const Z_TUNNEL = -66; // front face of the tunnel portal

const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const flat = (z: number) => 1 - smooth((-z - 38) / 26); // the road straightens out before the tunnel
const river = (z: number) => Math.sin(z * 0.06) * 5 * flat(z); // road centre line (also carves the valley)
const dx = (z: number) => (river(z + 0.05) - river(z - 0.05)) / 0.1; // road heading
const heightAt = (x: number, z: number) => {
  const e = smooth((Math.abs(x - river(z)) - 7) / 22);
  return e * (14 + Math.sin(x * 0.11 + z * 0.07) * 4 + Math.cos(z * 0.13) * 3 + Math.sin(x * 0.9 + z * 0.7) * 0.5 + Math.sin(x * 1.9 - z * 1.3) * 0.2)
    + Math.sin(x * 0.3 + z * 0.2) * 0.4 * e - (1 - e) * 0.6;
};
const dot = () => {
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d")!; g.fillStyle = "#fff"; g.beginPath(); g.arc(16, 16, 15, 0, 6.3); g.fill();
  return new THREE.CanvasTexture(c);
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Speckled surface texture (asphalt, gravel, rock) so large surfaces do not look flat. */
function grain(base: [number, number, number], amp: number, spots: number, repeat: [number, number]) {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!; g.fillStyle = `rgb(${base.join(",")})`; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < spots; i++) {
    const v = Math.round((Math.random() - 0.5) * amp * 2), s = Math.random() * 2.5 + 1;
    g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(...repeat);
  return t;
}
/** Tunnel profile: straight sides with a round top. */
function arch(s: THREE.Path, w: number, yb: number, ys: number) {
  s.moveTo(-w / 2, yb); s.lineTo(-w / 2, ys); s.absarc(0, ys, w / 2, Math.PI, 0, true); s.lineTo(w / 2, yb); s.closePath();
}

const PAL = {
  light: { top: 0x6fa6d6, horizon: 0xdbe7e0, low: 0x5f8f5a, high: 0x9aa596, snow: 0xf2f5f0, leaf: 0x2f6b45, trunk: 0x5b4636, peak: 0x8fa39a, road: 0xffffff, gravel: 0xcfc8b8, rock: 0xd8d4ca, concrete: 0xc9ccc8, cloud: 0xffffff, cloudA: 0.85, sun: 0xffe2a8, hemi: [0xffffff, 0x6a8a64, 1.0], dir: [0xfff1d6, 1.1], mote: 0xffffff, tun: 0xfff1c9 },
  dark: { top: 0x050a09, horizon: 0x14211b, low: 0x1d3a27, high: 0x3a4a44, snow: 0x8da0a8, leaf: 0x16382a, trunk: 0x2a2018, peak: 0x23322c, road: 0x59636a, gravel: 0x6a6a64, rock: 0x586068, concrete: 0x6c7070, cloud: 0x3a4a52, cloudA: 0.35, sun: 0xdfe8ff, hemi: [0x6f86b0, 0x0c1410, 0.55], dir: [0x9fb6ff, 0.35], mote: 0xe8ff9a, tun: 0xffe08a },
} as const;

export default function Background({ theme }: { theme: Theme }) {
  const host = useRef<HTMLDivElement>(null);
  const apply = useRef<(t: Theme) => void>(() => {});

  useEffect(() => {
    const el = host.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 30, 125);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 230);
    const hemi = new THREE.HemisphereLight();
    const dir = new THREE.DirectionalLight();
    dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048); dir.shadow.bias = -0.0006;
    Object.assign(dir.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 140 });
    dir.shadow.camera.updateProjectionMatrix();
    const lightOffset = new THREE.Vector3(22, 34, -18);
    scene.add(hemi, dir, dir.target);

    // Sky dome: gradient from the horizon haze to the zenith. Follows the camera.
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
      vertexShader: `varying float h;
      void main() { h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top;
      uniform vec3 bottom;
      varying float h;
      void main() {
        gl_FragColor = vec4(mix(bottom, top, pow(clamp(h, 0.0, 1.0), 0.55)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(190, 24, 16), skyMat);
    sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

    // Terrain: smooth-shaded valley, coloured by height with per-vertex variation.
    const tg = new THREE.PlaneGeometry(120, 120, 140, 140);
    tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i) - 20));
    tg.computeVertexNormals();
    tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(tp.count * 3), 3));
    const jitter = Float32Array.from({ length: tp.count }, Math.random);
    const ground = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    ground.position.z = -20; ground.receiveShadow = true;
    scene.add(ground);

    // Road: textured asphalt, gravel shoulder, edge lines, dashed centre line and roadside posts.
    const roadMat = new THREE.MeshStandardMaterial({ map: grain([74, 79, 83], 18, 9000, [1, 36]), roughness: 0.92 });
    const gravelMat = new THREE.MeshStandardMaterial({ map: grain([150, 142, 128], 30, 9000, [2, 40]), roughness: 1 });
    const edgeMat = new THREE.MeshBasicMaterial(), dashMat = new THREE.MeshBasicMaterial(), postMat = new THREE.MeshLambertMaterial();
    const ribbon = (w: number, off: number, y: number, mat: THREE.Material, shadow = false) => {
      const g = new THREE.PlaneGeometry(w, 120, 1, 120);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) + off + river(p.getZ(i) - 20)); p.setY(i, y); }
      const m = new THREE.Mesh(g, mat); m.position.z = -20; m.receiveShadow = shadow; return m;
    };
    scene.add(ribbon(9.8, 0, -0.5, gravelMat, true), ribbon(7, 0, -0.45, roadMat, true), ribbon(0.14, -3.1, -0.43, edgeMat), ribbon(0.14, 3.1, -0.43, edgeMat));
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 2), dashMat, 26);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), postMat, 42);
    const d = new THREE.Object3D();
    for (let i = 0; i < 26; i++) { const z = 36 - i * 4; d.position.set(river(z), -0.42, z); d.rotation.set(0, Math.atan(dx(z)), 0); d.updateMatrix(); dashes.setMatrixAt(i, d.matrix); }
    d.rotation.set(0, 0, 0);
    for (let i = 0; i < 42; i++) { const z = 38 - (i >> 1) * 5; d.position.set(river(z) + (i & 1 ? 4 : -4), -0.15, z); d.updateMatrix(); posts.setMatrixAt(i, d.matrix); }
    scene.add(dashes, posts);

    // Tunnel at the end of the road: rock face with a round portal, concrete frame, dark tube, light at the far end.
    const rockMat = new THREE.MeshStandardMaterial({ map: grain([150, 146, 138], 34, 12000, [0.07, 0.07]), roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const concreteMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const tunMat = new THREE.MeshBasicMaterial({ fog: false });
    const tun = new THREE.Group();
    tun.position.set(0, 0, Z_TUNNEL); tun.rotation.y = Math.PI; // local +z runs into the mountain
    const face = new THREE.Shape();
    [[-70, -3], [-70, 10], [-48, 16], [-30, 12], [-14, 24], [0, 28], [16, 22], [34, 15], [50, 18], [70, 9], [70, -3]].forEach(([x, y], i) => (i ? face.lineTo(x, y) : face.moveTo(x, y)));
    face.closePath();
    const hole = new THREE.Path(); arch(hole, 9.4, -0.45, 2.6); face.holes.push(hole);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: 10, bevelEnabled: false }), rockMat);
    wall.receiveShadow = true; wall.castShadow = true;
    const ringShape = new THREE.Shape(); arch(ringShape, 11.6, -3, 2.6);
    const ringHole = new THREE.Path(); arch(ringHole, 9.4, -0.45, 2.6); ringShape.holes.push(ringHole);
    const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: 1.2, bevelEnabled: false }), concreteMat);
    ring.position.z = -1.2; ring.castShadow = true;
    const inner = new THREE.Shape(); arch(inner, 9.2, -0.45, 2.6);
    const tube = new THREE.Mesh(new THREE.ExtrudeGeometry(inner, { depth: 60, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0x1b1f21, side: THREE.BackSide }));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x24282a }));
    floor.position.set(0, -0.43, 30);
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(inner), tunMat); cap.position.z = 59.5; cap.rotation.y = Math.PI; // the light at the end
    const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.12, 2.2), tunMat, 9);
    const tunDash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 2), dashMat, 14);
    for (let i = 0; i < 9; i++) { d.position.set(0, 7.1, 6 + i * 6); d.updateMatrix(); lamps.setMatrixAt(i, d.matrix); }
    for (let i = 0; i < 14; i++) { d.position.set(0, -0.4, 4 + i * 4); d.updateMatrix(); tunDash.setMatrixAt(i, d.matrix); }
    const portalLight = new THREE.PointLight(0xffd9a0, 0, 32); portalLight.position.set(0, 4, -5);
    tun.add(wall, ring, tube, floor, cap, lamps, tunDash, portalLight);
    scene.add(tun);

    // Distant peaks with snow caps.
    const peakMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
    const snowMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 });
    for (let i = 0; i < 7; i++) {
      const h = rnd(26, 42), r = rnd(14, 20), x = -66 + i * 22 + rnd(-5, 5);
      const p = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), peakMat);
      p.position.set(x, h / 2 - 2, -90);
      const cap2 = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, h * 0.3, 6), snowMat);
      cap2.position.set(x, h - h * 0.15 - 2, -90);
      scene.add(p, cap2);
    }

    // Pine forest: three foliage tiers plus trunk, with slight lean and colour variation. Casts shadows.
    const N = 340;
    const tiers = [new THREE.ConeGeometry(1.8, 4.2, 9).translate(0, 2.8, 0), new THREE.ConeGeometry(1.35, 3.4, 9).translate(0, 5, 0), new THREE.ConeGeometry(0.85, 2.6, 9).translate(0, 6.9, 0)];
    const trunkG = new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6).translate(0, 0.9, 0);
    const leafMat = new THREE.MeshStandardMaterial({ roughness: 0.95 }), trunkMat = new THREE.MeshStandardMaterial({ roughness: 1 });
    const trees = [...tiers.map((g) => new THREE.InstancedMesh(g, leafMat, N)), new THREE.InstancedMesh(trunkG, trunkMat, N)];
    const o = new THREE.Object3D(), tone = new THREE.Color();
    let placed = 0;
    while (placed < N) {
      const x = rnd(-58, 58), z = rnd(-60, 34), y = heightAt(x, z);
      if (Math.abs(x - river(z)) < 9 || y > 10) continue;
      o.position.set(x, y, z); o.scale.setScalar(rnd(0.7, 1.8)); o.rotation.set(rnd(-0.05, 0.05), rnd(0, 6.28), rnd(-0.05, 0.05)); o.updateMatrix();
      tone.setScalar(rnd(0.75, 1.2));
      trees.forEach((m, k) => { m.setMatrixAt(placed, o.matrix); if (k < 3) m.setColorAt(placed, tone); });
      placed++;
    }
    trees.forEach((m) => { m.castShadow = m.receiveShadow = true; scene.add(m); });

    // Boulders along the road.
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 90);
    for (let i = 0; i < 90; i++) {
      const z = rnd(-60, 34), x = river(z) + (Math.random() < 0.5 ? -1 : 1) * rnd(5.8, 15);
      o.position.set(x, heightAt(x, z) + 0.1, z); o.scale.set(rnd(0.4, 1.6), rnd(0.3, 1), rnd(0.4, 1.4)); o.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); o.updateMatrix();
      rocks.setMatrixAt(i, o.matrix);
    }
    rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);

    // Motorcycle.
    const bikeMat = new THREE.MeshLambertMaterial({ flatShading: true });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1b2024, flatShading: true });
    const bike = new THREE.Group(), wheels: THREE.Mesh[] = [];
    const part = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => { const m2 = new THREE.Mesh(g, m); m2.position.set(x, y, z); bike.add(m2); return m2; };
    [-0.85, 0.85].forEach((z) => wheels.push(part(new THREE.TorusGeometry(0.32, 0.08, 8, 18).rotateY(Math.PI / 2), darkMat, 0, 0.4, z)));
    part(new THREE.BoxGeometry(0.2, 0.25, 1.5), darkMat, 0, 0.6, 0);
    part(new THREE.BoxGeometry(0.32, 0.28, 0.5), bikeMat, 0, 0.86, -0.3);
    part(new THREE.BoxGeometry(0.3, 0.1, 0.8), darkMat, 0, 0.8, 0.35);
    part(new THREE.BoxGeometry(0.3, 0.05, 0.05), darkMat, 0, 1.08, -0.3);
    const stand = [part(new THREE.BoxGeometry(0.42, 0.62, 0.3), bikeMat, 0, 1.3, 0.2), part(new THREE.SphereGeometry(0.2, 12, 10), bikeMat, 0, 1.85, 0.05)]; // stand-in rider until the avatar loads
    stand[0].rotation.x = -0.3;
    part(new THREE.BoxGeometry(0.1, 0.1, 0.04), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 0, 0.85, 0.77);
    bike.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.castShadow = true; });
    bike.scale.setScalar(BIKE_SCALE);
    bike.rotation.order = "YXZ";
    const head = new THREE.SpotLight(0xfff2cc, 0, 45, 0.5, 0.6);
    head.position.set(0, 1, -0.9); head.target.position.set(0, 0, -12);
    bike.add(head, head.target);
    bike.position.set(river(30 - BEHIND), -0.45, 30 - BEHIND);
    scene.add(bike);

    let disposed = false;
    new GLTFLoader().load("/models/rider.glb", (gltf) => {
      if (disposed) return;
      const rider = gltf.scene;
      rider.traverse((n) => { n.frustumCulled = false; if ((n as THREE.Mesh).isMesh) n.castShadow = true; });
      rider.position.set(SEAT.x, SEAT.y, SEAT.z);
      rider.rotation.y = Math.PI;
      rider.scale.setScalar(SEAT.scale);
      bike.add(rider);
      poseRider(rider);
      stand.forEach((s) => { bike.remove(s); s.geometry.dispose(); });
    }, undefined, () => { /* keep the stand-in rider */ });

    // Sun / moon with halo.
    const sun = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 24), new THREE.MeshBasicMaterial({ fog: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 24), new THREE.MeshBasicMaterial({ fog: false, transparent: true, opacity: 0.18 }));
    sun.position.set(40, 34, -105); halo.position.copy(sun.position);
    scene.add(sun, halo);

    // Clouds.
    const cloudMat = new THREE.MeshBasicMaterial({ transparent: true, fog: false });
    const clouds: THREE.Group[] = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rnd(2.5, 4.5), 10, 8), cloudMat);
        s.position.set(k * 3 - 6, rnd(-1, 1), rnd(-1.5, 1.5)); s.scale.y = 0.55; g.add(s);
      }
      g.position.set(rnd(-80, 80), rnd(20, 30), rnd(-90, -30));
      clouds.push(g); scene.add(g);
    }

    // Birds (day only).
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

    // Stars (night); pollen by day, fireflies by night near the road.
    const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.5, color: 0xffffff, fog: false, map: dot(), alphaTest: 0.4, transparent: true }));
    const sa = new Float32Array(400 * 3);
    for (let i = 0; i < 400; i++) { sa[i * 3] = rnd(-130, 130); sa[i * 3 + 1] = rnd(30, 80); sa[i * 3 + 2] = -110; }
    stars.geometry.setAttribute("position", new THREE.BufferAttribute(sa, 3));
    const ma = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) { const mz = rnd(-60, 30); ma[i * 3] = river(mz) + rnd(-14, 14); ma[i * 3 + 1] = rnd(0.5, 6); ma[i * 3 + 2] = mz; }
    const motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.18, transparent: true, depthWrite: false, map: dot() }));
    motes.geometry.setAttribute("position", new THREE.BufferAttribute(ma, 3));
    scene.add(stars, motes);

    apply.current = (t) => {
      const p = PAL[t], night = t === "dark";
      skyMat.uniforms.top.value.setHex(p.top); skyMat.uniforms.bottom.value.setHex(p.horizon);
      (scene.fog as THREE.Fog).color.setHex(p.horizon);
      hemi.color.setHex(p.hemi[0]); hemi.groundColor.setHex(p.hemi[1]); hemi.intensity = p.hemi[2];
      dir.color.setHex(p.dir[0]); dir.intensity = p.dir[1];
      const c = tg.attributes.color as THREE.BufferAttribute, col = new THREE.Color();
      const lo = new THREE.Color(p.low), hi = new THREE.Color(p.high), sn = new THREE.Color(p.snow);
      for (let i = 0; i < tp.count; i++) {
        const y = tp.getY(i);
        col.copy(lo).lerp(hi, smooth((y - 2) / 7));
        if (y > 10) col.lerp(sn, smooth((y - 10) / 3));
        col.multiplyScalar(0.9 + jitter[i] * 0.2);
        c.setXYZ(i, col.r, col.g, col.b);
      }
      c.needsUpdate = true;
      leafMat.color.setHex(p.leaf); trunkMat.color.setHex(p.trunk);
      peakMat.color.setHex(p.peak); snowMat.color.setHex(p.snow);
      roadMat.color.setHex(p.road); gravelMat.color.setHex(p.gravel); rockMat.color.setHex(p.rock); concreteMat.color.setHex(p.concrete);
      edgeMat.color.setHex(night ? 0x9aa89f : 0xf0f3ee); dashMat.color.setHex(night ? 0xb9a860 : 0xe8c25a);
      postMat.color.setHex(night ? 0x8a968f : 0xdfe6df); bikeMat.color.setHex(night ? 0x52b788 : 0x2b5636); head.intensity = night ? 300 : 0;
      tunMat.color.setHex(p.tun); portalLight.intensity = night ? 140 : 0;
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
        // Scrolling rides the camera down the road towards the tunnel; the pointer adds parallax.
        const z = 30 - prog * RIDE, x = river(z) + mx * 3, y = 4.8 + prog * 1.5 - my;
        camera.position.x += (x - camera.position.x) * 0.05;
        camera.position.y += (y - camera.position.y) * 0.05;
        camera.position.z += (z - camera.position.z) * 0.06;
        const bz = camera.position.z - BEHIND;
        bike.position.set(river(bz), -0.45 + Math.sin(t * 28) * 0.004, bz);
        bike.rotation.set(0, Math.atan(dx(bz)), Math.sin(bz * 0.06) * 0.2 * flat(bz));
        wheels.forEach((w) => { w.rotation.x = camera.position.z * -1.4; });
        clouds.forEach((c) => { c.position.x += dt * 0.8; if (c.position.x > 95) c.position.x = -95; });
        flock.forEach((b) => {
          b.g.position.x += dt * b.sp; if (b.g.position.x > 80) b.g.position.x = -80;
          const f = Math.sin(t * 8 + b.ph) * 0.55; b.l.rotation.z = -f; b.r.rotation.z = f;
          b.g.position.y += Math.sin(t + b.ph) * 0.01;
        });
        motes.position.y = Math.sin(t * 0.5) * 0.6; motes.rotation.y = t * 0.02;
      }
      sky.position.copy(camera.position);
      dir.target.position.copy(bike.position); dir.position.copy(bike.position).add(lightOffset); // shadows follow the bike
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