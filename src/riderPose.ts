import * as THREE from "three";

/** Joint angles in degrees. Rotations are applied about world axes, so they do not depend on each bone's local axes. */
export interface RiderPose { spine: number; head: number; thigh: number; shin: number; armYaw: number; armPitch: number; elbow: number }
/** Upright scooter pose: slight forward lean, thighs level, shins down to the floorboard, hands on the grips.
 * Fitted by measuring the avatar's bones against the PCX seat (0.765 m), floorboard (0.33 m) and grips (see pcx.ts). */
export const POSE: RiderPose = { spine: 12, head: -4, thigh: -91.25, shin: 97.5, armYaw: 84.25, armPitch: 45.5, elbow: 0 };

/** Where the avatar sits on the scooter (bike units = metres x scale): hips over the rider part of the seat, facing forward (-z). */
export const SEAT = { x: 0, y: -0.063, z: 0.086, scale: 0.77 };

const AXIS = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const q = new THREE.Quaternion(), pq = new THREE.Quaternion(), rq = new THREE.Quaternion(), ax = new THREE.Vector3();

function turn(root: THREE.Object3D, name: string, axis: "x" | "y" | "z", deg: number): void {
  const bone = root.getObjectByName(name);
  if (!bone?.parent) return;
  root.updateMatrixWorld(true);
  bone.parent.getWorldQuaternion(pq);
  root.getWorldQuaternion(rq);
  // Axes follow the avatar's own frame: +z is forward, +x its left, +y up (whatever way the avatar is placed).
  q.setFromAxisAngle(ax.copy(AXIS[axis]).applyQuaternion(rq), THREE.MathUtils.degToRad(deg));
  // local' = parent^-1 * worldRotation * parent * local
  bone.quaternion.premultiply(pq.clone().invert().multiply(q).multiply(pq));
}

/** Turns the T-pose avatar into the seated scooter pose. Call once after loading. */
export function poseRider(root: THREE.Object3D, p: RiderPose = POSE): void {
  ["Spine", "Spine1", "Spine2"].forEach((n) => turn(root, n, "x", p.spine));
  turn(root, "Neck", "x", p.head / 2); turn(root, "Head", "x", p.head / 2);
  (["Left", "Right"] as const).forEach((s) => {
    turn(root, `${s}UpLeg`, "x", p.thigh); turn(root, `${s}Leg`, "x", p.shin);
    turn(root, `${s}Arm`, "y", s === "Left" ? -p.armYaw : p.armYaw);
    turn(root, `${s}Arm`, "x", p.armPitch); turn(root, `${s}ForeArm`, "x", p.elbow);
  });
  root.updateMatrixWorld(true);
}

const ease = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
/** 0 = upright, 1 = fully bowed. Repeats every 3.4 s: stand, bow down, hold, come back up. */
const bow = (t: number) => { const c = t % 3.4; return ease((c - 0.5) / 0.8) - ease((c - 1.9) / 0.8); };

/** Standing greeting: right hand on the chest, left hand behind the back, then a polite bow from the waist. Call the returned function every frame with time t (seconds). */
export function poseWelcome(root: THREE.Object3D): (t: number) => void {
  const names = ["Spine", "Spine1", "Spine2", "Neck", "Head", "LeftArm", "LeftForeArm", "RightArm", "RightForeArm"];
  const rest = new Map(names.map((n) => [n, root.getObjectByName(n)?.quaternion.clone()]));
  return (t) => {
    names.forEach((n) => { const b = root.getObjectByName(n), r = rest.get(n); if (b && r) b.quaternion.copy(r); });
    // Arms first, while the torso is upright, so the hands stay on the body when it bows.
    turn(root, "LeftArm", "z", -78); turn(root, "LeftArm", "x", 8);            // left arm down, a touch back
    turn(root, "LeftForeArm", "z", -80); turn(root, "LeftForeArm", "y", -10);   // forearm across the lower back
    turn(root, "RightArm", "z", 78); turn(root, "RightArm", "x", -12);          // right arm down, a touch forward
    turn(root, "RightForeArm", "z", 135); turn(root, "RightForeArm", "y", -35); // forearm up across the chest
    const k = bow(t);
    [18, 12, 8].forEach((deg, i) => turn(root, ["Spine", "Spine1", "Spine2"][i], "x", k * deg)); // bend at the waist
    turn(root, "Neck", "x", k * 6); turn(root, "Head", "x", k * 4);
    root.updateMatrixWorld(true);
  };
}