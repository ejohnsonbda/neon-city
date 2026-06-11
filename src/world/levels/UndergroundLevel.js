import * as THREE from 'three';

export function createUndergroundLevel({ factory }) {
  const group = new THREE.Group();
  group.name = 'Underground Cleaners Level';
  factory.box(group, { position: new THREE.Vector3(0, -0.08, 0), size: new THREE.Vector3(170, 0.16, 170), color: 0x15171b, name: 'underground-floor' });
  factory.box(group, { position: new THREE.Vector3(0, 7.6, 0), size: new THREE.Vector3(170, 0.5, 170), color: 0x20252d, collider: false, name: 'underground-ceiling' });
  for (const x of [-82, 82]) factory.box(group, { position: new THREE.Vector3(x, 3.6, 0), size: new THREE.Vector3(2, 7.2, 170), color: 0x252b33, name: 'tunnel-wall' });
  for (const z of [-82, 82]) factory.box(group, { position: new THREE.Vector3(0, 3.6, z), size: new THREE.Vector3(170, 7.2, 2), color: 0x252b33, name: 'tunnel-wall' });
  for (let i = -4; i <= 4; i++) {
    factory.neonStrip(group, new THREE.Vector3(i * 18, 7.25, 0), new THREE.Vector3(0.3, 0.2, 150), 0xffd166);
    factory.neonStrip(group, new THREE.Vector3(0, 0.08, i * 18), new THREE.Vector3(145, 0.08, 0.28), 0x19f0ff);
  }
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() - 0.5) * 130;
    const z = (Math.random() - 0.5) * 130;
    factory.box(group, { position: new THREE.Vector3(x, 0.75, z), size: new THREE.Vector3(3.4, 1.5, 3.4), color: 0x39414e, name: 'cleaner-equipment' });
    factory.neonStrip(group, new THREE.Vector3(x, 1.56, z), new THREE.Vector3(2.2, 0.08, 2.2), i % 2 ? 0xffd166 : 0x6dff69);
  }

  const portalMesh = factory.portal(group, { position: new THREE.Vector3(-58, 2.4, 0), color: 0x19f0ff, rotationY: Math.PI / 2, name: 'underground-neon-portal' });
  return { group, spawn: new THREE.Vector3(0, 1.7, 28), fog: new THREE.FogExp2(0x090b0f, 0.018), background: 0x07090d, enemyTheme: 'cleaners', portals: [{ mesh: portalMesh, position: portalMesh.position, radius: 2.4, targetLevel: 'neon-city', target: new THREE.Vector3(54, 1.7, 0), label: 'Neon City' }] };
}
