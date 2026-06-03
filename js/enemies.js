// ============================================================
//  ENEMY FACTORY — faceted rock golems
//  Low-poly slate-purple boulders, glowing magenta eyes, mossy
//  brows with sprouts, green moss drips, big stone knuckle-fists.
//  Each builder returns a THREE.Group with:
//    userData.parts  { legs[], arms[], head, orb? }  (for animation)
//    userData.cores  [materials]                      (for hit-flash)
//    userData.eyeHeight                               (shot origin / aim)
// ============================================================
const _G = {}; // shared geometry cache (filled lazily once THREE exists)
function _geos() {
  if (_G.ico) return _G;
  _G.ico = new THREE.IcosahedronGeometry(1, 0);
  _G.dod = new THREE.DodecahedronGeometry(1, 0);
  _G.oct = new THREE.OctahedronGeometry(1, 0);
  _G.box = new THREE.BoxGeometry(1, 1, 1);
  _G.cone = new THREE.ConeGeometry(1, 1, 5);
  _G.cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
  return _G;
}

const EnemyFactory = {
  // base stats (HP scales with wave in game.js). glow = eye color.
  TYPES: {
    grunt:   { hp: 60,  speed: 4.2, dmg: 9,  scale: 1.0,  glow: 0xc24bff, melee: true,  score: 100 },
    runner:  { hp: 26,  speed: 8.6, dmg: 5,  scale: 0.72, glow: 0xff3bd0, melee: true,  score: 70  },
    tank:    { hp: 240, speed: 2.2, dmg: 22, scale: 1.5,  glow: 0xa24bff, melee: true,  score: 250 },
    shooter: { hp: 55,  speed: 2.9, dmg: 0,  scale: 1.0,  glow: 0x8a5bff, ranged: true, range: 28, projDmg: 13, fireRate: 1700, score: 180 },
    boss:    { hp: 1700,speed: 2.5, dmg: 34, scale: 1.0,  glow: 0xff2d95, ranged: true, range: 40, projDmg: 20, fireRate: 1150, boss: true, score: 2000 }
  },

  _skin: 'rock',
  _shades: [0x423d59, 0x4c4666, 0x36324a, 0x2b2840, 0x564f70],
  _desertShades: [0xcda971, 0xd8b87e, 0xb9905a, 0xe0c48c, 0xc2a064],
  _rock(shade) {
    if (this._skin === 'desert') {
      const s = this._desertShades[(Math.random() * this._desertShades.length) | 0];
      return new THREE.MeshStandardMaterial({ color: s, emissive: 0x3a2410, emissiveIntensity: 0.18, roughness: 1, metalness: 0.04, flatShading: true });
    }
    return new THREE.MeshStandardMaterial({ color: shade, roughness: 0.95, metalness: 0.05, flatShading: true });
  },
  // "moss" slot = accent: jungle green for rock golems, pharaoh gold for desert
  _moss() {
    if (this._skin === 'desert') return new THREE.MeshStandardMaterial({ color: 0xe6c34a, emissive: 0x6a4e0c, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.7, flatShading: true });
    return new THREE.MeshStandardMaterial({ color: 0x6f8f2c, roughness: 1, metalness: 0, flatShading: true });
  },
  _mossDark() {
    if (this._skin === 'desert') return new THREE.MeshStandardMaterial({ color: 0x1f4f8f, emissive: 0x0a2546, emissiveIntensity: 0.3, roughness: 0.6, metalness: 0.4, flatShading: true });
    return new THREE.MeshStandardMaterial({ color: 0x556e22, roughness: 1, metalness: 0, flatShading: true });
  },
  _eyeMat(hex) {
    const c = this._skin === 'desert' ? 0xffd35a : hex;
    return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.4, roughness: 0.4 });
  },

  // add a faceted rock chunk
  _chunk(parent, mat, x, y, z, sx, sy, sz, rx, ry, rz, geo) {
    const g = _geos();
    const m = new THREE.Mesh(geo || g.ico, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    m.rotation.set(rx || 0, ry || 0, rz || 0);
    m.castShadow = true;
    parent.add(m);
    return m;
  },

  // mossy ridge with sprouts (rock) / pharaoh nemes-stripe headdress (desert)
  _mossCrown(parent, y, z, spread, count) {
    const g = _geos();
    if (this._skin === 'desert') {
      // banded gold+blue nemes headdress cap
      const gold = this._moss(), blue = this._mossDark();
      this._chunk(parent, gold, 0, y, z, spread * 1.15, 0.18, 0.6, 0, 0, 0, g.box);
      const stripes = Math.max(3, count);
      for (let i = 0; i < stripes; i++) {
        const sx = (i / (stripes - 1) - 0.5) * spread * 2;
        this._chunk(parent, i % 2 ? blue : gold, sx, y + 0.1, z, spread * 0.12, 0.12, 0.62, 0, 0, 0, g.box);
      }
      // side flaps framing the face
      [-1, 1].forEach(s => this._chunk(parent, gold, s * spread * 1.05, y - 0.28, z + 0.18, 0.14, 0.5, 0.5, 0, 0, 0, g.box));
      return;
    }
    const moss = this._moss();
    const ridge = this._chunk(parent, moss, 0, y, z, spread, 0.12, 0.42, 0, 0, 0, g.box);
    for (let i = 0; i < count; i++) {
      const sx = (Math.random() - 0.5) * spread * 1.4;
      const stem = this._chunk(parent, this._mossDark(), sx, y + 0.12, z + (Math.random() - 0.5) * 0.3, 0.025, 0.18, 0.025, 0, 0, (Math.random() - 0.5) * 0.5, g.cyl);
      this._chunk(parent, moss, sx, y + 0.26, z + (Math.random() - 0.5) * 0.2, 0.07, 0.14, 0.02, Math.PI, 0, (Math.random() - 0.5) * 0.6, g.cone);
    }
    return ridge;
  },

  // drips under jaw (rock=moss vines, desert=hanging bandage/gold strips)
  _mossDrips(parent, y, z, w, n) {
    const g = _geos();
    const mat = this._skin === 'desert'
      ? new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 1, flatShading: true })
      : null;
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * w;
      const len = 0.14 + Math.random() * 0.28;
      this._chunk(parent, mat || this._mossDark(), x, y - len / 2, z + 0.02, this._skin === 'desert' ? 0.05 : 0.022, len, 0.022, 0, 0, 0, g.box);
    }
  },

  // two glowing diamond-slit eyes; pushes materials into cores
  _eyes(parent, cores, eyeMat, y, z, sep, sz) {
    const g = _geos();
    cores.push(eyeMat);
    this._chunk(parent, eyeMat, -sep, y, z, sz, sz * 0.6, sz * 0.5, 0, 0, Math.PI / 4, g.oct);
    this._chunk(parent, eyeMat, sep, y, z, sz, sz * 0.6, sz * 0.5, 0, 0, Math.PI / 4, g.oct);
  },

  build(type, skin) {
    _geos();
    this._skin = skin || 'rock';
    let g;
    switch (type) {
      case 'runner':  g = this._runner(); break;
      case 'tank':    g = this._tank(); break;
      case 'shooter': g = this._shooter(); break;
      case 'boss':    g = this._boss(); break;
      default:        g = this._grunt(); break;
    }
    g.userData.skin = this._skin;
    this._skin = 'rock';
    return g;
  },

  // pick a rock material
  _r(i) { return this._rock(this._shades[i % this._shades.length]); },

  // ---- GRUNT: canonical knuckle-walking boulder golem ----
  _grunt() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.grunt.glow;

    // legs (short rock stumps)
    const legL = this._chunk(grp, this._r(3), -0.26, 0.32, 0, 0.26, 0.34, 0.26);
    const legR = this._chunk(grp, this._r(3), 0.26, 0.32, 0, 0.26, 0.34, 0.26);

    // main body boulder + back/shoulder chunks
    this._chunk(grp, this._r(0), 0, 1.0, -0.05, 0.66, 0.6, 0.6, 0, 0.6, 0, g.dod);
    this._chunk(grp, this._r(2), -0.4, 1.2, -0.25, 0.3, 0.34, 0.3, 0.5, 1, 0);
    this._chunk(grp, this._r(4), 0.42, 1.25, -0.2, 0.28, 0.3, 0.28, 0, 0.4, 0.3);

    // face block (forward-leaning) + brow recess
    const face = this._chunk(grp, this._r(1), 0, 1.18, 0.42, 0.5, 0.44, 0.34, -0.12, 0, 0, g.box);
    this._chunk(grp, this._r(3), 0, 1.42, 0.46, 0.56, 0.16, 0.3, -0.2, 0, 0, g.box); // brow
    this._eyes(grp, cores, this._eyeMat(glow), 1.26, 0.62, 0.16, 0.12);
    this._mossCrown(grp, 1.56, -0.05, 0.5, 3);
    this._mossDrips(grp, 1.0, 0.55, 0.4, 5);

    // big arms / knuckle fists reaching to the ground
    const armL = this._makeArm(grp, -0.62, 1.15, 0.05, 1);
    const armR = this._makeArm(grp, 0.62, 1.15, 0.05, -1);

    grp.userData.parts = { legs: [legL, legR], arms: [armL, armR], head: face };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 1.26;
    return grp;
  },

  _makeArm(parent, x, y, z, side) {
    const g = _geos();
    const arm = new THREE.Group();
    arm.position.set(x, y, z);
    // upper arm chunk
    this._chunk(arm, this._r(2), 0, -0.25, 0, 0.2, 0.4, 0.2, 0, 0, side * 0.15);
    // big fist near ground
    this._chunk(arm, this._r(0), side * 0.05, -0.62, 0.12, 0.32, 0.32, 0.32, 0.3, 0.5, 0, g.dod);
    arm.castShadow = true;
    parent.add(arm);
    return arm;
  },

  // ---- RUNNER: small fast rolling boulder ----
  _runner() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.runner.glow;

    this._chunk(grp, this._r(0), 0, 0.5, 0, 0.5, 0.46, 0.5, 0.3, 0.8, 0.2, g.dod);
    this._chunk(grp, this._r(2), -0.25, 0.62, -0.1, 0.22, 0.24, 0.22);
    this._chunk(grp, this._r(4), 0.22, 0.4, 0.18, 0.2, 0.2, 0.2);
    // face front
    this._chunk(grp, this._r(3), 0, 0.5, 0.4, 0.34, 0.12, 0.2, -0.2, 0, 0, g.box); // brow
    this._eyes(grp, cores, this._eyeMat(glow), 0.46, 0.5, 0.12, 0.09);
    this._mossCrown(grp, 0.78, -0.05, 0.32, 2);
    this._mossDrips(grp, 0.34, 0.46, 0.26, 3);

    // four stubby rock legs
    const legs = [];
    [[-0.28, 0.22], [0.28, 0.22], [-0.26, -0.18], [0.26, -0.18]].forEach(([lx, lz]) => {
      legs.push(this._chunk(grp, this._r(3), lx, 0.16, lz, 0.13, 0.22, 0.13));
    });

    grp.userData.parts = { legs, arms: [], head: null };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 0.5;
    grp.userData.crawl = true;
    return grp;
  },

  // ---- TANK: hulking mountain golem ----
  _tank() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.tank.glow;

    const legL = this._chunk(grp, this._r(3), -0.42, 0.4, 0, 0.36, 0.42, 0.36);
    const legR = this._chunk(grp, this._r(3), 0.42, 0.4, 0, 0.36, 0.42, 0.36);

    // massive body with many chunks
    this._chunk(grp, this._r(0), 0, 1.3, -0.1, 0.95, 0.85, 0.85, 0, 0.5, 0, g.dod);
    this._chunk(grp, this._r(2), -0.62, 1.7, -0.3, 0.42, 0.5, 0.42, 0.4, 1, 0);
    this._chunk(grp, this._r(4), 0.66, 1.75, -0.25, 0.4, 0.46, 0.4, 0, 0.6, 0.3);
    this._chunk(grp, this._r(1), 0, 2.0, -0.15, 0.4, 0.36, 0.4, 0.3, 0.2, 0.2);

    // face
    this._chunk(grp, this._r(1), 0, 1.42, 0.66, 0.7, 0.6, 0.42, -0.12, 0, 0, g.box);
    this._chunk(grp, this._r(3), 0, 1.74, 0.7, 0.78, 0.2, 0.36, -0.2, 0, 0, g.box); // brow
    this._eyes(grp, cores, this._eyeMat(glow), 1.52, 0.92, 0.22, 0.16);
    this._mossCrown(grp, 1.96, -0.1, 0.7, 4);
    this._mossDrips(grp, 1.18, 0.78, 0.56, 6);

    const armL = this._makeBigArm(grp, -0.95, 1.5, 0.08, 1);
    const armR = this._makeBigArm(grp, 0.95, 1.5, 0.08, -1);

    grp.userData.parts = { legs: [legL, legR], arms: [armL, armR], head: null };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 1.52;
    return grp;
  },

  _makeBigArm(parent, x, y, z, side) {
    const g = _geos();
    const arm = new THREE.Group(); arm.position.set(x, y, z);
    this._chunk(arm, this._r(2), 0, -0.35, 0, 0.32, 0.6, 0.32, 0, 0, side * 0.12);
    this._chunk(arm, this._r(0), side * 0.08, -0.92, 0.14, 0.5, 0.5, 0.5, 0.3, 0.5, 0, g.dod);
    parent.add(arm);
    return arm;
  },

  // ---- SHOOTER: golem that charges a glowing core in its hands ----
  _shooter() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.shooter.glow;

    const legL = this._chunk(grp, this._r(3), -0.24, 0.3, 0, 0.24, 0.32, 0.24);
    const legR = this._chunk(grp, this._r(3), 0.24, 0.3, 0, 0.24, 0.32, 0.24);

    this._chunk(grp, this._r(0), 0, 1.0, -0.05, 0.6, 0.62, 0.55, 0, 0.7, 0, g.dod);
    this._chunk(grp, this._r(2), -0.36, 1.25, -0.2, 0.26, 0.3, 0.26);
    // face
    this._chunk(grp, this._r(1), 0, 1.2, 0.4, 0.46, 0.42, 0.32, -0.12, 0, 0, g.box);
    this._chunk(grp, this._r(3), 0, 1.44, 0.44, 0.52, 0.15, 0.28, -0.2, 0, 0, g.box);
    this._eyes(grp, cores, this._eyeMat(glow), 1.28, 0.58, 0.15, 0.11);
    this._mossCrown(grp, 1.56, -0.05, 0.46, 3);

    // arms cupped forward holding a charge orb
    this._chunk(grp, this._r(2), -0.5, 1.0, 0.35, 0.18, 0.4, 0.18, 0.8, 0, 0.2);
    this._chunk(grp, this._r(2), 0.5, 1.0, 0.35, 0.18, 0.4, 0.18, 0.8, 0, -0.2);
    const orbMat = this._eyeMat(glow); orbMat.emissiveIntensity = 2.0;
    cores.push(orbMat);
    const orb = this._chunk(grp, orbMat, 0, 0.95, 0.6, 0.2, 0.2, 0.2, 0, 0, 0, g.ico);

    grp.userData.parts = { legs: [legL, legR], arms: [], head: null, orb };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 1.0;
    return grp;
  },

  // ---- BOSS: colossal four-eyed golem ----
  _boss() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.boss.glow;

    const legL = this._chunk(grp, this._r(3), -0.7, 0.7, 0, 0.55, 0.72, 0.55);
    const legR = this._chunk(grp, this._r(3), 0.7, 0.7, 0, 0.55, 0.72, 0.55);

    // enormous body
    this._chunk(grp, this._r(0), 0, 2.4, -0.15, 1.5, 1.4, 1.3, 0, 0.5, 0, g.dod);
    this._chunk(grp, this._r(2), -1.0, 3.1, -0.4, 0.66, 0.8, 0.66, 0.4, 1, 0);
    this._chunk(grp, this._r(4), 1.05, 3.15, -0.35, 0.64, 0.74, 0.64, 0, 0.6, 0.3);
    this._chunk(grp, this._r(1), 0, 3.5, -0.2, 0.7, 0.6, 0.7, 0.3, 0.2, 0.2);

    // face
    this._chunk(grp, this._r(1), 0, 2.6, 1.05, 1.1, 0.95, 0.6, -0.1, 0, 0, g.box);
    this._chunk(grp, this._r(3), 0, 3.05, 1.1, 1.2, 0.3, 0.5, -0.2, 0, 0, g.box); // heavy brow
    // four eyes (two pairs)
    const eMat = this._eyeMat(glow); cores.push(eMat);
    [[-0.5, 2.78], [0.5, 2.78], [-0.26, 2.5], [0.26, 2.5]].forEach(([ex, ey]) => {
      this._chunk(grp, eMat, ex, ey, 1.45, 0.2, 0.13, 0.1, 0, 0, Math.PI / 4, g.oct);
    });
    this._mossCrown(grp, 3.45, -0.15, 1.2, 7);
    this._mossDrips(grp, 2.1, 1.2, 0.95, 9);

    const armL = this._makeBigArm(grp, -1.55, 2.7, 0.1, 1); armL.scale.setScalar(1.5);
    const armR = this._makeBigArm(grp, 1.55, 2.7, 0.1, -1); armR.scale.setScalar(1.5);

    grp.userData.parts = { legs: [legL, legR], arms: [armL, armR], head: null };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 2.6;
    return grp;
  }
};
