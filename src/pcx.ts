import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Procedural scooter in the style of a Honda PCX 160, built in metres (forward is -z, ground at y = 0).
 * Real proportions: 1,936 mm long, 1,313 mm wheelbase, 764 mm seat height, 110/70-14 front and 130/70-13 rear tyres.
 * Scale the returned group by the avatar's scale so the rider and scooter share units.
 */
export const PCX = {
  wheelR: 0.255,
  axleF: -0.656, axleR: 0.656,
  seatTop: 0.764, // rider part of the seat
  floorTop: 0.33,
  grip: new THREE.Vector3(0.3, 1.02, -0.48), // right grip centre; the left one is mirrored in x
};

type Pt = [number, number]; // (z, y) side-profile point
const smooth = (t: number) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };

/** Body panel: a side profile extruded across the width with rounded edges, narrowed by `taper(z, y)` so it reads as a moulded shell, not a slab. */
function panel(pts: Pt[], width: number, bevel: number, taper: (z: number, y: number) => number) {
  const depth = width - 2 * bevel;
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6,
  });
  g.rotateY(-Math.PI / 2).translate(depth / 2, 0, 0); // profile x -> world z, extrusion -> world x, centred
  const p = g.attributes.position as THREE.BufferAttribute, n = g.attributes.normal as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const t = taper(p.getZ(i), p.getY(i));
    p.setX(i, p.getX(i) * t);
    v.fromBufferAttribute(n, i).setX(n.getX(i) / t).normalize(); n.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/**
 * Draw-call reduction: bakes every direct child mesh of `parent` (except `keep`) into one mesh per material.
 * The scooter is ~80 small parts; merged it is a dozen meshes, each drawn once for colour and once for shadows.
 */
function mergeByMaterial(parent: THREE.Object3D, keep: Set<THREE.Object3D> = new Set()) {
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const o of [...parent.children]) {
    const m = o as THREE.Mesh;
    if (keep.has(o) || !m.isMesh || Array.isArray(m.material)) continue;
    m.updateMatrix();
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrix);
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    groups.set(m.material, [...(groups.get(m.material) ?? []), g]);
    m.removeFromParent(); m.geometry.dispose();
  }
  for (const [mat, list] of groups) {
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (!merged) throw new Error("pcx: parts with mismatched attributes cannot be merged");
    const mesh = new THREE.Mesh(merged, mat); mesh.castShadow = true; parent.add(mesh);
  }
}

export interface Scooter {
  group: THREE.Group;
  wheels: THREE.Group[];
  paint: THREE.MeshPhysicalMaterial;
  lamp: THREE.MeshStandardMaterial;
  tail: THREE.MeshStandardMaterial;
  materials: THREE.MeshStandardMaterial[];
  standIn: THREE.Mesh[];
  beam: THREE.Vector3; // headlight position (metres)
}

