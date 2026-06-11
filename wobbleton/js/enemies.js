// ============================================================
//  ENEMY FACTORY — violet-crystal & gray-stone golems for WOBBLETON
//  Toon-shaded cracked stone, glowing oval eyes.
//  build(type) -> THREE.Group.  userData.cores = [emissive mats]
//  userData.eyes = [pupil meshes] (wiggled by the game loop).
// ============================================================

// ---- shared golem textures (created lazily on first build) ----
let _golemTex = null;
function _createStoneTexture(baseA, baseB, crackColor) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, baseA); grad.addColorStop(1, baseB);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2500; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
  }
  for (let i = 0; i < 18; i++) {
    let x = Math.random() * size, y = Math.random() * size;
    ctx.beginPath(); ctx.moveTo(x, y);
    const steps = 5 + Math.floor(Math.random() * 7);
    for (let s = 0; s < steps; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.strokeStyle = crackColor; ctx.lineWidth = 1.2 + Math.random() * 1.6; ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.4, 1.4);
  return tex;
}
function _golemTextures() {
  if (_golemTex) return _golemTex;
  const data = new Uint8Array([38, 31, 53, 96, 85, 122, 165, 156, 194, 238, 235, 255]);
  const gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBFormat);
  gradientMap.needsUpdate = true; gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  _golemTex = {
    violet: _createStoneTexture('#7a73a0', '#2c2742', '#bb6bff'),
    gray: _createStoneTexture('#c5c7cf', '#6f7583', '#d9d7ff'),
    gradientMap,
  };
  return _golemTex;
}

