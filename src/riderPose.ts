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
const CYCLE = 3.4; // seconds per greeting loop
/** 0 = upright, 1 = fully bowed: stand, bow down, hold, rise, pause. */
const bow = (c: number) => ease((c - 0.4) / 0.8) - ease((c - 2.0) / 0.8);

/** Joint angles (degrees, avatar frame) for the greeting. Tune here. */
export const WELCOME = {
  // Right hand flat on the chest (palm on the body, fingers across toward the left side), left hand behind the back.
  hand: { armDown: 78, armForward: -9.5, forearm: 135, forearmIn: -35, palmY: -61.5, palmX: -54, palmZ: -78 },
  // Japanese-style bow (ojigi): bend from the hips with the back and neck kept in one line, about 30 degrees.
  bow: { hips: 20, mid: 6, upper: 4, neck: 0, head: 2 },
};

/**
 * Standing greeting: right hand on the chest, left hand behind the back, then a calm Japanese-style bow from the hips.
 * Call the returned function every frame with time t (seconds).
 * The upright and bowed poses are computed once here, so each frame only blends a few quaternions
 * (no skeleton-wide matrix updates).
 */
export function poseWelcome(root: THREE.Object3D): (t: number) => void {
  const names = ["Spine", "Spine1", "Spine2", "Neck", "Head", "LeftArm", "LeftForeArm", "RightArm", "RightForeArm", "RightHand"] as const;
  const bones = names.map((n) => root.getObjectByName(n));
  const snap = () => bones.map((b) => (b ? b.quaternion.clone() : new THREE.Quaternion()));
  const { hand: H, bow: B } = WELCOME;

  // Arms first, while the torso is upright, so the hands stay on the body when it bows.
  turn(root, "LeftArm", "z", -78); turn(root, "LeftArm", "x", 8);          // left arm down, a touch back
  turn(root, "LeftForeArm", "z", -80); turn(root, "LeftForeArm", "y", -10); // forearm across the lower back
  turn(root, "RightArm", "z", H.armDown); turn(root, "RightArm", "x", H.armForward);
  turn(root, "RightForeArm", "z", H.forearm); turn(root, "RightForeArm", "y", H.forearmIn);
  turn(root, "RightHand", "y", H.palmY); turn(root, "RightHand", "x", H.palmX); turn(root, "RightHand", "z", H.palmZ); // palm flat on the chest
  const upright = snap();
  turn(root, "Spine", "x", B.hips); turn(root, "Spine1", "x", B.mid); turn(root, "Spine2", "x", B.upper);
  turn(root, "Neck", "x", B.neck); turn(root, "Head", "x", B.head);
  const bowed = snap();
  bones.forEach((b, i) => b?.quaternion.copy(upright[i]));
  root.updateMatrixWorld(true);

  return (t) => {
    const k = bow(t % CYCLE);
    bones.forEach((b, i) => b?.quaternion.copy(upright[i]).slerp(bowed[i], k));
  };
}