export function buildPCX(): Scooter {
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xf4f5f2, metalness: 0.1, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 }); // pearl white
  const trim = new THREE.MeshStandardMaterial({ color: 0x1b1e21, roughness: 0.62 }); // matte black plastic
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.55 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8c9196, metalness: 0.85, roughness: 0.35 }); // cast aluminium
  const dark = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.45 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 1, roughness: 0.16 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x141618, roughness: 0.92 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.55 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xf6f8ff, emissive: 0xeef3ff, emissiveIntensity: 0.4, roughness: 0.1 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x5a0d0a, emissive: 0xff2a1f, emissiveIntensity: 0.8, roughness: 0.3 });
  const amber = new THREE.MeshStandardMaterial({ color: 0xc9861c, emissive: 0xff9a1a, emissiveIntensity: 0.15, roughness: 0.3 });
  const lcd = new THREE.MeshStandardMaterial({ color: 0x0c1418, emissive: 0x6fd6ff, emissiveIntensity: 0.25, roughness: 0.2 });

  const group = new THREE.Group();
  const UP = new THREE.Vector3(0, 1, 0);
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = group) => {
    const o = new THREE.Mesh(g, m); o.position.set(x, y, z); parent.add(o); return o;
  };
  const rod = (a: [number, number, number], b: [number, number, number], r: number, m: THREE.Material) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const o = add(new THREE.CylinderGeometry(r, r, A.distanceTo(B), 12), m);
    o.position.copy(A).add(B).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(UP, B.sub(A).normalize()); return o;
  };

  // Wheels: tyre, black cast rim with five spokes, hub; disc brake on the front.
  const wheel = (z: number, width: number, rimR: number, disc: boolean) => {
    const w = new THREE.Group(); w.position.set(0, PCX.wheelR, z); group.add(w);
    add(new THREE.TorusGeometry(PCX.wheelR - width / 2, width / 2, 14, 40).rotateY(Math.PI / 2), rubber, 0, 0, 0, w);
    add(new THREE.CylinderGeometry(rimR, rimR, width * 0.78, 32, 1, true).rotateZ(Math.PI / 2), dark, 0, 0, 0, w);
    add(new THREE.CylinderGeometry(0.045, 0.045, width * 0.9, 16).rotateZ(Math.PI / 2), metal, 0, 0, 0, w);
    for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(width * 0.35, rimR - 0.04, 0.026).translate(0, (rimR + 0.04) / 2, 0), dark, 0, 0, 0, w).rotation.x = (k * Math.PI * 2) / 5;
    if (disc) add(new THREE.CylinderGeometry(0.11, 0.11, 0.005, 32).rotateZ(Math.PI / 2), chrome, -width / 2 - 0.004, 0, 0, w);
    return w;
  };
  const wheels = [wheel(PCX.axleF, 0.11, 0.178, true), wheel(PCX.axleR, 0.13, 0.165, false)];
  add(new THREE.BoxGeometry(0.03, 0.07, 0.09), dark, -0.075, 0.34, PCX.axleF + 0.05); // front caliper

  // Telescopic fork, raked about 26.5 degrees, disappearing up into the cowl.
  [-0.068, 0.068].forEach((x) => {
    rod([x, PCX.wheelR, PCX.axleF], [x, 0.43, PCX.axleF + 0.088], 0.028, dark);
    rod([x, 0.42, PCX.axleF + 0.083], [x, 0.66, PCX.axleF + 0.2], 0.019, chrome);
  });
  add(new THREE.TorusGeometry(0.29, 0.03, 6, 22, Math.PI * 0.62).rotateZ(0.42).rotateY(Math.PI / 2), paint, 0, PCX.wheelR, PCX.axleF).scale.x = 1.9; // front hugger

  // Front cowl with the leg shield behind it (black inner panel), floorboard and lower skirts.
  // Seen from the front the cowl is shield-shaped: widest at knee height, narrowing to the nose, the bar cover and the fender.
  const shield = (z: number, y: number) => (0.55 + 0.45 * smooth((z + 1.02) / 0.42)) * (1 - 0.3 * smooth((y - 0.8) / 0.25) - 0.3 * smooth((0.62 - y) / 0.3));
  add(panel([[-0.99, 0.6], [-1.01, 0.7], [-0.97, 0.83], [-0.88, 0.93], [-0.72, 0.99], [-0.58, 1.0], [-0.52, 0.95], [-0.44, 0.62], [-0.38, 0.33], [-0.42, 0.36], [-0.52, 0.48], [-0.66, 0.56], [-0.82, 0.585]],
    0.56, 0.05, shield), paint);
  add(panel([[-0.57, 0.97], [-0.5, 0.95], [-0.41, 0.62], [-0.35, 0.33], [-0.42, 0.33], [-0.49, 0.62], [-0.58, 0.93]], 0.52, 0.02, shield), trim);
  [-1, 1].forEach((s) => rod([s * 0.255, 0.66, -0.92], [s * 0.27, 0.6, -0.56], 0.009, chrome)); // side garnish
  add(new THREE.BoxGeometry(0.38, 0.04, 0.44), trim, 0, 0.31, -0.17); // floorboard
  add(panel([[-0.42, 0.3], [0.14, 0.3], [0.2, 0.2], [0.05, 0.13], [-0.36, 0.15]], 0.42, 0.02, () => 1), trim); // lower side skirts

  // Rear body under the seat, narrowing to the tail, then the two-step seat.
  add(panel([[0, 0.31], [0.03, 0.55], [0.06, 0.7], [0.45, 0.71], [0.85, 0.74], [0.96, 0.7], [0.95, 0.62], [0.8, 0.585], [0.55, 0.555], [0.35, 0.47], [0.18, 0.36], [0.1, 0.28]],
    0.42, 0.045, (z, y) => (1 - 0.45 * smooth((z - 0.45) / 0.5)) * (1 - 0.35 * smooth((0.6 - y) / 0.3))), paint);
  add(panel([[0.01, 0.7], [0, 0.72], [0.06, 0.74], [0.4, 0.74], [0.5, 0.765], [0.58, 0.78], [0.84, 0.775], [0.9, 0.75], [0.89, 0.72], [0.45, 0.705]],
    0.32, 0.025, (z) => 1 - 0.22 * smooth((z - 0.5) / 0.4)), seatMat);
  [-1, 1].forEach((s) => rod([s * 0.15, 0.715, 0.5], [s * 0.12, 0.745, 0.86], 0.014, dark)); // grab rails
  rod([-0.12, 0.745, 0.86], [0.12, 0.745, 0.86], 0.014, dark);

  // Handlebar cover with the digital meter, grips, levers, mirrors and the small smoked screen.
  add(panel([[-0.68, 0.97], [-0.64, 1.05], [-0.5, 1.06], [-0.44, 1.02], [-0.48, 0.96]], 0.46, 0.03, (z) => 0.8 + 0.2 * smooth((z + 0.68) / 0.16)), paint);
  add(new THREE.BoxGeometry(0.2, 0.01, 0.1), lcd, 0, 1.087, -0.56).rotation.x = 0.35;
  [-1, 1].forEach((s) => {
    rod([s * 0.22, 1.02, -0.48], [s * 0.24, 1.02, -0.48], 0.016, chrome);
    rod([s * 0.24, 1.02, -0.48], [s * 0.36, 1.02, -0.48], 0.019, rubber);
    rod([s * 0.21, 1.035, -0.54], [s * 0.34, 1.03, -0.56], 0.007, dark); // brake levers
    rod([s * 0.21, 1.05, -0.53], [s * 0.3, 1.21, -0.57], 0.008, dark); // mirror stalks
    const m = add(new THREE.CylinderGeometry(0.055, 0.055, 0.016, 20).rotateX(Math.PI / 2), dark, s * 0.32, 1.23, -0.57); m.scale.x = 1.45;
    add(new THREE.BoxGeometry(0.05, 0.025, 0.02), amber, s * 0.14, 0.86, -0.995).rotation.y = s * 0.5; // front indicators
    add(new THREE.BoxGeometry(0.04, 0.025, 0.02), amber, s * 0.1, 0.6, 1.0); // rear indicators
  });
  add(panel([[-0.9, 0.92], [-0.8, 1.12], [-0.76, 1.12], [-0.84, 0.94]], 0.3, 0.008, () => 1), glass);

  // Twin LED headlights forming a V across the nose, with a position-light strip below.
  [-1, 1].forEach((s) => { const h = add(new THREE.BoxGeometry(0.14, 0.032, 0.02), lamp, s * 0.072, 0.79, -1.045); h.rotation.set(-0.3, 0, s * 0.35); });
  add(new THREE.BoxGeometry(0.1, 0.014, 0.02), lamp, 0, 0.7, -1.063).rotation.x = -0.15;

  // X-shaped LED tail light, number plate holder.
  add(new THREE.BoxGeometry(0.2, 0.075, 0.02), glass, 0, 0.665, 1.012); // smoked tail lens
  [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.15, 0.016, 0.02), tail, 0, 0.665, 1.025).rotation.z = s * 0.4);
  const plate = add(new THREE.BoxGeometry(0.17, 0.11, 0.008), new THREE.MeshStandardMaterial({ color: 0xd9dcd6, roughness: 0.5 }), 0, 0.5, 1.0); plate.rotation.x = -0.45;
  add(new THREE.BoxGeometry(0.19, 0.13, 0.006), trim, 0, 0.5, 0.995).rotation.x = -0.45;

  // Drivetrain: unit-swing engine with the CVT case on the left, air box above it, muffler on the right, twin shocks.
  const cvt = add(new THREE.CapsuleGeometry(0.085, 0.46, 6, 16).rotateX(Math.PI / 2), metal, -0.13, 0.3, 0.38); cvt.scale.x = 0.55;
  add(new THREE.BoxGeometry(0.11, 0.11, 0.3), trim, -0.12, 0.43, 0.32);
  add(new THREE.BoxGeometry(0.22, 0.15, 0.22), dark, -0.01, 0.2, 0.06).rotation.x = -0.5; // cylinder
  rod([0.04, 0.15, 0.0], [0.15, 0.3, 0.36], 0.022, chrome); // header pipe
  const muffler = add(new THREE.CapsuleGeometry(0.065, 0.32, 6, 16).rotateX(Math.PI / 2), dark, 0.17, 0.37, 0.58); muffler.rotation.x = -0.22;
  add(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 18).rotateX(Math.PI / 2), chrome, 0.17, 0.42, 0.79).rotation.x = -0.22; // end cap
  rod([0.11, 0.28, 0.3], [0.11, PCX.wheelR, PCX.axleR], 0.022, dark); // right swingarm
  rod([-0.13, 0.34, 0.62], [-0.13, 0.6, 0.46], 0.024, chrome);
  rod([0.12, 0.3, 0.64], [0.12, 0.6, 0.48], 0.024, chrome);

  // Stand-in rider, used only if the avatar fails to load.
  const standIn = [add(new THREE.BoxGeometry(0.38, 0.58, 0.24), paint, 0, 1.07, 0.16), add(new THREE.SphereGeometry(0.12, 14, 10), paint, 0, 1.5, 0.14)];

  wheels.forEach((w) => mergeByMaterial(w)); // each wheel still spins as one group
  mergeByMaterial(group, new Set<THREE.Object3D>([...wheels, ...standIn]));
  group.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.castShadow = true; });
  return {
    group, wheels, paint, lamp, tail, standIn, beam: new THREE.Vector3(0, 0.78, -1.08),
    materials: [paint, trim, seatMat, metal, dark, chrome, rubber, glass, lamp, tail, amber, lcd],
  };
}
