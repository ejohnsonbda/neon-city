
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

  portal(group, { position, color = 0x19f0ff, rotationY = 0, name = 'teleport-portal' }) {
    const portal = new THREE.Group();
    portal.name = name;
    portal.position.copy(position);
    portal.rotation.y = rotationY;

    const outer = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.12, 16, 64),
      this.emissive(color, 2.8)
    );
    outer.name = `${name}-outer-ring`;
    portal.add(outer);

    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.045, 12, 48),
      this.emissive(0xffffff, 1.4)
    );
    inner.name = `${name}-inner-ring`;
    portal.add(inner);

    const field = new THREE.Mesh(
      new THREE.CircleGeometry(1.48, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    field.name = `${name}-energy-field`;
    portal.add(field);

    for (let i = 0; i < 10; i++) {
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.035, 0.7 + (i % 3) * 0.16, 0.035),
        this.emissive(color, 2.1)
      );
      const angle = (i / 10) * Math.PI * 2;
      blade.position.set(Math.cos(angle) * 1.45, Math.sin(angle) * 1.45, 0.04);
      blade.rotation.z = angle;
      portal.add(blade);
    }

    const light = new THREE.PointLight(color, 2.2, 14, 2.0);
    light.position.set(0, 0, 0.45);
    portal.add(light);

    portal.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = false;
        object.receiveShadow = false;
      }
    });
    group.add(portal);
    return portal;
  }
}