const EnemyFactory = {
  TYPES: {
    grunt:   { scale: 1.05, hp: 36,  speed: 2.3, dmg: 9,  col: '#c5c7cf', range: 0,    fly: 0, points: 10 },
    runner:  { scale: 0.8,  hp: 18,  speed: 4.4, dmg: 6,  col: '#bb6bff', range: 0,    fly: 0, points: 12 },
    tank:    { scale: 1.7,  hp: 130, speed: 1.3, dmg: 22, col: '#c5c7cf', range: 0,    fly: 0, points: 30 },
    shooter: { scale: 1.05, hp: 30,  speed: 1.6, dmg: 14, col: '#bb6bff', range: 26,   fly: 0, points: 22 },
    dragon:  { scale: 1.5,  hp: 110, speed: 3.0, dmg: 16, col: '#c5c7cf', range: 30,   fly: 1, points: 40 },
    boss:    { scale: 2.6,  hp: 420, speed: 1.5, dmg: 30, col: '#cd6bff', range: 22,   fly: 0, points: 120 },
    spider:  { scale: 2.4,  hp: 600, speed: 2.2, dmg: 34, col: '#bb6bff', range: 0,    fly: 0, points: 200 },
    sapling: { scale: 0.7,  hp: 14,  speed: 3.8, dmg: 6,  col: '#bb6bff', range: 0,    fly: 0, points: 10 },
    bramble: { scale: 1.0,  hp: 48,  speed: 2.2, dmg: 12, col: '#c5c7cf', range: 0,    fly: 0, points: 18 },
    treant:  { scale: 1.6,  hp: 95,  speed: 1.2, dmg: 14, col: '#c5c7cf', range: 24,   fly: 0, points: 35 },
    monkey:  { scale: 0.9,  hp: 22,  speed: 4.2, dmg: 8,  col: '#bb6bff', range: 0,    fly: 0, points: 14 },
    slinger: { scale: 0.95, hp: 30,  speed: 2.4, dmg: 12, col: '#bb6bff', range: 24,   fly: 0, points: 22 },
    ape:     { scale: 2.1,  hp: 280, speed: 1.7, dmg: 26, col: '#c5c7cf', range: 0,    fly: 0, points: 90 },
    clown:   { scale: 1.05, hp: 34,  speed: 3.2, dmg: 11, col: '#bb6bff', range: 0,    fly: 0, points: 18 },
    jester:  { scale: 1.0,  hp: 30,  speed: 2.2, dmg: 13, col: '#bb6bff', range: 22,   fly: 0, points: 24 },
  },

  _GRAY_TYPES: ['grunt', 'tank', 'dragon', 'ape', 'treant', 'bramble'],
  _isGray(type) { return this._GRAY_TYPES.includes(type); },
  // primary cracked-stone body material (toon-shaded)
  _golemMat(type) {
    const t = _golemTextures(); const gray = this._isGray(type);
    return new THREE.MeshToonMaterial({
      color: gray ? 0xb6bac6 : 0x6f6797,
      map: gray ? t.gray : t.violet,
      gradientMap: t.gradientMap,
      emissive: gray ? 0x7877b1 : 0x54128c,
      emissiveIntensity: gray ? 0.12 : 0.3,
    });
  },
  // darker secondary chunks (wings, fangs, accents)
  _golemMatDark(type) {
    const t = _golemTextures(); const gray = this._isGray(type);
    return new THREE.MeshToonMaterial({
      color: gray ? 0x8f94a3 : 0x3e3958,
      map: gray ? t.gray : t.violet,
      gradientMap: t.gradientMap,
      emissive: gray ? 0x7877b1 : 0x54128c,
      emissiveIntensity: gray ? 0.12 : 0.3,
    });
  },
  // legacy helper kept for any stray callers: stone now means toon crystal
  _stone(col) {
    const t = _golemTextures();
    return new THREE.MeshToonMaterial({ color: col, map: t.violet, gradientMap: t.gradientMap });
  },
  _glow(col, i) { return new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: i || 1.2, roughness: 0.5, flatShading: true }); },
  _wood(col) { return new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0, flatShading: true }); },
  _add(g, geo, mat, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    m.castShadow = true; g.add(m); return m;
  },
  // glowing stretched-oval crystal eye; the mesh itself is wiggled by the game
  _eye(g, x, y, z, r) {
    g.userData.eyes = g.userData.eyes || [];
    const col = g.userData.golemGray ? 0xdedbff : 0xcd6bff;
    const mat = new THREE.MeshBasicMaterial({ color: col });
    const eye = this._add(g, new THREE.SphereGeometry(r, 12, 8), mat, x, y, z, 1.9, 0.45, 0.45);
    eye.castShadow = false;
    eye.userData.base = new THREE.Vector3(x, y, z); eye.userData.rr = r;
    g.userData.eyes.push(eye);
    return eye;
  },
  _mouth(g, col, x, y, z, w, h) {
    g.userData.cores = g.userData.cores || [];
    const m = this._add(g, new THREE.BoxGeometry(w, h, 0.06), this._glow(col, 1.0), x, y, z);
    g.userData.cores.push(m.material); return m;
  },

  build(type) {
    const c = this.TYPES[type] ? this.TYPES[type].col : '#c5c7cf';
    switch (type) {
      case 'runner':  return this._runner(c, type);
      case 'tank':    return this._tank(c, type);
      case 'shooter': return this._shooter(c, type);
      case 'dragon':  return this._dragon(c, type);
      case 'boss':    return this._boss(c, type);
      case 'spider':  return this._spider(c, type);
      // every foe in Wobbleton is a golem now — stage variety comes from
      // each type's palette, scale and stats rather than different species
      case 'sapling': return this._runner(c, type);
      case 'bramble': return this._grunt(c, type);
      case 'treant':  return this._shooter(c, type);
      case 'monkey':  return this._runner(c, type);
      case 'slinger': return this._shooter(c, type);
      case 'ape':     return this._tank(c, type);
      case 'clown':   return this._grunt(c, type);
      case 'jester':  return this._shooter(c, type);
      default:        return this._grunt(c, 'grunt');
    }
  },

  // ---- GOLEMS (cracked stone, glowing crystal eyes) ----
  _grunt(c, type) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    g.userData.golemGray = this._isGray(type);
    const rock = this._golemMat(type);
    this._add(g, new THREE.IcosahedronGeometry(0.62, 0), rock, 0, 0.95, 0, 1, 1.15, 0.95);
    this._add(g, new THREE.DodecahedronGeometry(0.42, 0), rock, 0, 1.7, 0.04);
    [-0.62, 0.62].forEach(s => { this._add(g, new THREE.IcosahedronGeometry(0.3, 0), rock, s, 1.0, 0.18); this._add(g, new THREE.BoxGeometry(0.16, 0.5, 0.16), rock, s, 0.55, 0.1); });
    [-0.26, 0.26].forEach(s => this._add(g, new THREE.BoxGeometry(0.28, 0.55, 0.3), rock, s, 0.28, 0));
    this._eye(g, -0.16, 1.78, 0.32, 0.17); this._eye(g, 0.16, 1.78, 0.32, 0.17);
    this._mouth(g, c, 0, 1.5, 0.36, 0.3, 0.08);
    this._moss(g, 1.95);
    return g;
  },
  _runner(c, type) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    g.userData.golemGray = this._isGray(type);
    const rock = this._golemMat(type);
    this._add(g, new THREE.IcosahedronGeometry(0.5, 0), rock, 0, 0.55, 0, 1.2, 0.85, 1.1);
    [[-0.4,-0.3],[0.4,-0.3],[-0.4,0.3],[0.4,0.3]].forEach(p => this._add(g, new THREE.BoxGeometry(0.1, 0.5, 0.1), rock, p[0], 0.25, p[1]));
    this._eye(g, -0.18, 0.66, 0.4, 0.18); this._eye(g, 0.18, 0.66, 0.4, 0.18);
    return g;
  },
  _tank(c, type) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    g.userData.golemGray = this._isGray(type);
    const rock = this._golemMat(type);
    this._add(g, new THREE.DodecahedronGeometry(0.95, 0), rock, 0, 1.3, 0, 1, 1.1, 1);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; this._add(g, new THREE.IcosahedronGeometry(0.42, 0), rock, Math.cos(a) * 0.85, 1.3 + Math.sin(a) * 0.3, Math.sin(a) * 0.3); }
    this._add(g, new THREE.DodecahedronGeometry(0.5, 0), rock, 0, 2.4, 0.1);
    [-0.7, 0.7].forEach(s => this._add(g, new THREE.IcosahedronGeometry(0.42, 0), rock, s, 1.0, 0.15));
    [-0.35, 0.35].forEach(s => this._add(g, new THREE.BoxGeometry(0.4, 0.6, 0.42), rock, s, 0.35, 0));
    this._eye(g, -0.22, 2.5, 0.42, 0.2); this._eye(g, 0.22, 2.5, 0.42, 0.2);
    this._mouth(g, c, 0, 2.15, 0.45, 0.5, 0.1);
    this._moss(g, 2.75);
    return g;
  },
  _shooter(c, type) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = []; g.userData.parts = {};
    g.userData.golemGray = this._isGray(type);
    const rock = this._golemMat(type);
    this._add(g, new THREE.ConeGeometry(0.55, 1.4, 6), rock, 0, 1.0, 0);
    this._add(g, new THREE.DodecahedronGeometry(0.36, 0), rock, 0, 1.9, 0.04);
    [-0.45, 0.45].forEach(s => this._add(g, new THREE.IcosahedronGeometry(0.22, 0), rock, s, 1.25, 0.45));
    const orb = this._add(g, new THREE.IcosahedronGeometry(0.26, 0), this._glow(c, 2.2), 0, 1.3, 0.6);
    g.userData.parts.orb = orb; g.userData.cores.push(orb.material);
    this._eye(g, -0.13, 1.94, 0.3, 0.13); this._eye(g, 0.13, 1.94, 0.3, 0.13);
    return g;
  },
  _dragon(c, type) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    g.userData.golemGray = this._isGray(type);
    const rock = this._golemMat(type);
    this._add(g, new THREE.IcosahedronGeometry(0.6, 0), rock, 0, 0, 0, 1.4, 0.8, 1);
    this._add(g, new THREE.ConeGeometry(0.3, 1.0, 5), rock, 0, 0, -0.9).rotation.x = -Math.PI / 2;
    this._add(g, new THREE.DodecahedronGeometry(0.34, 0), rock, 0, 0.05, -1.2);
    this._add(g, new THREE.ConeGeometry(0.18, 1.3, 5), rock, 0, 0, 1.1).rotation.x = Math.PI / 2;
    const wing = g.userData.wing = [];
    [-1, 1].forEach(s => { const w = this._add(g, new THREE.BoxGeometry(1.4, 0.06, 0.7), this._golemMatDark(type), s * 1.0, 0.2, 0); wing.push(w); });
    this._eye(g, -0.16, 0.16, -1.35, 0.13); this._eye(g, 0.16, 0.16, -1.35, 0.13);
    this._mouth(g, c, 0, -0.1, -1.45, 0.22, 0.08);
    return g;
  },
  _boss(c, type) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    g.userData.golemGray = this._isGray(type);
    const rock = this._golemMat(type);
    this._add(g, new THREE.IcosahedronGeometry(1.1, 0), rock, 0, 1.7, 0, 1, 1.2, 1);
    this._add(g, new THREE.DodecahedronGeometry(0.7, 0), rock, 0, 3.0, 0.1);
    [-1.2, 1.2].forEach(s => this._add(g, new THREE.IcosahedronGeometry(0.6, 0), rock, s, 2.2, 0));
    [-1.1, 1.1].forEach(s => { this._add(g, new THREE.BoxGeometry(0.34, 1.4, 0.36), rock, s, 1.0, 0.1); this._add(g, new THREE.IcosahedronGeometry(0.4, 0), rock, s, 0.3, 0.2); });
    [-0.5, 0.5].forEach(s => this._add(g, new THREE.BoxGeometry(0.5, 0.9, 0.55), rock, s, 0.45, 0));
    // four googly eyes
    [[-0.32, 3.12], [0.32, 3.12], [-0.16, 2.78], [0.16, 2.78]].forEach(p => this._eye(g, p[0], p[1], 0.6, 0.16));
    this._mouth(g, c, 0, 2.5, 0.62, 0.7, 0.14);
    this._moss(g, 3.5); this._moss(g, 3.3);
    return g;
  },
  _spider(c, type) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    g.userData.golemGray = this._isGray(type);
    const rock = this._golemMat(type);
    this._add(g, new THREE.IcosahedronGeometry(0.95, 0), rock, 0, 1.3, 0.4, 1.2, 1, 1.3);
    this._add(g, new THREE.DodecahedronGeometry(0.55, 0), rock, 0, 1.2, -0.6);
    for (let i = 0; i < 4; i++) {
      [-1, 1].forEach(s => {
        const hipX = s * 0.7, hipZ = (i - 1.5) * 0.5;
        this._add(g, new THREE.BoxGeometry(0.1, 0.1, 0.1), rock, hipX + s * 0.7, 1.7, hipZ);
        this._add(g, new THREE.BoxGeometry(0.09, 0.09, 1.0), rock, hipX + s * 0.35, 1.5, hipZ).rotation.z = s * 0.9;
        this._add(g, new THREE.BoxGeometry(0.08, 1.3, 0.08), rock, hipX + s * 0.85, 0.7, hipZ).rotation.z = s * 0.5;
      });
    }
    [-0.18, 0.18].forEach(s => this._add(g, new THREE.ConeGeometry(0.08, 0.4, 4), this._golemMatDark(type), s, 0.85, -0.95).rotation.x = Math.PI);
    // cluster of googly venom eyes
    [[-0.24, 1.45], [0.24, 1.45], [-0.36, 1.18], [0.36, 1.18], [0, 1.6]].forEach((p, i) => this._eye(g, p[0], p[1], -0.92, i === 4 ? 0.16 : 0.13));
    return g;
  },

  // ---- GOBLINS (twig & leaf, glowy maw, googly eyes) ----
  _sapling(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    const wood = this._wood(0x8fc24a);
    this._add(g, new THREE.IcosahedronGeometry(0.32, 0), wood, 0, 0.7, 0, 0.9, 1.1, 0.9);
    [-0.28, 0.28].forEach(s => this._add(g, new THREE.BoxGeometry(0.07, 0.55, 0.07), wood, s, 0.32, 0).rotation.z = s * 0.2);
    [-0.32, 0.32].forEach(s => this._add(g, new THREE.BoxGeometry(0.06, 0.4, 0.06), wood, s, 0.8, 0).rotation.z = s * 0.8);
    this._add(g, new THREE.ConeGeometry(0.18, 0.3, 5), this._wood(0xb6f06a), 0, 1.05, 0);
    this._eye(g, -0.13, 0.74, 0.26, 0.12); this._eye(g, 0.13, 0.74, 0.26, 0.12);
    this._mouth(g, c, 0, 0.55, 0.28, 0.18, 0.06);
    return g;
  },
  _bramble(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    const wood = this._wood(0x7e9a3a);
    this._add(g, new THREE.IcosahedronGeometry(0.5, 0), wood, 0, 0.95, 0, 1, 1.1, 0.9);
    this._add(g, new THREE.DodecahedronGeometry(0.32, 0), wood, 0, 1.55, 0.05);
    for (let i = 0; i < 5; i++) this._add(g, new THREE.ConeGeometry(0.08, 0.4, 4), this._wood(0x55702a), (i - 2) * 0.18, 1.2, -0.35).rotation.x = -0.6;
    [-0.55, 0.55].forEach(s => { this._add(g, new THREE.BoxGeometry(0.08, 0.6, 0.08), wood, s, 0.95, 0.1).rotation.z = s * 0.4; this._add(g, new THREE.ConeGeometry(0.07, 0.3, 4), wood, s * 0.75, 0.6, 0.2); });
    [-0.22, 0.22].forEach(s => this._add(g, new THREE.BoxGeometry(0.18, 0.5, 0.2), wood, s, 0.35, 0));
    this._eye(g, -0.14, 1.62, 0.28, 0.13); this._eye(g, 0.14, 1.62, 0.28, 0.13);
    this._mouth(g, c, 0, 1.4, 0.3, 0.3, 0.1);
    return g;
  },
  _treant(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    const bark = this._wood(0x7a5a2a);
    this._add(g, new THREE.CylinderGeometry(0.5, 0.7, 2.2, 7), bark, 0, 1.3, 0);
    [[0,2.7,0,0.9],[-0.5,2.5,0.3,0.6],[0.5,2.5,-0.2,0.6],[0,2.9,-0.4,0.5]].forEach(p => this._add(g, new THREE.IcosahedronGeometry(p[3], 0), this._wood(0x8fdc4a), p[0], p[1], p[2]));
    [-0.35, 0.35].forEach(s => this._add(g, new THREE.CylinderGeometry(0.18, 0.3, 0.7, 5), bark, s, 0.3, 0));
    [-0.6, 0.6].forEach(s => this._add(g, new THREE.CylinderGeometry(0.08, 0.14, 1.0, 5), bark, s, 1.5, 0.1).rotation.z = s * 1.0);
    this._eye(g, -0.2, 1.85, 0.42, 0.16); this._eye(g, 0.2, 1.85, 0.42, 0.16);
    this._mouth(g, c, 0, 1.5, 0.46, 0.28, 0.12);
    return g;
  },

  // ---- JUNGLE CRITTERS (cheeky toon monkeys & a big ape) ----
  _monkeyParts(g, fur, face, scale) {
    // body
    this._add(g, new THREE.IcosahedronGeometry(0.4 * scale, 0), this._wood(fur), 0, 0.85 * scale, 0, 1, 1.15, 0.95);
    // head
    this._add(g, new THREE.IcosahedronGeometry(0.34 * scale, 0), this._wood(fur), 0, 1.5 * scale, 0.05);
    // pale face patch
    this._add(g, new THREE.SphereGeometry(0.26 * scale, 14, 14), this._wood(face), 0, 1.46 * scale, 0.18, 1, 0.9, 0.6);
    // ears
    [-0.34, 0.34].forEach(s => this._add(g, new THREE.CylinderGeometry(0.14 * scale, 0.14 * scale, 0.08, 14), this._wood(fur), s * scale, 1.52 * scale, 0).rotation.x = Math.PI / 2);
    [-0.34, 0.34].forEach(s => this._add(g, new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 0.09, 12), this._wood(face), s * scale, 1.52 * scale, 0.02).rotation.x = Math.PI / 2);
    // muzzle
    this._add(g, new THREE.SphereGeometry(0.14 * scale, 12, 12), this._wood(face), 0, 1.38 * scale, 0.26, 1.1, 0.8, 0.8);
    // eyes
    this._eye(g, -0.12 * scale, 1.56 * scale, 0.28 * scale, 0.11 * scale);
    this._eye(g, 0.12 * scale, 1.56 * scale, 0.28 * scale, 0.11 * scale);
    // arms (long, dangling)
    [-0.45, 0.45].forEach(s => { this._add(g, new THREE.CylinderGeometry(0.09 * scale, 0.07 * scale, 0.9 * scale, 7), this._wood(fur), s * scale, 0.85 * scale, 0.1).rotation.z = s * 0.25; this._add(g, new THREE.IcosahedronGeometry(0.11 * scale, 0), this._wood(face), s * 0.62 * scale, 0.42 * scale, 0.12); });
    // legs
    [-0.2, 0.2].forEach(s => this._add(g, new THREE.CylinderGeometry(0.1 * scale, 0.08 * scale, 0.5 * scale, 7), this._wood(fur), s * scale, 0.3 * scale, 0));
    // curly tail
    const tail = new THREE.Group(); g.add(tail);
    for (let i = 0; i < 6; i++) { const a = i * 0.6; this._add(tail, new THREE.SphereGeometry((0.09 - i * 0.008) * scale, 8, 8), this._wood(fur), Math.sin(a) * 0.22 * scale, 0.7 * scale + Math.cos(a) * 0.22 * scale - i * 0.04, -0.35 * scale - i * 0.04 * scale); }
  },
  _monkey(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    this._monkeyParts(g, 0xb07a4a, 0xf0d8b0, 1);
    this._mouth(g, c, 0, 1.34, 0.34, 0.16, 0.05);
    return g;
  },
  _slinger(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = []; g.userData.parts = {};
    this._monkeyParts(g, 0x8a9a4a, 0xe8e0c0, 1.0);
    // little hat leaf
    this._add(g, new THREE.ConeGeometry(0.28, 0.3, 6), this._wood(0x6fd83a), 0, 1.82, 0.04);
    // coconut held up in hand
    const orb = this._add(g, new THREE.IcosahedronGeometry(0.18, 0), this._wood(0x5a3a22), 0.6, 1.0, 0.3);
    g.userData.parts.orb = orb;
    this._mouth(g, c, 0, 1.34, 0.34, 0.18, 0.06);
    return g;
  },
  _ape(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    const fur = 0x5a4636, face = 0xc8a878;
    // big barrel chest
    this._add(g, new THREE.IcosahedronGeometry(1.0, 0), this._wood(fur), 0, 1.5, 0, 1.2, 1.15, 1);
    this._add(g, new THREE.IcosahedronGeometry(0.55, 0), this._wood(face), 0, 1.4, 0.62, 1.1, 1.2, 0.5); // chest patch
    // head
    this._add(g, new THREE.IcosahedronGeometry(0.5, 0), this._wood(fur), 0, 2.7, 0.05);
    this._add(g, new THREE.SphereGeometry(0.38, 14, 14), this._wood(face), 0, 2.62, 0.28, 1, 0.9, 0.6);
    this._add(g, new THREE.SphereGeometry(0.2, 12, 12), this._wood(face), 0, 2.5, 0.4, 1.2, 0.8, 0.8); // muzzle
    // brow ridge
    this._add(g, new THREE.BoxGeometry(0.7, 0.14, 0.2), this._wood(fur), 0, 2.86, 0.34);
    this._eye(g, -0.18, 2.78, 0.4, 0.15); this._eye(g, 0.18, 2.78, 0.4, 0.15);
    this._mouth(g, c, 0, 2.42, 0.52, 0.34, 0.08);
    // huge arms
    [-1.1, 1.1].forEach(s => { this._add(g, new THREE.CylinderGeometry(0.26, 0.2, 1.8, 8), this._wood(fur), s, 1.2, 0.1).rotation.z = s * 0.18; this._add(g, new THREE.IcosahedronGeometry(0.3, 0), this._wood(face), s * 1.05, 0.35, 0.15); });
    // stubby legs
    [-0.4, 0.4].forEach(s => this._add(g, new THREE.CylinderGeometry(0.28, 0.22, 0.7, 7), this._wood(fur), s, 0.4, 0));
    return g;
  },

  // ---- CLOWNS (wacky circus folk) ----
  _clownParts(g, suitCol, scale) {
    scale = scale || 1;
    // baggy polka-dot suit (cone body)
    this._add(g, new THREE.ConeGeometry(0.55 * scale, 1.3 * scale, 8), this._wood(suitCol), 0, 0.85 * scale, 0);
    // polka dots
    for (let i = 0; i < 8; i++) { const a = Math.random() * Math.PI * 2, yy = 0.45 + Math.random() * 0.9; const rr = 0.5 - (yy - 0.45) * 0.3; this._add(g, new THREE.CircleGeometry(0.08 * scale, 8), new THREE.MeshStandardMaterial({ color: ['#ffd23f', '#43c6ff', '#5fe3a1', '#fff'][i % 4], side: THREE.DoubleSide }), Math.cos(a) * rr * scale, yy * scale, Math.sin(a) * rr * scale + 0.02).lookAt(Math.cos(a) * 3, yy * scale, Math.sin(a) * 3); }
    // ruffle collar
    this._add(g, new THREE.TorusGeometry(0.3 * scale, 0.12 * scale, 8, 14), this._wood(0xffffff), 0, 1.35 * scale, 0).rotation.x = Math.PI / 2;
    // white face head
    this._add(g, new THREE.SphereGeometry(0.34 * scale, 16, 14), this._wood(0xfff4ec), 0, 1.72 * scale, 0.02);
    // big red nose
    this._add(g, new THREE.SphereGeometry(0.13 * scale, 12, 12), this._glow(0xff2d2d, 0.6), 0, 1.68 * scale, 0.33);
    // googly eyes
    this._eye(g, -0.13 * scale, 1.82 * scale, 0.26 * scale, 0.12 * scale);
    this._eye(g, 0.13 * scale, 1.82 * scale, 0.26 * scale, 0.12 * scale);
    // frizzy rainbow hair
    const hairCols = [0xff5ca2, 0xffd23f, 0x43c6ff, 0x5fe3a1, 0xff8a3d];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; this._add(g, new THREE.IcosahedronGeometry((0.14 + Math.random() * 0.06) * scale, 0), this._wood(hairCols[i % hairCols.length]), Math.cos(a) * 0.34 * scale, (1.95 + Math.sin(a * 2) * 0.1) * scale, Math.sin(a) * 0.34 * scale - 0.05); }
    // tiny pointy hat
    this._add(g, new THREE.ConeGeometry(0.16 * scale, 0.4 * scale, 8), this._wood(0xff3b5c), 0.1 * scale, 2.2 * scale, 0);
    // gloved arms
    [-0.5, 0.5].forEach(s => { this._add(g, new THREE.CylinderGeometry(0.07 * scale, 0.06 * scale, 0.6 * scale, 6), this._wood(suitCol), s * 0.5 * scale, 0.95 * scale, 0.05).rotation.z = s * 0.5; this._add(g, new THREE.IcosahedronGeometry(0.12 * scale, 0), this._wood(0xffffff), s * 0.72 * scale, 0.66 * scale, 0.1); });
    // big floppy shoes
    [-0.22, 0.22].forEach(s => this._add(g, new THREE.SphereGeometry(0.2 * scale, 10, 8), this._wood(0xff8a3d), s * scale, 0.12 * scale, 0.18 * scale, 1, 0.5, 1.8));
    // grin
    this._mouth(g, 0xff2d2d, 0, 1.62 * scale, 0.3 * scale, 0.26 * scale, 0.07 * scale);
  },
  _clown(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = [];
    this._clownParts(g, 0x3a7bd8, 1.0);
    return g;
  },
  _jester(c) {
    const g = new THREE.Group(); g.userData.cores = []; g.userData.eyes = []; g.userData.parts = {};
    this._clownParts(g, 0x8a3ad8, 1.0);
    // jester juggles a glowing ball (ranged projectile source)
    const orb = this._add(g, new THREE.IcosahedronGeometry(0.2, 0), this._glow(c, 2.0), 0.6, 1.2, 0.3);
    g.userData.parts.orb = orb; g.userData.cores.push(orb.material);
    return g;
  },

  // small glowing crystal shards sprouting from the stone (was moss)
  _moss(g, y) {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.2 + Math.random() * 0.3;
      this._add(g, new THREE.IcosahedronGeometry(0.1 + Math.random() * 0.08, 0), this._glow(0xbb6bff, 0.9), Math.cos(a) * r, y - Math.random() * 0.3, Math.sin(a) * r);
    }
  },
};

if (typeof window !== 'undefined') window.EnemyFactory = EnemyFactory;
