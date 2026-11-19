import { memo, useEffect, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Theme } from "./hooks";
import { poseRider, SEAT } from "./riderPose";
import { buildPCX, PCX } from "./pcx";
import { loadRider } from "./rider";

const BIKE_SCALE = 2.3, BEHIND = 11.5; // bike size and how far ahead of the camera it rides
const RIDE = 78; // distance the camera travels down the road as you scroll (ends just before the tunnel)
const Z_TUNNEL = -66; // front face of the tunnel portal
// Performance levers. Phones and small screens get the lighter set.
const LOW = matchMedia("(max-width: 860px), (pointer: coarse)").matches;
const N = LOW ? 220 : 340; // pines
const N_BROAD = LOW ? 40 : 70; // round broadleaf trees on the valley floor
const N_GRASS = LOW ? 1200 : 2600; // grass clumps along the road
const SHADOW = LOW ? 1024 : 2048; // shadow map resolution
const MAX_DPR = LOW ? 1.5 : 1.75; // pixel ratio cap
const SUN_DIR = new THREE.Vector3(0.6, 0.28, -0.75).normalize(); // sun (day) / moon (night), ahead and to the right

const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
const flat = (z: number) => 1 - smooth((-z - 38) / 26); // the road straightens out before the tunnel
const river = (z: number) => Math.sin(z * 0.06) * 5 * flat(z); // road centre line (also carves the valley)
const dx = (z: number) => (river(z + 0.05) - river(z - 0.05)) / 0.1; // road heading

