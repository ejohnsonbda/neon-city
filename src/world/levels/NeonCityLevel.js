import * as THREE from 'three';

export function createNeonCityLevel({ factory }) {
  const group = new THREE.Group();
  group.name = 'Neon City Level';
  const floor = factory.box(group, { position: new THREE.Vector3(0, -0.08, 0), size: new THREE.Vector3(180, 0.16, 180), color: 0x111620, name: 'neon-city-ground' });
  floor.receiveShadow = true;
  for (let i = -4; i <= 4; i++) {
    const x = i * 18;
    factory.neonStrip(group, new THREE.Vector3(x, 0.015, 0), new THREE.Vector3(0.35, 0.05, 170), i % 2 ? 0xff2d95 : 0x19f0ff);
    factory.neonStrip(group, new THREE.Vector3(0, 0.02, x), new THREE.Vector3(170, 0.05, 0.35), i % 2 ? 0x7d5cff : 0x19f0ff);
  }
  for (let i = 0; i < 42; i++) {
    const laneGap = Math.abs((i % 7) - 3) < 1 ? 26 : 12;
    const x = (Math.random() - 0.5) * 150;
    const z = (Math.random() - 0.5) * 150;
    if (Math.abs(x) < laneGap && Math.abs(z) < laneGap) continue;
    const height = 8 + Math.random() * 32;
    const size = new THREE.Vector3(5 + Math.random() * 8, height, 5 + Math.random() * 8);
    const building = factory.box(group, { position: new THREE.Vector3(x, height / 2, z), size, color: 0x1a2030, name: 'neon-city-building' });
    factory.neonStrip(group, new THREE.Vector3(x, height + 0.12, z), new THREE.Vector3(size.x * 0.8, 0.16, size.z * 0.8), i % 2 ? 0xff2d95 : 0x19f0ff);
    building.material.emissive = new THREE.Color(0x070a15);
  }
  return { group, spawn: new THREE.Vector3(0, 1.7, 22), fog: new THREE.FogExp2(0x05060c, 0.012), background: 0x05060c, enemyTheme: 'street' };
}
