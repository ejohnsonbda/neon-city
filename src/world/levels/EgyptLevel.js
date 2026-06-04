
import * as THREE from 'three';

export function createEgyptLevel({ factory }) {
  const group = new THREE.Group();
  group.name = 'Egypt Level';

  factory.box(group, { position: new THREE.Vector3(0, -0.08, 0), size: new THREE.Vector3(210, 0.16, 210), color: 0xcaa56a, name: 'egypt-sand-floor' });

  const duneMat = factory.material(0xd8bd82, { roughness: 0.96, metalness: 0.02 });
  for (let i = 0; i < 18; i++) {
    const x = (Math.random() - 0.5) * 170;
    const z = (Math.random() - 0.5) * 170;
    const dune = new THREE.Mesh(new THREE.CylinderGeometry(5 + Math.random() * 8, 8 + Math.random() * 10, 1.0 + Math.random() * 1.8, 6), duneMat);
    dune.position.set(x, 0.15, z);
    dune.scale.y = 0.26;
    dune.rotation.y = Math.random() * Math.PI;
    dune.castShadow = false;
    dune.receiveShadow = true;
    group.add(dune);
  }

  const stone = factory.material(0xb78f54, { roughness: 0.88, metalness: 0.04 });
  const darkStone = factory.material(0x8d6d43, { roughness: 0.92, metalness: 0.02 });
  const gold = factory.emissive(0xffd166, 0.65);

  const pyramidData = [
    { x: -34, z: -30, radius: 17, height: 22 },
    { x: 20, z: -38, radius: 13, height: 17 },
    { x: 48, z: 20, radius: 9, height: 12 }
  ];
  for (const p of pyramidData) {
    const pyramid = new THREE.Mesh(new THREE.CylinderGeometry(0, p.radius, p.height, 4), stone);
    pyramid.position.set(p.x, p.height / 2, p.z);
    pyramid.rotation.y = Math.PI / 4;
    pyramid.castShadow = true;
    pyramid.receiveShadow = true;
    pyramid.name = 'egypt-pyramid';
    group.add(pyramid);
    factory.box(group, { position: new THREE.Vector3(p.x, p.height * 0.18, p.z), size: new THREE.Vector3(p.radius * 1.25, p.height * 0.36, p.radius * 1.25), collider: true, name: 'egypt-pyramid-collider', material: stone });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, p.radius * 0.16, p.height * 0.16, 4), gold);
    cap.position.set(p.x, p.height * 0.93, p.z);
    cap.rotation.y = Math.PI / 4;
    group.add(cap);
  }

  for (const [x, z] of [[-12, 18], [-6, 18], [6, 18], [12, 18], [-16, 28], [16, 28]]) {
    factory.cylinder(group, { position: new THREE.Vector3(x, 3.4, z), radius: 0.78, depth: 6.8, radialSegments: 12, color: 0xb98d55, collider: true, name: 'egypt-temple-column' });
    factory.box(group, { position: new THREE.Vector3(x, 6.95, z), size: new THREE.Vector3(2.5, 0.45, 2.5), color: 0x8d6d43, name: 'egypt-column-cap' });
  }
  factory.box(group, { position: new THREE.Vector3(0, 0.7, 26), size: new THREE.Vector3(42, 1.4, 6), color: 0x9a7848, name: 'egypt-temple-step' });
  factory.box(group, { position: new THREE.Vector3(0, 2.25, 31), size: new THREE.Vector3(32, 3.0, 6), color: 0xb78f54, name: 'egypt-temple-wall' });

  for (const [x, z, h] of [[-46, 30, 11], [46, 30, 11], [-62, -8, 8], [64, -4, 9], [-18, 52, 7]]) {
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.0, h, 4), stone);
    obelisk.position.set(x, h / 2, z);
    obelisk.rotation.y = Math.PI / 4;
    obelisk.castShadow = true;
    obelisk.receiveShadow = true;
    group.add(obelisk);
    factory.box(group, { position: new THREE.Vector3(x, h / 2, z), size: new THREE.Vector3(1.5, h, 1.5), color: 0xb78f54, name: 'egypt-obelisk-collider' });
  }

  const sphinx = new THREE.Group();
  sphinx.name = 'egypt-sphinx';
  const body = new THREE.Mesh(new THREE.BoxGeometry(9.5, 2.4, 16), darkStone);
  body.position.y = 1.2;
  sphinx.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.2, 18, 12), stone);
  head.position.set(0, 4.1, -5.2);
  head.scale.set(1.05, 1.1, 0.85);
  sphinx.add(head);
  sphinx.position.set(-6, 0, 53);
  sphinx.traverse((object) => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  group.add(sphinx);
  factory.box(group, { position: new THREE.Vector3(-6, 1.3, 53), size: new THREE.Vector3(10, 2.6, 16), color: 0x8d6d43, name: 'egypt-sphinx-collider' });

  for (let i = 0; i < 28; i++) {
    const x = (Math.random() - 0.5) * 150;
    const z = (Math.random() - 0.5) * 150;
    if (Math.abs(x) < 18 && Math.abs(z - 24) < 24) continue;
    factory.box(group, { position: new THREE.Vector3(x, 0.5, z), size: new THREE.Vector3(2 + Math.random() * 4, 1.0, 1.4 + Math.random() * 2.8), color: i % 2 ? 0xa78351 : 0x7f653f, name: 'egypt-cover-block' });
  }

  const portalMesh = factory.portal(group, { position: new THREE.Vector3(-54, 2.4, 42), color: 0x78ff65, rotationY: Math.PI * 0.18, name: 'egypt-jungle-portal' });

  return {
    group,
    spawn: new THREE.Vector3(0, 1.7, 64),
    fog: new THREE.FogExp2(0xd2b27a, 0.0062),
    background: 0xc69b63,
    enemyTheme: 'desert',
    portals: [{ mesh: portalMesh, position: portalMesh.position, radius: 2.4, targetLevel: 'lost-jungle', target: new THREE.Vector3(48, 1.7, -46), label: 'Lost Jungle' }]
  };
}
