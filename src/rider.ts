import type { Object3D, Skeleton, SkinnedMesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * The avatar is downloaded and decoded once, then shared: the welcome screen and the background each get their own
 * clone (own skeleton, so each can be posed separately) that reuses the same geometry, materials and textures.
 * The model is meshopt-compressed with WebP textures, so the loader needs the meshopt decoder.
 */
let model: Promise<Object3D> | null = null;

export function loadRider(onProgress?: (fraction: number) => void): Promise<Object3D> {
  model ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    .loadAsync("/models/rider.glb", (e) => { if (e.total) onProgress?.(e.loaded / e.total); })
    .then((gltf) => gltf.scene);
  model.catch(() => { model = null; }); // allow a retry on a later mount if the download failed
  return model.then((scene) => {
    const avatar = clone(scene);
    avatar.traverse((o) => { o.frustumCulled = false; }); // skinned bounds don't follow the posed bones
    shareSkeleton(avatar);
    return avatar;
  });
}

/**
 * The loader gives each of the avatar's 7 skinned meshes its own Skeleton, so every frame the same 52 bone matrices
 * are computed and uploaded 7 times. They all use one skin (same bones, same inverse bind matrices), so they can share
 * a single Skeleton: one update and one bone texture per frame.
 */
function shareSkeleton(root: Object3D) {
  const meshes: SkinnedMesh[] = [];
  root.traverse((o) => { if ((o as SkinnedMesh).isSkinnedMesh) meshes.push(o as SkinnedMesh); });
  const [first, ...rest] = meshes;
  if (!first) return;
  const same = (s: Skeleton) => s.bones.length === first.skeleton.bones.length
    && s.bones.every((b, i) => b === first.skeleton.bones[i] && s.boneInverses[i].equals(first.skeleton.boneInverses[i]));
  rest.forEach((m) => { if (same(m.skeleton)) { m.skeleton.dispose(); m.skeleton = first.skeleton; } });
}
