import * as THREE from 'three';

export function createJapanLevel({ factory }) {
  const group = new THREE.Group();
  group.name = 'Japan Level';
  factory.box(group, { position: new THREE.Vector3(0, -0.08, 0), size: new THREE.Vector3(170, 0.16, 170), color: 0x2e352f, name: 'japan-ground' });
  for (let i = -3; i <= 3; i++) {
    factory.neonStrip(group, new THREE.Vector3(i * 16, 0.03, 0), new THREE.Vector3(0.18, 0.05, 150), i % 2 ? 0xff6ec7 : 0xffffff);
  }
  for (let i = 0; i < 24; i++) {
    const x = (Math.random() - 0.5) * 140;
    const z = (Math.random() - 0.5) * 140;
    const trunk = factory.cylinder(group, { position: new THREE.Vector3(x, 1.1, z), radius: 0.28, depth: 2.2, color: 0x5a301b, collider: true, name: 'sakura-trunk' });
    const crown = new THREE.Mesh(new THREE.SphereGeometry(2.2 + Math.random(), 12, 8), factory.material(0xff9ecf, { roughness: 0.92 }));
    crown.position.set(x, 3.2, z);
    crown.castShadow = true;
    group.add(crown);
  }
  for (let i = 0; i < 8; i++) {
    const x = -55 + i * 16;
    factory.box(group, { position: new THREE.Vector3(x, 1.3, -42), size: new THREE.Vector3(8, 2.6, 5), color: 0x4b2828, name: 'market-stall' });
    factory.neonStrip(group, new THREE.Vector3(x, 2.75, -42), new THREE.Vector3(7, 0.18, 4.4), 0xff6ec7);
  }
  return { group, spawn: new THREE.Vector3(0, 1.7, 30), fog: new THREE.FogExp2(0x16221d, 0.009), background: 0x0e1815, enemyTheme: 'samurai' };
}