// Smooth value noise and fractal noise (0..1) for natural terrain, ridges and colour patches.
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x: number, z: number) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
const fbm = (x: number, z: number, oct = 4) => {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise(x * f, z * f); f *= 2.03; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct));
};
const heightAt = (x: number, z: number) => {
  const e = smooth((Math.abs(x - river(z)) - 7) / 22);
  const hills = 13 + (fbm(x * 0.03 + 7, z * 0.03) - 0.5) * 16 + (1 - Math.abs(2 * noise(x * 0.07, z * 0.07) - 1)) * 5;
  return e * hills + (fbm(x * 0.25, z * 0.25, 3) - 0.5) * (0.15 + e) - (1 - e) * 0.6;
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, srgb = true) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const dot = () => canvasTex(32, (g) => { g.fillStyle = "#fff"; g.beginPath(); g.arc(16, 16, 15, 0, 6.3); g.fill(); });
/** Soft radial blob used for cloud puffs and the tunnel glow. */
const puff = () => canvasTex(128, (g, s) => {
  for (let i = 0; i < 7; i++) {
    const x = s / 2 + rnd(-18, 18), y = s / 2 + rnd(-12, 12), r = rnd(30, 52);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
});
/** Per-pixel speckle (multiplies the base colour) for terrain, gravel and rock. */
function grain(lo: number, hi: number, repeat: [number, number], size = 256) {
  const t = canvasTex(size, (g, s) => {
    const img = g.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const x = i % s, y = (i / s) | 0;
      const v = lo + (hi - lo) * (0.55 * Math.random() + 0.45 * fbm(x * 0.06, y * 0.06, 3));
      img.data.set([v, v, v, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  return t;
}
/** Asphalt: fine aggregate, darker wheel tracks and a few hairline cracks. */
function asphalt() {
  const t = canvasTex(512, (g, s) => {
    const img = g.createImageData(s, s);
    for (let i = 0; i < s * s; i++) {
      const x = i % s, y = (i / s) | 0, u = x / s;
      const track = Math.exp(-(((u - 0.3) / 0.07) ** 2)) + Math.exp(-(((u - 0.7) / 0.07) ** 2));
      const v = 88 + (Math.random() - 0.5) * 38 + (noise(x * 0.05, y * 0.02) - 0.5) * 22 - track * 12;
      img.data.set([v, v, v + 3, 255], i * 4);
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = "rgba(25,25,28,0.55)"; g.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      let x = rnd(0, s), y = rnd(0, s); g.beginPath(); g.moveTo(x, y);
      for (let j = 0; j < 14; j++) { x += rnd(-9, 9); y += rnd(4, 12); g.lineTo(x, y); }
      g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 36);
  return t;
}
/** Tunnel profile: straight sides with a round top. */
function arch(s: THREE.Path, w: number, yb: number, ys: number) {
  s.moveTo(-w / 2, yb); s.lineTo(-w / 2, ys); s.absarc(0, ys, w / 2, Math.PI, 0, true); s.lineTo(w / 2, yb); s.closePath();
}
/** Adds a per-vertex brightness attribute so tree crowns are darker inside and lighter at the tips. */
function shade(g: THREE.BufferGeometry, f: (y: number, r: number) => number) {
  const p = g.attributes.position as THREE.BufferAttribute, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) c.fill(f(p.getY(i), Math.hypot(p.getX(i), p.getZ(i))), i * 3, i * 3 + 3);
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return g;
}
/** Pine: five drooping tiers with jagged brims, merged into one geometry. */
function pineGeo() {
  const parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 5; k++) {
    const t = k / 4, r = 1.9 - t * 1.35, h = 2.6 - t * 0.9, base = 2 + k * 1.25;
    const g = new THREE.ConeGeometry(r, h, 9, 1).translate(0, base + h / 2, 0);
    g.deleteAttribute("uv");
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z);
      if (d < 0.01) continue;
      const jag = 1 + 0.18 * Math.sin(Math.atan2(z, x) * 9 + k * 1.7);
      p.setXYZ(i, x * jag, p.getY(i) - 0.28 * jag, z * jag);
    }
    g.computeVertexNormals();
    parts.push(shade(g, (y, d) => (d < 0.01 ? 1.15 : 0.62 + 0.1 * t) + (y - base) / h * 0.35));
  }
  return mergeGeometries(parts)!;
}
/** Broadleaf crown: three lumpy spheres. */
function broadGeo() {
  const parts = ([[0, 3.7, 0, 1.6], [0.9, 3.1, 0.4, 1.15], [-0.75, 3.3, -0.5, 1.2]] as const).map(([x, y, z, r]) => {
    const g0 = new THREE.IcosahedronGeometry(r, 1); g0.deleteAttribute("uv"); g0.deleteAttribute("normal"); // detail 1: a quarter of the triangles, still smooth once displaced
    const g = mergeVertices(g0), p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i), k = 0.82 + 0.36 * noise(v.x * 1.7 + v.y * 2.1 + 9, v.z * 1.7 - v.y);
      p.setXYZ(i, v.x * k + x, v.y * k + y, v.z * k + z);
    }
    g.computeVertexNormals();
    return shade(g, (yy) => 0.6 + smooth((yy - 2) / 3.2) * 0.55);
  });
  return mergeGeometries(parts)!;
}
/** Grass clump: five thin blades, dark at the root and bright at the tip, with upward normals so it lights like the ground. */
function grassGeo() {
  const pos: number[] = [], col: number[] = [];
  for (let b = 0; b < 5; b++) {
    const a = (b / 5) * Math.PI * 2 + rnd(-0.3, 0.3), w = 0.05, h = rnd(0.32, 0.55), lean = rnd(0.08, 0.2);
    const cx = Math.cos(a) * 0.05, cz = Math.sin(a) * 0.05, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + Math.cos(a) * lean, h, cz + Math.sin(a) * lean);
    col.push(0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 1.05, 1.05, 1.05);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}
/** Gentle wind sway for instanced foliage. Each tree gets its own phase from its position. */
function sway(m: THREE.Material, wind: { value: number }, amp: number, base: number) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind;
    sh.vertexShader = "uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float sw = sin(uTime * 1.4 + ip.x * 0.35 + ip.z * 0.25) + 0.4 * sin(uTime * 2.3 + ip.z * 0.5);
      transformed.x += sw * ${amp.toFixed(4)} * max(transformed.y - ${base.toFixed(2)}, 0.0);`);
  };
  m.customProgramCacheKey = () => `sway${amp}_${base}`;
}
/** Distant ridge line. Heights are kept so colours can be recomputed per theme. */
function ridgeGeo(width: number, depth: number, hMax: number, seed: number) {
  const g = new THREE.PlaneGeometry(width, depth, LOW ? 140 : 220, 26);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), back = (depth / 2 - z) / depth;
    const crest = 1 - Math.abs(2 * noise(x * 0.018 + seed, seed * 3) - 1);
    const h = hMax * (0.3 + 0.7 * (0.6 * fbm(x * 0.009 + seed, 1.3 + seed, 5) + 0.4 * crest)) * smooth(back * 1.7);
    p.setY(i, h + (fbm(x * 0.08 + seed, z * 0.08, 3) - 0.5) * 4 * smooth(back * 3));
  }
  g.computeVertexNormals();
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(p.count * 3), 3));
  return g;
}

const PAL = {
  light: {
    top: 0x4f8fcf, horizon: 0xd8e5ea, sunCol: 0xfff0cc, glow: 1, sunSize: 0.00022,
    grassA: 0x4b7a37, grassB: 0x6c8d43, dry: 0x8b875a, rockT: 0x7c7a73, snow: 0xf4f7f8,
    ridge: 0x5f6f6c, ridgeSnow: 0xeef3f6, pine: 0x2b5a3c, broad: 0x46733a, trunk: 0x4a3828, blade: 0x5f8b3f,
    road: 0xffffff, gravel: 0xcfc8b8, rock: 0xc9c5bc, boulder: 0x76736c, concrete: 0xc4c8c6,
    cloud: 0xffffff, cloudA: 0.85, mote: 0xffffff, tun: 0xfff1c9, paint: 0xf4f5f2,
    hemi: [0xdfefff, 0x4f6a45, 0.55], dir: [0xfff1d9, 1.6], env: 0.6, exposure: 1.1,
  },
  dark: {
    top: 0x050b12, horizon: 0x121c24, sunCol: 0xbcd0ff, glow: 0.35, sunSize: 0.00015,
    grassA: 0x1a3324, grassB: 0x22392a, dry: 0x2c3428, rockT: 0x3a4046, snow: 0x8a9cab,
    ridge: 0x18242c, ridgeSnow: 0x6f8291, pine: 0x12301f, broad: 0x173422, trunk: 0x241c15, blade: 0x1f3a26,
    road: 0x59636a, gravel: 0x6a6a64, rock: 0x586068, boulder: 0x50565c, concrete: 0x6c7070,
    cloud: 0x2c3a46, cloudA: 0.4, mote: 0xe8ff9a, tun: 0xffe08a, paint: 0xeef1f2,
    hemi: [0x7f96c4, 0x16241c, 1.1], dir: [0xa9bfff, 0.9], env: 0.6, exposure: 1.3,
  },
} as const;

/** `paused` skips drawing while something covers the whole scene (the welcome screen). */
export default memo(function Background({ theme, paused = false }: { theme: Theme; paused?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const apply = useRef<(t: Theme) => void>(() => {});
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    const el = host.current!;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // MSAA is skipped on high-density screens: the extra pixels already smooth edges, and it is costly on phones.
    const renderer = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 1.5, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_DPR));
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false; // redrawn only when the bike moves (see tick)
    let dirty = true, shadowDirty = true; // dirty: something changed that a still scene must redraw
    el.appendChild(renderer.domElement);
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 28, 140);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
    const hemi = new THREE.HemisphereLight();
    const dir = new THREE.DirectionalLight();
    dir.castShadow = true; dir.shadow.mapSize.set(SHADOW, SHADOW); dir.shadow.bias = -0.0004; dir.shadow.normalBias = 0.03;
    Object.assign(dir.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 });
    dir.shadow.camera.updateProjectionMatrix();
    const lightOffset = SUN_DIR.clone().multiplyScalar(60);
    scene.add(hemi, dir, dir.target);
    const wind = { value: 0 };

    // Sky dome: horizon haze to zenith, with the sun (or moon) disc and its glow. Follows the camera.
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sunColor: { value: new THREE.Color() },
        sunDir: { value: SUN_DIR }, sunSize: { value: 0.0002 }, glow: { value: 1 },
      },
      vertexShader: `varying vec3 vDir;
      void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top;
      uniform vec3 bottom;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      uniform float sunSize;
      uniform float glow;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(bottom, top, pow(clamp(h, 0.0, 1.0), 0.5));
        col = mix(col, bottom * 0.9, smoothstep(0.0, -0.3, h));
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(s, 6.0) * 0.18 + pow(s, 48.0) * 0.35) * glow;
        col = mix(col, sunColor * 1.6, smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.55, s));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    });
    const skyGeo = new THREE.SphereGeometry(190, 32, 20);
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);
    // Image-based lighting from the same sky, so metal, paint and foliage pick up its colour.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(skyGeo, skyMat));
    let envRT: THREE.WebGLRenderTarget | null = null;

    // Terrain: smooth valley with fractal hills; coloured by height, slope and soft colour patches.
    const SEG = LOW ? 130 : 180;
    const tg = new THREE.PlaneGeometry(120, 120, SEG, SEG);
    tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) tp.setY(i, heightAt(tp.getX(i), tp.getZ(i) - 20));
    tg.computeVertexNormals();
    const tn = tg.attributes.normal as THREE.BufferAttribute;
    tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(tp.count * 3), 3));
    const patch = Float32Array.from({ length: tp.count }, (_, i) => fbm(tp.getX(i) * 0.08, tp.getZ(i) * 0.08, 3));
    const jitter = Float32Array.from({ length: tp.count }, Math.random);
    const groundTex = grain(170, 255, [40, 40]); groundTex.anisotropy = aniso;
    const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: groundTex, bumpMap: groundTex, bumpScale: 0.5 });
    const ground = new THREE.Mesh(tg, groundMat);
    ground.position.z = -20; ground.receiveShadow = true;
    scene.add(ground);

    // Road: textured asphalt, gravel shoulder, edge lines, dashed centre line, posts with reflectors.
    const roadTex = asphalt(); roadTex.anisotropy = aniso;
    const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, bumpMap: roadTex, bumpScale: 0.4, roughness: 0.9 });
    const gravelTex = grain(110, 255, [2, 40]); gravelTex.anisotropy = aniso;
    const gravelMat = new THREE.MeshStandardMaterial({ map: gravelTex, bumpMap: gravelTex, bumpScale: 1, roughness: 1 });
    const edgeMat = new THREE.MeshStandardMaterial({ roughness: 0.6 }), dashMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const postMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
    const reflMat = new THREE.MeshStandardMaterial({ color: 0xff9a2e, emissive: 0xff8a1a, emissiveIntensity: 0, roughness: 0.3 });
    const ribbon = (w: number, off: number, y: number, mat: THREE.Material, shadow = false) => {
      const g = new THREE.PlaneGeometry(w, 120, 1, 120);
      g.rotateX(-Math.PI / 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) + off + river(p.getZ(i) - 20)); p.setY(i, y); }
      const m = new THREE.Mesh(g, mat); m.position.z = -20; m.receiveShadow = shadow; return m;
    };
    scene.add(ribbon(9.8, 0, -0.5, gravelMat, true), ribbon(7, 0, -0.45, roadMat, true), ribbon(0.14, -3.1, -0.43, edgeMat, true), ribbon(0.14, 3.1, -0.43, edgeMat, true));
    const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 2), dashMat, 26);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 8), postMat, 42);
    const refl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.12, 0.03), reflMat, 42);
    const d = new THREE.Object3D();
    for (let i = 0; i < 26; i++) { const z = 36 - i * 4; d.position.set(river(z), -0.42, z); d.rotation.set(0, Math.atan(dx(z)), 0); d.updateMatrix(); dashes.setMatrixAt(i, d.matrix); }
    d.rotation.set(0, 0, 0);
    for (let i = 0; i < 42; i++) {
      const z = 38 - (i >> 1) * 5, x = river(z) + (i & 1 ? 4 : -4);
      d.position.set(x, -0.15, z); d.updateMatrix(); posts.setMatrixAt(i, d.matrix);
      d.position.set(x, 0.18, z + 0.07); d.updateMatrix(); refl.setMatrixAt(i, d.matrix);
    }
    posts.castShadow = true;
    scene.add(dashes, posts, refl);

    // Tunnel at the end of the road: rock face with a round portal, concrete frame, dark tube, light at the far end.
    const rockTex = grain(130, 255, [0.07, 0.07]);
    const rockMat = new THREE.MeshStandardMaterial({ map: rockTex, bumpMap: rockTex, bumpScale: 2, roughness: 1, side: THREE.DoubleSide });
    const concreteMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const tunMat = new THREE.MeshBasicMaterial({ fog: false });
    const tun = new THREE.Group();
    tun.position.set(0, 0, Z_TUNNEL); tun.rotation.y = Math.PI; // local +z runs into the mountain
    const face = new THREE.Shape();
    face.moveTo(-70, -3);
    for (let x = -70; x <= 70; x += 3.5) face.lineTo(x, 9 + 15 * Math.exp(-((x / 34) ** 2)) + (fbm(x * 0.06, 4.2) - 0.5) * 9 + Math.abs(x) * 0.04);
    face.lineTo(70, -3); face.closePath();
    const hole = new THREE.Path(); arch(hole, 9.4, -0.45, 2.6); face.holes.push(hole);
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(face, { depth: 10, bevelEnabled: false }), rockMat);
    wall.receiveShadow = true; wall.castShadow = true;
    const ringShape = new THREE.Shape(); arch(ringShape, 11.6, -3, 2.6);
    const ringHole = new THREE.Path(); arch(ringHole, 9.4, -0.45, 2.6); ringShape.holes.push(ringHole);
    const ring = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: 1.2, bevelEnabled: false }), concreteMat);
    ring.position.z = -1.2; ring.castShadow = true; ring.receiveShadow = true;
    const inner = new THREE.Shape(); arch(inner, 9.2, -0.45, 2.6);
    const tube = new THREE.Mesh(new THREE.ExtrudeGeometry(inner, { depth: 60, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0x1b1f21, side: THREE.BackSide }));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x24282a }));
    floor.position.set(0, -0.43, 30);
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(inner), tunMat); cap.position.z = 59.5; cap.rotation.y = Math.PI; // the light at the end
    const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.12, 2.2), tunMat, 9);
    const tunDash = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.02, 2), new THREE.MeshBasicMaterial({ color: 0x6b5a2a }), 14);
    for (let i = 0; i < 9; i++) { d.position.set(0, 7.1, 6 + i * 6); d.updateMatrix(); lamps.setMatrixAt(i, d.matrix); }
    for (let i = 0; i < 14; i++) { d.position.set(0, -0.4, 4 + i * 4); d.updateMatrix(); tunDash.setMatrixAt(i, d.matrix); }
    const portalLight = new THREE.PointLight(0xffd9a0, 0, 32); portalLight.position.set(0, 4, -5);
    tun.add(wall, ring, tube, floor, cap, lamps, tunDash, portalLight);
    scene.add(tun);
    const glowMat = new THREE.SpriteMaterial({ map: puff(), color: 0xffc977, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const portalGlow = new THREE.Sprite(glowMat); // warm glow around the entrance at night
    portalGlow.position.set(0, 3.4, Z_TUNNEL + 0.8); portalGlow.scale.set(20, 13, 1);
    scene.add(portalGlow);

    // Distant ridges in two layers; colours are pre-hazed toward the horizon for depth.
    // Each layer adds some horizon colour as emissive light, so the backlit far side still reads as haze.
    const ridges = [ridgeGeo(560, 50, 48, 3.1), ridgeGeo(660, 60, 72, 8.4)].map((g, k) => {
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, fog: false });
      const m = new THREE.Mesh(g, mat); m.position.z = k ? -165 : -110; scene.add(m);
      return { g, mat, hMax: k ? 72 : 48, haze: k ? 0.62 : 0.38 };
    });

    // Forest: drooping pines plus a few broadleaf trees lower down, with lean, size and colour variation. Sways in the wind.
    const pineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    const broadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const trunkMat = new THREE.MeshStandardMaterial({ roughness: 1 });
    sway(pineMat, wind, 0.006, 1.5); sway(broadMat, wind, 0.01, 2);
    const pines = new THREE.InstancedMesh(pineGeo(), pineMat, N);
    const broads = new THREE.InstancedMesh(broadGeo(), broadMat, N_BROAD);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.3, 2.6, 7).translate(0, 1.3, 0), trunkMat, N + N_BROAD);
    const o = new THREE.Object3D(), tone = new THREE.Color();
    const plant = (m: THREE.InstancedMesh, count: number, ok: (x: number, z: number, y: number) => boolean, size: [number, number], hue: () => void, offset: number) => {
      let placed = 0;
      while (placed < count) {
        const x = rnd(-58, 58), z = rnd(-60, 34), y = heightAt(x, z);
        if (Math.abs(x - river(z)) < 9 || !ok(x, z, y)) continue;
        o.position.set(x, y - 0.15, z); o.scale.setScalar(rnd(...size)); o.rotation.set(rnd(-0.05, 0.05), rnd(0, 6.28), rnd(-0.05, 0.05)); o.updateMatrix();
        hue(); m.setMatrixAt(placed, o.matrix); m.setColorAt(placed, tone); trunks.setMatrixAt(offset + placed, o.matrix);
        placed++;
      }
    };
    plant(pines, N, (_x, _z, y) => y < 10.5, [0.7, 1.8], () => tone.setRGB(rnd(0.8, 1.15), rnd(0.85, 1.2), rnd(0.8, 1.1)), 0);
    plant(broads, N_BROAD, (_x, _z, y) => y < 4, [0.8, 1.3], () => tone.setRGB(rnd(0.85, 1.25), rnd(0.9, 1.2), rnd(0.7, 1)), N);
    [pines, broads, trunks].forEach((m) => { m.castShadow = m.receiveShadow = true; scene.add(m); });

    // Grass clumps along both sides of the road.
    const bladeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
    sway(bladeMat, wind, 0.22, 0);
    const grass = new THREE.InstancedMesh(grassGeo(), bladeMat, N_GRASS);
    for (let i = 0; i < N_GRASS; i++) {
      let x = 0, z = 0, y = 99;
      while (y > 7) { z = rnd(-62, 38); x = river(z) + (Math.random() < 0.5 ? -1 : 1) * (5.3 + Math.pow(Math.random(), 1.6) * 22); y = heightAt(x, z); }
      o.position.set(x, y - 0.05, z); o.rotation.set(0, rnd(0, 6.28), 0); o.scale.setScalar(rnd(0.7, 1.5)); o.updateMatrix();
      grass.setMatrixAt(i, o.matrix); grass.setColorAt(i, tone.setScalar(rnd(0.75, 1.25)));
    }
    grass.receiveShadow = true; scene.add(grass);

    // Boulders along the road, plus large rock masses that break up the tunnel face.
    const bg0 = new THREE.IcosahedronGeometry(1, 1); bg0.deleteAttribute("uv"); bg0.deleteAttribute("normal");
    const boulderG = mergeVertices(bg0), bp = boulderG.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(bp, i), k = 0.75 + 0.5 * fbm(v.x * 1.3 + v.y + 4, v.z * 1.3 - v.y, 3);
      bp.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    boulderG.computeVertexNormals();
    const boulderMat = new THREE.MeshStandardMaterial({ roughness: 0.95 });
    const rocks = new THREE.InstancedMesh(boulderG, boulderMat, 104);
    for (let i = 0; i < 104; i++) {
      if (i < 90) {
        const z = rnd(-60, 34), x = river(z) + (Math.random() < 0.5 ? -1 : 1) * rnd(5.8, 15);
        o.position.set(x, heightAt(x, z) + 0.05, z); o.scale.set(rnd(0.4, 1.6), rnd(0.3, 1), rnd(0.4, 1.4));
      } else {
        const x = (Math.random() < 0.5 ? -1 : 1) * rnd(9, 55);
        o.position.set(x, rnd(-1, 10), Z_TUNNEL + rnd(0.5, 2.5)); o.scale.set(rnd(3, 6), rnd(2.5, 5), rnd(1.5, 3));
      }
      o.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); o.updateMatrix();
      rocks.setMatrixAt(i, o.matrix); rocks.setColorAt(i, tone.setScalar(rnd(0.8, 1.15)));
    }
    rocks.castShadow = rocks.receiveShadow = true; scene.add(rocks);

    // Scooter in the style of a Honda PCX 160, built at real size and scaled to match the avatar (see pcx.ts).
    const pcx = buildPCX();
    pcx.group.scale.setScalar(SEAT.scale);
    const bike = new THREE.Group(), wheels = pcx.wheels, stand = pcx.standIn;
    bike.add(pcx.group);
    bike.scale.setScalar(BIKE_SCALE);
    bike.rotation.order = "YXZ";
    const beam = new THREE.SpotLight(0xf2f6ff, 0, 45, 0.5, 0.6);
    beam.position.copy(pcx.beam).multiplyScalar(SEAT.scale); beam.target.position.set(0, 0, -12);
    bike.add(beam, beam.target);
    bike.position.set(river(30 - BEHIND), -0.45, 30 - BEHIND);
    scene.add(bike);

    let disposed = false;
    loadRider().then((rider) => {
      if (disposed) return;
      rider.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.castShadow = true; });
      rider.position.set(SEAT.x, SEAT.y, SEAT.z);
      rider.rotation.y = Math.PI;
      rider.scale.setScalar(SEAT.scale);
      bike.add(rider);
      poseRider(rider);
      rider.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; }); // the pose never changes; only the bike moves it
      stand.forEach((s) => { s.removeFromParent(); s.geometry.dispose(); });
      dirty = shadowDirty = true;
    }, () => { /* keep the stand-in rider */ });

    // Clouds: soft puffs. Each cloud's puffs are merged into one mesh (one draw call per cloud instead of seven sprites);
    // the camera always looks roughly down -z, so flat quads facing the viewer read the same as sprites.
    const cloudMat = new THREE.MeshBasicMaterial({ map: puff(), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const clouds: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const quads = Array.from({ length: 7 }, (_, k) => { const w = rnd(9, 17); return new THREE.PlaneGeometry(w, w * 0.55).translate(k * 3.2 - 10 + rnd(-1, 1), rnd(-1.2, 1.5), rnd(-2, 2)); });
      const c = new THREE.Mesh(mergeGeometries(quads)!, cloudMat); quads.forEach((q) => q.dispose());
      c.position.set(rnd(-90, 90), rnd(22, 34), rnd(-100, -35)); c.renderOrder = 1;
      clouds.push(c); scene.add(c);
    }

    // Birds (day only).
    const wingG = new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1.3, 0.1, -0.5, 1.1, 0, 0.6]), 3));
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x1d2a21, side: THREE.DoubleSide, fog: false });
    // All 18 wings are one instanced mesh (one draw call); each frame writes the wing matrices.
    const birds = new THREE.InstancedMesh(wingG, birdMat, 18);
    birds.frustumCulled = false;
    const flock = Array.from({ length: 9 }, () => ({ p: new THREE.Vector3(rnd(-70, 70), rnd(14, 22), rnd(-45, -8)), ph: rnd(0, 6), sp: rnd(2, 4) }));
    const wing = new THREE.Object3D();
    const flap = (t: number) => flock.forEach((b, i) => {
      const f = Math.sin(t * 8 + b.ph) * 0.55;
      [-1, 1].forEach((side, k) => { // left wing is the right wing mirrored in x
        wing.position.copy(b.p); wing.rotation.set(0, 0, side * f); wing.scale.set(side * 0.8, 0.8, 0.8); wing.updateMatrix();
        birds.setMatrixAt(i * 2 + k, wing.matrix);
      });
      birds.instanceMatrix.needsUpdate = true;
    });
    flap(0);
    scene.add(birds);

    // Stars (night) sit on a sphere around the camera and draw right after the sky, so mountains cover them.
    const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.6, color: 0xffffff, fog: false, map: dot(), alphaTest: 0.4, depthWrite: false }));
    const sa = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const az = rnd(0, Math.PI * 2), el2 = Math.asin(rnd(0.05, 0.98));
      sa.set([Math.cos(el2) * Math.cos(az) * 170, Math.sin(el2) * 170, Math.cos(el2) * Math.sin(az) * 170], i * 3);
    }
    stars.geometry.setAttribute("position", new THREE.BufferAttribute(sa, 3));
    stars.renderOrder = -0.9; stars.frustumCulled = false;
    // Pollen by day, fireflies by night near the road.
    const ma = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) { const mz = rnd(-60, 30); ma[i * 3] = river(mz) + rnd(-14, 14); ma[i * 3 + 1] = rnd(0.5, 6); ma[i * 3 + 2] = mz; }
    const motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.18, transparent: true, depthWrite: false, map: dot() }));
    motes.geometry.setAttribute("position", new THREE.BufferAttribute(ma, 3));
    scene.add(stars, motes);

    const standard = [groundMat, roadMat, gravelMat, edgeMat, dashMat, postMat, reflMat, rockMat, concreteMat, ...ridges.map((r) => r.mat), pineMat, broadMat, trunkMat, bladeMat, boulderMat, ...pcx.materials];
    apply.current = (t) => {
      const p = PAL[t], night = t === "dark";
      renderer.toneMappingExposure = p.exposure;
      const u = skyMat.uniforms;
      u.top.value.setHex(p.top); u.bottom.value.setHex(p.horizon); u.sunColor.value.setHex(p.sunCol); u.glow.value = p.glow; u.sunSize.value = p.sunSize;
      envRT?.dispose(); envRT = pmrem.fromScene(envScene, 0.04, 0.1, 1000); scene.environment = envRT.texture;
      standard.forEach((m) => { m.envMapIntensity = p.env; });
      (scene.fog as THREE.Fog).color.setHex(p.horizon);
      hemi.color.setHex(p.hemi[0]); hemi.groundColor.setHex(p.hemi[1]); hemi.intensity = p.hemi[2];
      dir.color.setHex(p.dir[0]); dir.intensity = p.dir[1];
      const col = new THREE.Color(), gA = new THREE.Color(p.grassA), gB = new THREE.Color(p.grassB), dry = new THREE.Color(p.dry), rk = new THREE.Color(p.rockT), sn = new THREE.Color(p.snow);
      const c = tg.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < tp.count; i++) {
        const y = tp.getY(i), ny = tn.getY(i);
        col.copy(gA).lerp(gB, patch[i]).lerp(dry, smooth((y - 3) / 6) * 0.55);
        col.lerp(rk, Math.max(smooth((0.86 - ny) / 0.16), smooth((y - 9) / 5) * 0.7));
        col.lerp(sn, smooth((y - 14) / 3) * smooth((ny - 0.55) / 0.2));
        col.multiplyScalar(0.92 + jitter[i] * 0.16);
        c.setXYZ(i, col.r, col.g, col.b);
      }
      c.needsUpdate = true;
      const hz = new THREE.Color(p.horizon), rc = new THREE.Color(p.ridge), rs = new THREE.Color(p.ridgeSnow);
      ridges.forEach(({ g, mat, hMax, haze }) => {
        mat.emissive.setHex(p.horizon); mat.emissiveIntensity = haze * 0.55;
        const pp = g.attributes.position as THREE.BufferAttribute, nn = g.attributes.normal as THREE.BufferAttribute, cc = g.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < pp.count; i++) {
          col.copy(rc).lerp(rs, smooth((pp.getY(i) / hMax - 0.55) / 0.15) * smooth((nn.getY(i) - 0.45) / 0.25)).lerp(hz, haze);
          cc.setXYZ(i, col.r, col.g, col.b);
        }
        cc.needsUpdate = true;
      });
      pineMat.color.setHex(p.pine); broadMat.color.setHex(p.broad); trunkMat.color.setHex(p.trunk); bladeMat.color.setHex(p.blade);
      roadMat.color.setHex(p.road); gravelMat.color.setHex(p.gravel); rockMat.color.setHex(p.rock); boulderMat.color.setHex(p.boulder); concreteMat.color.setHex(p.concrete);
      edgeMat.color.setHex(night ? 0x9aa89f : 0xf0f3ee); dashMat.color.setHex(night ? 0xb9a860 : 0xe8c25a);
      postMat.color.setHex(night ? 0x8a968f : 0xdfe6df); reflMat.emissiveIntensity = night ? 1.2 : 0;
      pcx.paint.color.setHex(p.paint); pcx.lamp.emissiveIntensity = night ? 3 : 0.4; pcx.tail.emissiveIntensity = night ? 2.5 : 0.8; beam.intensity = night ? 300 : 0;
      tunMat.color.setHex(p.tun); portalLight.intensity = night ? 140 : 0; portalGlow.visible = night;
      cloudMat.color.setHex(p.cloud); cloudMat.opacity = p.cloudA;
      const mm = motes.material as THREE.PointsMaterial;
      mm.color.setHex(p.mote); mm.opacity = night ? 0.95 : 0.5; mm.size = night ? 0.3 : 0.15;
      mm.blending = night ? THREE.AdditiveBlending : THREE.NormalBlending; mm.needsUpdate = true;
      stars.visible = night; birds.visible = !night;
      dirty = shadowDirty = true;
    };
    apply.current(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

    // Most of the scene never moves: compute those matrices once instead of every frame.
    scene.traverse((o) => { o.updateMatrix(); o.matrixAutoUpdate = false; });
    [bike, sky, stars, motes, birds, dir, dir.target, ...clouds].forEach((root) => root.traverse((o) => { o.matrixAutoUpdate = true; }));

    const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); dirty = true; };
    resize(); addEventListener("resize", resize);

    let mx = 0, my = 0, prog = 0, raf = 0;
    const onMove = (e: PointerEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    const onScroll = () => { prog = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight); };
    addEventListener("pointermove", onMove); addEventListener("scroll", onScroll, { passive: true });
    camera.position.set(river(30), 4.8, 30);
    const clock = new THREE.Clock();
    // Adaptive resolution: if frames stay slow, step the pixel ratio down (never below 1).
    let dpr = Math.min(devicePixelRatio, MAX_DPR), slow = 0, frames = 0;
    const lastShadow = new THREE.Vector3(Infinity, 0, 0);

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = clock.getDelta(), t = clock.elapsedTime;
      if (pausedRef.current && !dirty) return; // hidden behind the welcome screen; the first frame still compiles everything
      if (!reduce) {
        // Scrolling rides the camera down the road towards the tunnel; the pointer adds parallax.
        const z = 30 - prog * RIDE, x = river(z) + mx * 3, y = 4.8 + prog * 1.5 - my;
        camera.position.x += (x - camera.position.x) * 0.05;
        camera.position.y += (y - camera.position.y) * 0.05;
        camera.position.z += (z - camera.position.z) * 0.06;
        const bz = camera.position.z - BEHIND;
        bike.position.set(river(bz), -0.45 + Math.sin(t * 28) * 0.004, bz);
        bike.rotation.set(0, Math.atan(dx(bz)), Math.sin(bz * 0.06) * 0.2 * flat(bz));
        wheels.forEach((w) => { w.rotation.x = bz / (PCX.wheelR * SEAT.scale * BIKE_SCALE); }); // rolls forward without slipping
        wind.value = t;
        clouds.forEach((c) => { c.position.x += dt * 0.8; if (c.position.x > 105) c.position.x = -105; });
        if (birds.visible) { // hidden at night, so no work then
          flock.forEach((b) => { b.p.x += dt * b.sp; if (b.p.x > 80) b.p.x = -80; b.p.y += Math.sin(t + b.ph) * 0.01; });
          flap(t);
        }
        motes.position.y = Math.sin(t * 0.5) * 0.6; motes.rotation.y = t * 0.02;
      }
      sky.position.copy(camera.position); stars.position.copy(camera.position);
      dir.target.position.copy(bike.position); dir.position.copy(bike.position).add(lightOffset); // shadows follow the bike
      camera.lookAt(bike.position.x, 2.5, bike.position.z - 12);
      if (bike.position.distanceToSquared(lastShadow) > 0.0009 || shadowDirty) { renderer.shadowMap.needsUpdate = true; lastShadow.copy(bike.position); shadowDirty = false; }
      if (reduce && !dirty) return; // still scene: draw only when something changed
      dirty = false;
      renderer.render(scene, camera);
      if (!reduce && dt < 0.25 && dpr > 1) {
        slow += dt > 1 / 45 ? 1 : 0;
        if (++frames === 90) { if (slow > 45) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); } frames = slow = 0; }
      }
    };
    onScroll(); tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize); removeEventListener("pointermove", onMove); removeEventListener("scroll", onScroll);
      scene.environment = null;
      [scene, envScene].forEach((root) => root.traverse((n) => {
        const m = n as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
          Object.values(x).forEach((v) => { const tx = v as THREE.Texture | null; if (tx?.isTexture) tx.dispose(); });
          x.dispose();
        });
        (n as THREE.SkinnedMesh).skeleton?.dispose();
      }));
      envRT?.dispose(); pmrem.dispose();
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
});
