import * as THREE from 'three';

const _point = new THREE.Vector3();
const _closest = new THREE.Vector3();

export class PhysicsWorld {
  constructor() {
    this.colliders = [];
    this.debugHelpers = [];
  }

  clear(scene) {
    for (const helper of this.debugHelpers) scene?.remove(helper);
    this.colliders.length = 0;
    this.debugHelpers.length = 0;
  }

  addBox(center, size, label = 'collider') {
    const half = size.clone().multiplyScalar(0.5);
    const box = new THREE.Box3(center.clone().sub(half), center.clone().add(half));
    this.colliders.push({ box, label });
    return box;
  }

  addMeshBox(mesh, label = mesh.name || 'mesh') {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    this.colliders.push({ box, label });
    return box;
  }

  resolveCapsule(capsule, velocity) {
    let onFloor = false;
    const points = [capsule.start, capsule.end, _point.addVectors(capsule.start, capsule.end).multiplyScalar(0.5).clone()];
    for (const { box } of this.colliders) {
      for (const point of points) {
        _closest.copy(point).clamp(box.min, box.max);
        const delta = point.clone().sub(_closest);
        const distance = delta.length();
        if (distance < capsule.radius) {
          const normal = distance > 1e-5 ? delta.multiplyScalar(1 / distance) : new THREE.Vector3(0, 1, 0);
          const depth = capsule.radius - distance;
          capsule.translate(normal.multiplyScalar(depth));
          if (normal.y > 0.45) onFloor = true;
          const velIntoSurface = velocity.dot(normal);
          if (velIntoSurface < 0) velocity.addScaledVector(normal, -velIntoSurface);
        }
      }
    }
    return onFloor;
  }
}
