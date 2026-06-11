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
    dragon:  { hp: 520, speed: 6.0, dmg: 0,  scale: 1.5,  glow: 0xff5a1e, ranged: true, range: 30, projDmg: 17, fireRate: 1450, fly: true, altitude: 7.0, score: 700 },
    boss:    { hp: 1700,speed: 2.5, dmg: 34, scale: 1.0,  glow: 0xff2d95, ranged: true, range: 40, projDmg: 20, fireRate: 1150, boss: true, score: 2000 },
    spider:  { hp: 3200,speed: 3.6, dmg: 42, scale: 1.4,  glow: 0x8bff36, melee: true, boss: true, score: 4000 },
    // ---- tree goblins (woodland menaces) ----
    sapling: { hp: 34,  speed: 7.4, dmg: 6,  scale: 0.7,  glow: 0x9be84a, melee: true,  score: 90  },
    bramble: { hp: 95,  speed: 4.0, dmg: 12, scale: 1.0,  glow: 0xc6f23a, melee: true,  score: 160 },
    treant:  { hp: 300, speed: 2.0, dmg: 20, scale: 1.6,  glow: 0x6fd83a, ranged: true, range: 22, projDmg: 14, fireRate: 1900, score: 320 }
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
    m.castShadow = !window.__NEON_LOW_MEMORY;
    parent.add(m);
    return m;
  },

  // mossy ridge with sprouts (rock) / pharaoh nemes-stripe headdress (desert)
  _mossCrown(parent, y, z, spread, count) {
    const g = _geos();
    if (window.__NEON_LOW_MEMORY) count = Math.max(1, Math.ceil(count * 0.45));
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
      case 'dragon':  g = this._dragon(); break;
      case 'spider':  g = this._spider(); break;
      case 'sapling': g = this._sapling(); break;
      case 'bramble': g = this._bramble(); break;
      case 'treant':  g = this._treant(); break;
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

    // tall, elongated legs (digitigrade stance)
    const legL = this._chunk(grp, this._r(3), -0.26, 0.62, 0.02, 0.2, 0.66, 0.2, -0.12, 0, 0);
    const legR = this._chunk(grp, this._r(3), 0.26, 0.62, 0.02, 0.2, 0.66, 0.2, -0.12, 0, 0);
    // clawed feet
    this._chunk(grp, this._r(4), -0.26, 0.12, 0.16, 0.22, 0.14, 0.32);
    this._chunk(grp, this._r(4), 0.26, 0.12, 0.16, 0.22, 0.14, 0.32);

    // tapering robe / lower body
    this._chunk(grp, this._r(2), 0, 1.18, -0.04, 0.5, 0.5, 0.46, 0, 0.4, 0, g.dod);
    // slender elongated torso, slightly hunched forward
    this._chunk(grp, this._r(0), 0, 1.92, 0.04, 0.42, 0.66, 0.4, 0.12, 0.6, 0, g.dod);
    // hunched shoulder / cloak chunks rising behind the head
    this._chunk(grp, this._r(2), -0.46, 2.32, -0.22, 0.3, 0.42, 0.3, 0.3, 1, 0);
    this._chunk(grp, this._r(4), 0.46, 2.36, -0.2, 0.3, 0.46, 0.3, 0, 0.6, 0.3);
    this._chunk(grp, this._r(1), 0, 2.5, -0.26, 0.34, 0.4, 0.3, 0.4, 0.2, 0.2);

    // long neck
    this._chunk(grp, this._r(3), 0, 2.5, 0.1, 0.2, 0.4, 0.2, 0.2, 0, 0);
    // tall narrow head raised high, leaning forward
    const head = this._chunk(grp, this._r(1), 0, 2.92, 0.18, 0.34, 0.5, 0.32, -0.1, 0, 0, g.box);
    // deep brow ridge
    this._chunk(grp, this._r(3), 0, 3.18, 0.22, 0.4, 0.16, 0.3, -0.22, 0, 0, g.box);
    // glowing eyes up high
    this._eyes(grp, cores, this._eyeMat(glow), 3.0, 0.38, 0.12, 0.1);
    // tall horned crown
    this._mossCrown(grp, 3.42, 0.0, 0.4, 4);
    this._chunk(grp, this._r(4), 0, 3.62, -0.02, 0.06, 0.4, 0.06, 0, 0, 0.18, g.cone);
    // hanging vine drips from the jaw
    this._mossDrips(grp, 2.7, 0.32, 0.32, 4);

    // long arms cupped forward holding a charge orb at chest height
    this._chunk(grp, this._r(2), -0.5, 1.9, 0.12, 0.16, 0.5, 0.16, 0.5, 0, 0.28);
    this._chunk(grp, this._r(2), 0.5, 1.9, 0.12, 0.16, 0.5, 0.16, 0.5, 0, -0.28);
    // forearms reaching in toward the orb
    this._chunk(grp, this._r(4), -0.34, 1.52, 0.42, 0.13, 0.34, 0.13, 1.1, 0, 0.3);
    this._chunk(grp, this._r(4), 0.34, 1.52, 0.42, 0.13, 0.34, 0.13, 1.1, 0, -0.3);

    // glowing charge orb
    const orbMat = this._eyeMat(glow); orbMat.emissiveIntensity = 2.2;
    cores.push(orbMat);
    const orb = this._chunk(grp, orbMat, 0, 1.46, 0.62, 0.22, 0.22, 0.22, 0, 0, 0, g.ico);

    grp.userData.parts = { legs: [legL, legR], arms: [], head, orb };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 2.55;
    return grp;
  },

  // ---- DRAGON: long serpentine flying stone wyrm ----
  _dragon() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.dragon.glow; // ember orange
    const membrane = () => new THREE.MeshStandardMaterial({ color: 0x2a2230, roughness: 1, metalness: 0.1, side: THREE.DoubleSide, flatShading: true });

    // ----- long sinuous body: many segments along an S-curve (tail -> neck) -----
    const N = 14;
    const segments = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);                                  // 0 tail .. 1 neck base
      const z = -4.0 + t * 4.6;
      const x = Math.sin(t * Math.PI * 2.2) * 0.55 * Math.sin(t * Math.PI); // lateral wave, fades at ends
      const y = 0.95 + Math.sin(t * Math.PI * 1.4) * 0.2;
      const r = 0.15 + Math.sin(t * Math.PI) * 0.5;           // fat middle, tapered ends
      const mat = (i % 4 === 1) ? this._r(2) : (i % 4 === 3 ? this._r(4) : this._r(0));
      const seg = this._chunk(grp, mat, x, y, z, r, r * 0.9, r * 1.18, 0, 0, 0, g.dod);
      seg.userData.base = { x, y, z };
      segments.push(seg);
      // spine ridge spikes on the upper back
      if (t > 0.18 && t < 0.96 && i % 2 === 0)
        this._chunk(grp, this._r(4), x, y + r * 0.85, z, 0.06, 0.2 + r * 0.25, 0.06, 0.25, 0, 0, g.cone);
      // glowing belly cores
      if (i % 3 === 0 && t < 0.85) {
        const bm = this._eyeMat(glow); bm.emissiveIntensity = 1.1; cores.push(bm);
        this._chunk(grp, bm, x, y - r * 0.72, z + 0.04, r * 0.42, r * 0.24, r * 0.55);
      }
    }
    // tail fin at the very back
    this._chunk(grp, this._moss(), 0, 0.95, -4.4, 0.06, 0.36, 0.42, 0, 0, 0, g.box);
    this._chunk(grp, this._moss(), 0, 0.95, -4.42, 0.36, 0.06, 0.42, 0, 0, 0, g.box);

    // ----- arching neck rising to the head -----
    this._chunk(grp, this._r(1), 0, 1.28, 0.92, 0.36, 0.4, 0.5, -0.4, 0, 0);
    this._chunk(grp, this._r(3), 0, 1.72, 1.3, 0.3, 0.34, 0.46, -0.5, 0, 0);
    const head = this._chunk(grp, this._r(1), 0, 2.0, 1.7, 0.34, 0.32, 0.54, -0.2, 0, 0, g.box);
    this._chunk(grp, this._r(3), 0, 1.9, 2.04, 0.24, 0.22, 0.36, -0.12, 0, 0, g.box); // snout
    // glowing maw (orb flares before fire breath)
    const orbMat = this._eyeMat(glow); orbMat.emissiveIntensity = 2.1; cores.push(orbMat);
    const orb = this._chunk(grp, orbMat, 0, 1.85, 2.2, 0.14, 0.11, 0.14, 0, 0, 0, g.ico);
    // swept-back horns
    this._chunk(grp, this._r(4), -0.16, 2.24, 1.56, 0.05, 0.46, 0.05, -0.6, 0, -0.3, g.cone);
    this._chunk(grp, this._r(4), 0.16, 2.24, 1.56, 0.05, 0.46, 0.05, -0.6, 0, 0.3, g.cone);
    // long serpent barbels (whiskers) trailing from the snout
    this._chunk(grp, this._r(2), -0.2, 1.78, 2.1, 0.03, 0.5, 0.03, 0.5, 0, -0.4, g.cyl);
    this._chunk(grp, this._r(2), 0.2, 1.78, 2.1, 0.03, 0.5, 0.03, 0.5, 0, 0.4, g.cyl);
    // eyes
    this._eyes(grp, cores, this._eyeMat(glow), 2.04, 1.88, 0.16, 0.08);

    // ----- modest mid-body wings (flap via groups) -----
    const wings = [];
    [-1, 1].forEach(s => {
      const wing = new THREE.Group();
      wing.position.set(s * 0.5, 1.35, 0.25);
      this._chunk(wing, this._r(2), s * 0.45, 0.04, -0.05, 0.5, 0.08, 0.1);
      this._chunk(wing, this._r(4), s * 0.85, 0.0, -0.25, 0.42, 0.05, 0.05, 0, 0.5 * s, 0);
      this._chunk(wing, membrane(), s * 0.7, -0.14, -0.12, 0.72, 0.5, 0.03, 0, 0, s * 0.12, g.box);
      this._chunk(wing, membrane(), s * 1.05, -0.1, 0.14, 0.45, 0.42, 0.03, 0, 0, s * 0.12, g.box);
      grp.add(wing); wings.push(wing);
    });

    grp.userData.parts = { legs: [], arms: [], head, orb, wings, segments };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 1.7;
    grp.userData.fly = true;
    return grp;
  },

  // ============================================================
  //  TREE GOBLINS — gnarled woodland creatures (bark + leaves)
  // ============================================================
  _bark(dark) {
    const c = dark ? 0x3a2a18 : 0x5a4326;
    return new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, flatShading: true });
  },
  _leaf(hex) {
    return new THREE.MeshStandardMaterial({ color: hex || 0x4f9e2c, roughness: 1, metalness: 0, flatShading: true });
  },
  _leafTuft(parent, x, y, z, s, hex) {
    const g = _geos();
    const tones = [hex || 0x4f9e2c, 0x68b83a, 0x3c7a22];
    for (let i = 0; i < 3; i++) {
      this._chunk(parent, this._leaf(tones[i % tones.length]),
        x + (Math.random() - 0.5) * s * 0.6, y + (Math.random() - 0.5) * s * 0.5, z + (Math.random() - 0.5) * s * 0.6,
        s * (0.7 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.5), 0, Math.random() * 3, 0, g.ico);
    }
  },

  // ---- SAPLING GOBLIN: tiny fast twig imp ----
  _sapling() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.sapling.glow;
    const bark = this._bark(false), barkD = this._bark(true);

    // twiggy legs
    const legL = this._chunk(grp, barkD, -0.12, 0.28, 0, 0.05, 0.56, 0.05, 0, 0, 0.12, g.cyl);
    const legR = this._chunk(grp, barkD, 0.12, 0.28, 0, 0.05, 0.56, 0.05, 0, 0, -0.12, g.cyl);
    // knotty little trunk-body
    this._chunk(grp, bark, 0, 0.72, 0, 0.2, 0.4, 0.2, 0, 0.5, 0, g.dod);
    // leaf collar + sprout tuft on head
    this._leafTuft(grp, 0, 1.12, 0, 0.16, glow);
    const head = this._chunk(grp, bark, 0, 0.96, 0.02, 0.16, 0.17, 0.16, 0, 0, 0, g.dod);
    // glowing eyes
    this._eyes(grp, cores, this._eyeMat(glow), 0.98, 0.15, 0.07, 0.05);
    // twig arms
    const armL = this._chunk(grp, barkD, -0.24, 0.78, 0, 0.04, 0.4, 0.04, 0, 0, 0.7, g.cyl);
    const armR = this._chunk(grp, barkD, 0.24, 0.78, 0, 0.04, 0.4, 0.04, 0, 0, -0.7, g.cyl);

    grp.userData.parts = { legs: [legL, legR], arms: [armL, armR], head };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 1.0;
    return grp;
  },

  // ---- BRAMBLE GOBLIN: thorny mid hunter ----
  _bramble() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.bramble.glow;
    const bark = this._bark(false), barkD = this._bark(true);

    const legL = this._chunk(grp, barkD, -0.2, 0.4, 0, 0.09, 0.8, 0.09, 0, 0, 0.06, g.cyl);
    const legR = this._chunk(grp, barkD, 0.2, 0.4, 0, 0.09, 0.8, 0.09, 0, 0, -0.06, g.cyl);
    // hunched gnarled torso
    this._chunk(grp, bark, 0, 1.1, -0.04, 0.34, 0.5, 0.34, 0, 0.6, 0, g.dod);
    this._chunk(grp, bark, -0.18, 1.35, -0.12, 0.18, 0.22, 0.18, 0.3, 0, 0); // shoulder knot
    // thorns bristling from the back
    [[-0.15, 1.25, -0.28], [0.12, 1.4, -0.26], [0, 1.55, -0.2], [-0.1, 1.5, -0.3]].forEach(([x, y, z]) =>
      this._chunk(grp, barkD, x, y, z, 0.04, 0.26, 0.04, -0.5 + Math.random(), 0, Math.random() - 0.5, g.cone));
    // leafy crown + brow
    this._leafTuft(grp, 0, 1.78, -0.05, 0.24, glow);
    const head = this._chunk(grp, bark, 0, 1.5, 0.08, 0.26, 0.26, 0.26, 0, 0, 0, g.dod);
    this._chunk(grp, barkD, 0, 1.62, 0.18, 0.3, 0.08, 0.16, -0.2, 0, 0, g.box); // brow
    this._eyes(grp, cores, this._eyeMat(glow), 1.5, 0.24, 0.1, 0.075);
    // jagged mouth glow
    const mawMat = this._eyeMat(glow); mawMat.emissiveIntensity = 1.2; cores.push(mawMat);
    this._chunk(grp, mawMat, 0, 1.4, 0.26, 0.14, 0.05, 0.05);
    // clawed branch arms
    const armL = this._makeBranchArm(grp, -0.36, 1.2, 0.05, 1, glow);
    const armR = this._makeBranchArm(grp, 0.36, 1.2, 0.05, -1, glow);

    grp.userData.parts = { legs: [legL, legR], arms: [armL, armR], head };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 1.5;
    return grp;
  },

  _makeBranchArm(parent, x, y, z, side, glow) {
    const g = _geos();
    const arm = new THREE.Group(); arm.position.set(x, y, z);
    this._chunk(arm, this._bark(true), side * 0.12, -0.28, 0, 0.06, 0.5, 0.06, 0, 0, side * 0.3, g.cyl);
    // three twig claws
    for (let i = -1; i <= 1; i++)
      this._chunk(arm, this._bark(true), side * 0.2, -0.56, i * 0.05, 0.03, 0.2, 0.03, 0.4, 0, side * (0.2 + i * 0.15), g.cone);
    arm.castShadow = true; parent.add(arm);
    return arm;
  },

  // ---- ELDER TREANT GOBLIN: big mossy tree-beast that hurls thorn-seeds ----
  _treant() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.treant.glow;
    const bark = this._bark(false), barkD = this._bark(true);

    // rooty splayed feet + thick legs
    const legL = this._chunk(grp, barkD, -0.34, 0.55, 0, 0.2, 1.1, 0.2, 0, 0, 0.04, g.cyl);
    const legR = this._chunk(grp, barkD, 0.34, 0.55, 0, 0.2, 1.1, 0.2, 0, 0, -0.04, g.cyl);
    this._chunk(grp, barkD, -0.34, 0.06, 0.16, 0.34, 0.16, 0.5);
    this._chunk(grp, barkD, 0.34, 0.06, 0.16, 0.34, 0.16, 0.5);
    // massive gnarled trunk
    this._chunk(grp, bark, 0, 1.7, -0.05, 0.62, 0.9, 0.58, 0, 0.4, 0, g.dod);
    this._chunk(grp, bark, -0.2, 2.1, -0.1, 0.3, 0.34, 0.3, 0.2, 1, 0); // burl
    this._chunk(grp, bark, 0.24, 2.0, -0.05, 0.26, 0.3, 0.26, 0, 0.6, 0.2);
    // hollow glowing face in the bark
    const faceMat = this._eyeMat(glow); faceMat.emissiveIntensity = 1.0; cores.push(faceMat);
    this._chunk(grp, faceMat, 0, 1.85, 0.5, 0.18, 0.3, 0.08); // glowing maw cavity
    this._chunk(grp, bark, 0, 2.1, 0.55, 0.5, 0.16, 0.18, -0.2, 0, 0, g.box); // heavy brow
    this._eyes(grp, cores, this._eyeMat(glow), 2.0, 0.52, 0.16, 0.1);
    // big leafy canopy crown
    this._leafTuft(grp, 0, 2.7, -0.1, 0.5, glow);
    this._leafTuft(grp, -0.4, 2.5, 0.0, 0.34, glow);
    this._leafTuft(grp, 0.42, 2.55, -0.05, 0.34, glow);
    // moss patches
    this._chunk(grp, this._leaf(0x3c6e2a), -0.3, 1.5, 0.4, 0.18, 0.24, 0.06, 0, 0, 0.3, g.box);
    // heavy branch arms (used to throw + swipe)
    const armL = this._makeTreantArm(grp, -0.68, 1.95, 0.05, 1, glow);
    const armR = this._makeTreantArm(grp, 0.68, 1.95, 0.05, -1, glow);
    // glowing seed orb cupped in right hand (flares before throwing)
    const orbMat = this._eyeMat(glow); orbMat.emissiveIntensity = 1.8; cores.push(orbMat);
    const orb = this._chunk(grp, orbMat, 0.78, 1.5, 0.3, 0.13, 0.13, 0.13, 0, 0, 0, g.ico);

    grp.userData.parts = { legs: [legL, legR], arms: [armL, armR], head: null, orb };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 2.0;
    return grp;
  },

  _makeTreantArm(parent, x, y, z, side, glow) {
    const g = _geos();
    const arm = new THREE.Group(); arm.position.set(x, y, z);
    this._chunk(arm, this._bark(false), 0, -0.4, 0, 0.16, 0.8, 0.16, 0, 0, side * 0.15, g.cyl);
    this._chunk(arm, this._bark(true), side * 0.06, -0.86, 0.1, 0.14, 0.14, 0.14, 0, 0, 0, g.dod);
    // twig fingers
    for (let i = -1; i <= 1; i++) this._chunk(arm, this._bark(true), side * 0.06 + i * 0.06, -1.02, 0.12, 0.03, 0.18, 0.03, 0.3, 0, 0, g.cone);
    this._leafTuft(arm, side * 0.15, -0.2, -0.05, 0.18, glow);
    arm.castShadow = true; parent.add(arm);
    return arm;
  },

  // ---- SUPER APEX SPIDER: giant 8-legged stone arachnid boss ----
  _spider() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.spider.glow; // venom green

    // ----- 8 long jointed legs (each a Group so the walk code can articulate it) -----
    const legs = [];
    const sideZ = [0.95, 0.35, -0.25, -0.85]; // four leg pairs, front -> back
    [-1, 1].forEach(side => {
      sideZ.forEach((lz, p) => {
        const leg = new THREE.Group();
        leg.position.set(side * 1.0, 2.0, lz);
        // upper segment angled up-and-out (femur)
        this._chunk(leg, this._r(3), side * 0.78, 0.52, 0, 0.17, 1.7, 0.17, 0, 0, side * 0.95);
        // knee joint
        this._chunk(leg, this._r(4), side * 1.5, 1.0, 0, 0.24, 0.24, 0.24);
        // lower segment angling down to the ground (tibia)
        this._chunk(leg, this._r(0), side * 1.85, -0.1, 0, 0.12, 2.0, 0.12, 0, 0, side * 0.5);
        // clawed foot
        this._chunk(leg, this._r(4), side * 2.18, -1.05, 0, 0.14, 0.34, 0.14, 0, 0, side * 0.2, g.cone);
        leg.castShadow = true;
        grp.add(leg); legs.push(leg);
      });
    });

    // ----- bulbous abdomen (raised at the rear) -----
    this._chunk(grp, this._r(0), 0, 2.7, -2.0, 1.75, 1.55, 2.0, 0, 0, 0, g.dod);
    this._chunk(grp, this._r(2), 0, 3.4, -2.5, 0.9, 0.8, 0.95, 0.3, 0.6, 0); // upper hump
    // glowing venom markings down the abdomen
    const markMat = this._eyeMat(glow); markMat.emissiveIntensity = 1.3; cores.push(markMat);
    [[-2.0, 0.0], [-2.6, 0.0], [-1.5, 0.0]].forEach(([z, x], i) => {
      this._chunk(grp, markMat, x, 2.7 + i * 0.04, z, 0.34 - i * 0.06, 0.12, 0.34 - i * 0.06, 0, 0, 0);
    });
    // dorsal spikes
    [-1.4, -1.9, -2.4].forEach(z => this._chunk(grp, this._r(4), 0, 3.7, z, 0.08, 0.42, 0.08, -0.2, 0, 0, g.cone));

    // ----- cephalothorax (front body) -----
    this._chunk(grp, this._r(1), 0, 2.15, 0.5, 1.35, 1.05, 1.35, 0, 0, 0, g.dod);
    // clustered glowing eyes (classic 8-eye arachnid arrangement)
    const eyeMat = this._eyeMat(glow); cores.push(eyeMat);
    [[-0.45, 2.62, 1.5], [0.45, 2.62, 1.5], [-0.2, 2.7, 1.62], [0.2, 2.7, 1.62],
     [-0.62, 2.42, 1.46], [0.62, 2.42, 1.46], [-0.34, 2.38, 1.66], [0.34, 2.38, 1.66]]
      .forEach(([x, y, z]) => this._chunk(grp, eyeMat, x, y, z, 0.14, 0.14, 0.1, 0, 0, Math.PI / 4, g.oct));
    // chelicerae (fang bases) + glowing venom fangs
    this._chunk(grp, this._r(3), -0.32, 1.6, 1.45, 0.22, 0.55, 0.32, 0.3, 0, 0);
    this._chunk(grp, this._r(3), 0.32, 1.6, 1.45, 0.22, 0.55, 0.32, 0.3, 0, 0);
    const fangMat = this._eyeMat(glow); fangMat.emissiveIntensity = 1.7; cores.push(fangMat);
    this._chunk(grp, fangMat, -0.3, 1.12, 1.56, 0.08, 0.34, 0.08, 0.35, 0, 0, g.cone);
    this._chunk(grp, fangMat, 0.3, 1.12, 1.56, 0.08, 0.34, 0.08, 0.35, 0, 0, g.cone);
    // small pedipalps under the jaw
    this._chunk(grp, this._r(2), -0.5, 1.7, 1.55, 0.1, 0.3, 0.1, 0.5, 0, -0.3, g.cyl);
    this._chunk(grp, this._r(2), 0.5, 1.7, 1.55, 0.1, 0.3, 0.1, 0.5, 0, 0.3, g.cyl);

    grp.userData.parts = { legs, arms: [], head: null };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 2.6;
    grp.userData.spider = true;
    return grp;
  },

  // ---- BOSS: colossal four-eyed, four-armed golem on long legs ----
  _boss() {
    const g = _geos();
    const grp = new THREE.Group();
    const cores = [];
    const glow = this.TYPES.boss.glow;

    // ----- long towering legs -----
    const legL = this._chunk(grp, this._r(3), -0.62, 1.5, 0, 0.46, 1.5, 0.46);
    const legR = this._chunk(grp, this._r(3), 0.62, 1.5, 0, 0.46, 1.5, 0.46);
    // knee joints
    this._chunk(grp, this._r(4), -0.62, 1.55, 0.12, 0.34, 0.34, 0.34);
    this._chunk(grp, this._r(4), 0.62, 1.55, 0.12, 0.34, 0.34, 0.34);
    // splayed talon feet
    this._chunk(grp, this._r(4), -0.62, 0.18, 0.28, 0.5, 0.22, 0.6);
    this._chunk(grp, this._r(4), 0.62, 0.18, 0.28, 0.5, 0.22, 0.6);

    // enormous body (lifted to sit atop the long legs)
    this._chunk(grp, this._r(0), 0, 3.7, -0.15, 1.5, 1.4, 1.3, 0, 0.5, 0, g.dod);
    this._chunk(grp, this._r(2), -1.0, 4.4, -0.4, 0.66, 0.8, 0.66, 0.4, 1, 0);
    this._chunk(grp, this._r(4), 1.05, 4.45, -0.35, 0.64, 0.74, 0.64, 0, 0.6, 0.3);
    this._chunk(grp, this._r(1), 0, 4.8, -0.2, 0.7, 0.6, 0.7, 0.3, 0.2, 0.2);
    // pelvis blending body to legs
    this._chunk(grp, this._r(2), 0, 2.9, -0.05, 0.95, 0.6, 0.85, 0, 0.3, 0, g.dod);

    // face
    this._chunk(grp, this._r(1), 0, 3.9, 1.05, 1.1, 0.95, 0.6, -0.1, 0, 0, g.box);
    this._chunk(grp, this._r(3), 0, 4.35, 1.1, 1.2, 0.3, 0.5, -0.2, 0, 0, g.box); // heavy brow
    // four eyes (two pairs)
    const eMat = this._eyeMat(glow); cores.push(eMat);
    [[-0.5, 4.08], [0.5, 4.08], [-0.26, 3.8], [0.26, 3.8]].forEach(([ex, ey]) => {
      this._chunk(grp, eMat, ex, ey, 1.45, 0.2, 0.13, 0.1, 0, 0, Math.PI / 4, g.oct);
    });
    this._mossCrown(grp, 4.75, -0.15, 1.2, 7);
    this._mossDrips(grp, 3.4, 1.2, 0.95, 9);

    // ----- four arms: upper pair + lower pair -----
    const armUL = this._makeBigArm(grp, -1.55, 4.0, 0.1, 1); armUL.scale.setScalar(1.5);
    const armUR = this._makeBigArm(grp, 1.55, 4.0, 0.1, -1); armUR.scale.setScalar(1.5);
    const armLL = this._makeBigArm(grp, -1.42, 3.05, 0.35, 1); armLL.scale.setScalar(1.2);
    const armLR = this._makeBigArm(grp, 1.42, 3.05, 0.35, -1); armLR.scale.setScalar(1.2);

    grp.userData.parts = { legs: [legL, legR], arms: [armUL, armUR, armLL, armLR], head: null };
    grp.userData.cores = cores;
    grp.userData.eyeHeight = 3.9;
    return grp;
  }
};
