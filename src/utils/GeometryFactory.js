import * as THREE from 'three';

export class GeometryFactory {
  constructor(physicsWorld) {
    this.physicsWorld = physicsWorld;
  }

  material(color, options = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.12, ...options });
  }

  emissive(color, intensity = 1.4) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.15 });
  }

  box(group, { position, size, color = 0x555a66, collider = true, name = 'box', material = null }) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material || this.material(color));
    mesh.position.copy(position);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collider) this.physicsWorld.addBox(position, size, name);
    return mesh;
  }

  cylinder(group, { position, radius = 1, depth = 2, color = 0x777777, radialSegments = 12, collider = false, name = 'cylinder' }) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, radialSegments), this.material(color));
    mesh.position.copy(position);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collider) this.physicsWorld.addBox(position, new THREE.Vector3(radius * 2, depth, radius * 2), name);
    return mesh;
  }

  neonStrip(group, position, size, color) {
    return this.box(group, { position, size, color, collider: false, material: this.emissive(color, 2.4), name: 'neon-strip' });
  }
}
