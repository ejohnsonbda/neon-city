// ============================================================
//  WEAPON FACTORY — standalone builders for the Armory page
//  Mirrors the in-game viewmodels from game.js (createWeaponModel).
//  Each build returns a THREE.Group; userData.spin/blade/star/arrow
//  expose animated sub-parts.
// ============================================================
const WeaponFactory = {
  matDark()  { return new THREE.MeshStandardMaterial({ color: 0x3a2350, roughness: 0.55, metalness: 0.15, flatShading: true }); },
  matMetal() { return new THREE.MeshStandardMaterial({ color: 0x9aa6c4, metalness: 0.4, roughness: 0.4, flatShading: true }); },
  matPoly()  { return new THREE.MeshStandardMaterial({ color: 0x6a4ea0, roughness: 0.5, metalness: 0.1, flatShading: true }); },
  accent(hex){ return new THREE.MeshBasicMaterial({ color: hex }); },
  glow(hex, i){ return new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: i || 1.4, roughness: 0.4 }); },
  _part(g, geo, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; g.add(m); return m;
  },

  build(key) {
    this._dark = this.matDark(); this._metal = this.matMetal(); this._poly = this.matPoly();
    switch (key) {
      case 'smg': return this._smg(0xffd166);
      case 'shotgun': return this._shotgun(0xff2d95);
      case 'railgun': return this._railgun(0x39ff14);
      case 'plasma': return this._plasma(0x9b5cff);
      case 'pulse': return this._pulse(0xff7a18);
      case 'katana': return this._katana();
      case 'shuriken': return this._shuriken();
      case 'bow': return this._bow();
      default: return this._pistol(0x19f0ff);
    }
  },

  _pistol(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.1, 0.13, 0.36), this._dark, 0, 0, -0.05);
    const bar = this._part(g, new THREE.CylinderGeometry(0.022, 0.022, 0.34, 12), this._metal, 0, 0.03, -0.26); bar.rotation.x = Math.PI / 2;
    this._part(g, new THREE.BoxGeometry(0.08, 0.18, 0.1), this._dark, 0, -0.15, 0.07, 0.28);
    this._part(g, new THREE.BoxGeometry(0.11, 0.015, 0.2), this.accent(c), 0, 0.02, 0.02);
    return g;
  },
  _smg(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.11, 0.13, 0.5), this._dark, 0, 0, -0.08);
    const bar = this._part(g, new THREE.CylinderGeometry(0.02, 0.02, 0.34, 12), this._metal, 0, 0.03, -0.42); bar.rotation.x = Math.PI / 2;
    this._part(g, new THREE.BoxGeometry(0.07, 0.2, 0.09), this._metal, 0, -0.17, -0.05, -0.12);
    this._part(g, new THREE.BoxGeometry(0.09, 0.16, 0.1), this._dark, 0, -0.13, 0.14, 0.3);
    this._part(g, new THREE.BoxGeometry(0.05, 0.05, 0.16), this._poly, 0, 0.0, 0.26);
    this._part(g, new THREE.BoxGeometry(0.12, 0.012, 0.34), this.accent(c), 0, 0.08, -0.05);
    return g;
  },
  _shotgun(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.16, 0.12, 0.42), this._dark, 0, 0, -0.02);
    [-0.045, 0.045].forEach(dx => { const b = this._part(g, new THREE.CylinderGeometry(0.04, 0.04, 0.56, 14), this._metal, dx, 0.03, -0.34); b.rotation.x = Math.PI / 2; });
    this._part(g, new THREE.BoxGeometry(0.14, 0.05, 0.16), this._poly, 0, -0.07, -0.1);
    this._part(g, new THREE.BoxGeometry(0.1, 0.18, 0.11), this._dark, 0, -0.14, 0.16, 0.32);
    this._part(g, new THREE.BoxGeometry(0.05, 0.05, 0.2), this._poly, 0, -0.02, 0.26);
    this._part(g, new THREE.BoxGeometry(0.17, 0.014, 0.14), this.accent(c), 0, 0.09, 0.04);
    return g;
  },
  _railgun(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.1, 0.11, 0.62), this._poly, 0, 0, -0.12);
    [-0.045, 0.045].forEach(dx => this._part(g, new THREE.BoxGeometry(0.02, 0.05, 0.8), this._metal, dx, 0.07, -0.32));
    this._part(g, new THREE.BoxGeometry(0.05, 0.02, 0.8), this.glow(c, 2.2), 0, 0.07, -0.32);
    [-0.34, -0.14, 0.06].forEach(z => this._part(g, new THREE.TorusGeometry(0.07, 0.018, 8, 16), this.glow(c, 1.6), 0, 0.05, z));
    this._part(g, new THREE.BoxGeometry(0.09, 0.16, 0.1), this._dark, 0, -0.13, 0.16, 0.3);
    this._part(g, new THREE.BoxGeometry(0.05, 0.05, 0.18), this._poly, 0, 0.0, 0.28);
    return g;
  },
  _plasma(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.15, 0.16, 0.4), this._poly, 0, 0, -0.02);
    const tube = this._part(g, new THREE.CylinderGeometry(0.075, 0.085, 0.42, 16), this._dark, 0, 0.02, -0.32); tube.rotation.x = Math.PI / 2;
    this._part(g, new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), this._metal, 0, 0.02, -0.52).rotation.x = Math.PI / 2;
    g.userData.orb = this._part(g, new THREE.SphereGeometry(0.06, 14, 14), this.glow(c, 2.4), 0, 0.02, -0.05);
    this._part(g, new THREE.BoxGeometry(0.1, 0.18, 0.11), this._dark, 0, -0.15, 0.14, 0.3);
    this._part(g, new THREE.BoxGeometry(0.16, 0.014, 0.2), this.accent(c), 0, 0.11, 0.0);
    return g;
  },
  _pulse(c) {
    const g = new THREE.Group();
    this._part(g, new THREE.BoxGeometry(0.16, 0.15, 0.34), this._dark, 0, 0, 0.04);
    const spin = new THREE.Group(); spin.position.set(0, 0.0, -0.34);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const b = this._part(spin, new THREE.CylinderGeometry(0.016, 0.016, 0.4, 8), this._metal, Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0); b.rotation.x = Math.PI / 2; }
    this._part(spin, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), this._poly, 0, 0, 0.18).rotation.x = Math.PI / 2;
    g.add(spin); g.userData.spin = spin;
    this._part(g, new THREE.BoxGeometry(0.1, 0.18, 0.12), this._dark, 0, -0.16, 0.16, 0.28);
    this._part(g, new THREE.TorusGeometry(0.08, 0.02, 8, 18), this.glow(c, 1.6), 0, 0, -0.12);
    this._part(g, new THREE.BoxGeometry(0.17, 0.014, 0.2), this.accent(c), 0, 0.1, 0.06);
    return g;
  },
  _katana() {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe9f2, metalness: 0.95, roughness: 0.12 });
    const edge = new THREE.MeshBasicMaterial({ color: 0xeaf6ff });
    const wrap = new THREE.MeshStandardMaterial({ color: 0x14110e, roughness: 0.8 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xc8a24a, metalness: 0.8, roughness: 0.3 });
    const blade = new THREE.Group();
    for (let i = 0; i < 10; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.12), steel); const a = i * 0.02; seg.position.set(Math.sin(a) * 0.05, 0, -0.18 - i * 0.12); seg.rotation.x = a; blade.add(seg); }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.16, 4), steel); tip.rotation.x = -Math.PI / 2; tip.position.set(0.08, 0, -1.5); blade.add(tip);
    const shine = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 1.2), edge); shine.position.set(0.02, 0.006, -0.78); blade.add(shine);
    g.add(blade);
    const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), gold); tsuba.rotation.x = Math.PI / 2; tsuba.position.set(0, 0, -0.12); g.add(tsuba);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.34, 8), wrap); handle.rotation.x = Math.PI / 2; handle.position.set(0, 0, 0.06); g.add(handle);
    for (let i = 0; i < 6; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 10), gold); r.position.set(0, 0, -0.05 + i * 0.05); g.add(r); }
    g.userData.blade = blade;
    return g;
  },
  _shuriken() {
    const g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xb8c2cc, metalness: 0.9, roughness: 0.25 });
    const star = new THREE.Group();
    for (let i = 0; i < 4; i++) { const pt = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), steel); pt.position.set(Math.cos(i * Math.PI / 2) * 0.13, Math.sin(i * Math.PI / 2) * 0.13, 0); pt.rotation.z = i * Math.PI / 2 + Math.PI / 2; star.add(pt); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 8), steel); hub.rotation.x = Math.PI / 2; star.add(hub);
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8), new THREE.MeshBasicMaterial({ color: 0x111111 })); hole.rotation.x = Math.PI / 2; star.add(hole);
    g.add(star); g.userData.star = star;
    return g;
  },
  _bow() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.6 });
    const lac = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.5 });
    const limb = new THREE.Group();
    for (let i = -8; i <= 8; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), i % 4 === 0 ? lac : wood); const a = i * 0.16; seg.position.set(-0.02 - Math.cos(a) * 0.06 + 0.06, i * 0.085, 0); seg.rotation.z = a * 0.5; limb.add(seg); }
    limb.position.set(0.0, 0, 0); g.add(limb);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.45, 4), new THREE.MeshBasicMaterial({ color: 0xeeeeee })); str.position.set(-0.06, 0, 0); g.add(str);
    const arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0xcaa472 })); shaft.rotation.z = Math.PI / 2; shaft.position.set(0.1, 0, 0); arrow.add(shaft);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.08, 4), new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.8, roughness: 0.3 })); head.rotation.z = -Math.PI / 2; head.position.set(0.46, 0, 0); arrow.add(head);
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.001), new THREE.MeshBasicMaterial({ color: 0xcc3344, side: THREE.DoubleSide })); fl.position.set(-0.22, 0, 0); arrow.add(fl);
    g.add(arrow); g.userData.arrow = arrow;
    return g;
  }
};
