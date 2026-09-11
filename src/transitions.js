import * as THREE from "three";
export const TRANSITION_SECONDS = 0.4;
export function voxelScale(life, now) {
  if (!life) return 1;
  const t = Math.max(0, Math.min(1, (now - life[0]) / TRANSITION_SECONDS));
  return life[1] + (life[2] - life[1]) * t * t * (3 - 2 * t);
}
export const voxelKey = (b) =>
  [
    b.u,
    b.v,
    b.y,
    b.su,
    b.sv,
    b.sy,
    b.kind,
    b.kind === 0 || b.kind === 2 ? "ground" : b.color,
  ].join("|");
/** One instanced draw for all outgoing cubes; growth stays in the chunk shader. */
export class VoxelTransitions {
  constructor(world) {
    this.world = world;
    this.batches = [];
    this.capacity = 60000;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      world.material,
      this.capacity,
    );
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.customDepthMaterial = world.depthMaterial;
    this.mesh.geometry.setAttribute(
      "instanceRoot",
      new THREE.InstancedBufferAttribute(
        new Float32Array(this.capacity * 4),
        4,
      ),
    );
    this.mesh.geometry.setAttribute(
      "instanceLife",
      new THREE.InstancedBufferAttribute(
        new Float32Array(this.capacity * 3),
        3,
      ),
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    world.scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.dirty = false;
  }
  retire(boxes, now) {
    if (!boxes.length) return;
    const batch = {
      end: now + TRANSITION_SECONDS,
      boxes: boxes.map((b) => ({
        ...b,
        life: [now, voxelScale(b.life, now), 0],
      })),
    };
    this.batches.push(batch);
    this.world.collisions.replace(
      batch,
      batch.boxes.filter((b) => !b.dead),
    );
    this.dirty = true;
    while (
      this.batches.reduce((n, b) => n + b.boxes.length, 0) > this.capacity
    ) {
      this.world.collisions.remove(this.batches.shift());
    }
  }
  clear() {
    this.batches.forEach((b) => this.world.collisions.remove(b));
    this.batches = [];
    this.mesh.count = 0;
    this.dirty = false;
  }
  update(now) {
    this.batches = this.batches.filter((b) => {
      if (now < b.end) return true;
      this.world.collisions.remove(b);
      this.dirty = true;
      return false;
    });
    if (!this.dirty) return;
    this.dirty = false;
    let index = 0;
    const roots = this.mesh.geometry.getAttribute("instanceRoot"),
      life = this.mesh.geometry.getAttribute("instanceLife");
    for (const batch of this.batches)
      for (const b of batch.boxes) {
        const d = this.dummy;
        d.position.set(b.v, b.y, -b.u);
        d.scale.set(b.sv, b.sy, b.su);
        d.updateMatrix();
        this.mesh.setMatrixAt(index, d.matrix);
        this.mesh.setColorAt(index, this.color.set(b.color));
        roots.setXYZW(index, ...b.root);
        life.setXYZ(index, ...b.life);
        index++;
      }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    roots.needsUpdate = life.needsUpdate = true;
  }
}
