import * as THREE from 'three';

export function createLostJungleLevel({ factory }) {
  const group = new THREE.Group();
  group.name = 'Lost Jungle Level';
  factory.box(group, { position: new THREE.Vector3(0, -0.08, 0), size: new THREE.Vector3(190, 0.16, 190), color: 0x24451f, name: 'jungle-ground' });
  const water = factory.box(group, { position: new THREE.Vector3(-22, 0.02, -18), size: new THREE.Vector3(28, 0.08, 18), color: 0x156a8a, collider: false, name: 'jungle-water', material: factory.emissive(0x147dad, 0.45) });
  water.material.transparent = true;
  water.material.opacity = 0.72;
  for (let i = 0; i < 72; i++) {
    const x = (Math.random() - 0.5) * 170;
    const z = (Math.random() - 0.5) * 170;
    if (Math.abs(x) < 12 && Math.abs(z) < 24) continue;
    const height = 3 + Math.random() * 5;
    factory.cylinder(group, { position: new THREE.Vector3(x, height / 2, z), radius: 0.35 + Math.random() * 0.45, depth: height, color: 0x5b351a, collider: true, name: 'jungle-tree' });
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.4 + Math.random() * 1.8, 5.2, 7), factory.material(Math.random() > 0.5 ? 0x2f7a2f : 0x3c8c3c));
    leaves.position.set(x, height + 1.6, z);
    leaves.castShadow = true;
    group.add(leaves);
  }
  for (let i = 0; i < 16; i++) {
    const x = -42 + Math.random() * 84;
    const z = -44 + Math.random() * 88;
    factory.box(group, { position: new THREE.Vector3(x, 0.6, z), size: new THREE.Vector3(2 + Math.random() * 3, 1.2, 1 + Math.random() * 2), color: 0x315229, name: 'jungle-bramble' });
  }
  return { group, spawn: new THREE.Vector3(0, 1.7, 32), fog: new THREE.FogExp2(0x17351b, 0.014), background: 0x102712, enemyTheme: 'jungle' };
}
