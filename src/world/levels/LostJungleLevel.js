
import * as THREE from 'three';

export function createLostJungleLevel({ factory }) {
  const group = new THREE.Group();
  group.name = 'Lost Jungle Level';

  factory.box(group, { position: new THREE.Vector3(0, -0.08, 0), size: new THREE.Vector3(210, 0.16, 210), color: 0x24451f, name: 'jungle-ground' });

  const river = factory.box(group, { position: new THREE.Vector3(-26, 0.02, -14), size: new THREE.Vector3(18, 0.08, 72), color: 0x156a8a, collider: false, name: 'jungle-river', material: factory.emissive(0x147dad, 0.45) });
  river.material.transparent = true;
  river.material.opacity = 0.72;
  const lagoon = factory.box(group, { position: new THREE.Vector3(-5, 0.025, -48), size: new THREE.Vector3(42, 0.08, 22), color: 0x0e6f8f, collider: false, name: 'jungle-lagoon', material: factory.emissive(0x147dad, 0.38) });
  lagoon.material.transparent = true;
  lagoon.material.opacity = 0.68;
  const waterfall = factory.box(group, { position: new THREE.Vector3(-38, 4.2, -50), size: new THREE.Vector3(8, 8.4, 0.45), color: 0x6be4ff, collider: false, name: 'jungle-waterfall', material: factory.emissive(0x35caff, 0.78) });
  waterfall.material.transparent = true;
  waterfall.material.opacity = 0.62;

  const stone = factory.material(0x5b6551, { roughness: 0.94, metalness: 0.02 });
  const moss = factory.material(0x355b2d, { roughness: 0.98, metalness: 0.02 });
  factory.box(group, { position: new THREE.Vector3(18, 1.0, -24), size: new THREE.Vector3(30, 2.0, 7), color: 0x5b6551, name: 'jungle-temple-step', material: stone });
  factory.box(group, { position: new THREE.Vector3(18, 3.1, -31), size: new THREE.Vector3(24, 4.2, 6), color: 0x4f5848, name: 'jungle-temple-wall', material: stone });
  factory.box(group, { position: new THREE.Vector3(18, 5.6, -34.5), size: new THREE.Vector3(18, 1.3, 4), color: 0x34452f, name: 'jungle-moss-roof', material: moss });
  for (const [x, z] of [[7, -18], [29, -18], [8, -31], [28, -31], [2, 8], [35, 9]]) {
    factory.cylinder(group, { position: new THREE.Vector3(x, 2.4, z), radius: 0.75, depth: 4.8, radialSegments: 9, color: 0x56614f, collider: true, name: 'jungle-ruin-column' });
  }

  const trunkColors = [0x5b351a, 0x6b4524, 0x473119];
  const leafColors = [0x2f7a2f, 0x3c8c3c, 0x1f5c2b, 0x4f9a3a];
  for (let i = 0; i < 110; i++) {
    const x = (Math.random() - 0.5) * 190;
    const z = (Math.random() - 0.5) * 190;
    if (Math.abs(x) < 14 && Math.abs(z - 32) < 20) continue;
    if (Math.abs(x + 26) < 14 && Math.abs(z + 14) < 44) continue;
    const height = 4.5 + Math.random() * 8;
    factory.cylinder(group, { position: new THREE.Vector3(x, height / 2, z), radius: 0.28 + Math.random() * 0.48, depth: height, color: trunkColors[i % trunkColors.length], collider: true, name: 'jungle-tree' });
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.6 + Math.random() * 2.4, 6.2 + Math.random() * 2.2, 7), factory.material(leafColors[i % leafColors.length], { roughness: 1, flatShading: true }));
    leaf.position.set(x, height + 2.0, z);
    leaf.castShadow = true;
    group.add(leaf);
    if (i % 4 === 0) {
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.6 + Math.random() * 1.8, 8, 6), factory.material(leafColors[(i + 1) % leafColors.length], { roughness: 1, flatShading: true }));
      canopy.position.set(x + (Math.random() - 0.5) * 3, height + 3.0, z + (Math.random() - 0.5) * 3);
      canopy.scale.y = 0.55;
      canopy.castShadow = true;
      group.add(canopy);
    }
  }

  for (let i = 0; i < 36; i++) {
    const x = -65 + Math.random() * 130;
    const z = -60 + Math.random() * 130;
    factory.box(group, { position: new THREE.Vector3(x, 0.45, z), size: new THREE.Vector3(1.6 + Math.random() * 3.2, 0.9, 1.2 + Math.random() * 2.4), color: i % 2 ? 0x315229 : 0x25451f, name: 'jungle-bramble' });
  }

  const glowColors = [0x78ff65, 0x35caff, 0xff6ec7];
  for (let i = 0; i < 26; i++) {
    const mushroom = new THREE.Mesh(new THREE.SphereGeometry(0.32 + Math.random() * 0.24, 8, 6), factory.emissive(glowColors[i % glowColors.length], 1.2));
    mushroom.position.set(-52 + Math.random() * 104, 0.34, -54 + Math.random() * 108);
    mushroom.scale.y = 0.5;
    group.add(mushroom);
  }

  const vineMat = factory.emissive(0x3cff65, 0.65);
  for (let i = 0; i < 18; i++) {
    const vine = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.5 + Math.random() * 3.0, 0.08), vineMat);
    vine.position.set(-42 + Math.random() * 92, 4.0 + Math.random() * 4.0, -56 + Math.random() * 72);
    vine.rotation.z = (Math.random() - 0.5) * 0.32;
    group.add(vine);
  }

  const portalMesh = factory.portal(group, { position: new THREE.Vector3(52, 2.4, -47), color: 0xffd166, rotationY: -Math.PI * 0.28, name: 'jungle-egypt-portal' });

  return {
    group,
    spawn: new THREE.Vector3(6, 1.7, 52),
    fog: new THREE.FogExp2(0x17351b, 0.018),
    background: 0x102712,
    enemyTheme: 'jungle',
    portals: [{ mesh: portalMesh, position: portalMesh.position, radius: 2.4, targetLevel: 'desert', target: new THREE.Vector3(-48, 1.7, 42), label: 'Egypt' }]
  };
}
