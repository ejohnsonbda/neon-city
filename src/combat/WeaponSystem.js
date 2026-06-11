import * as THREE from 'three';
import { WEAPONS } from '../config/GameConfig.js';

const _origin = new THREE.Vector3();
const _direction = new THREE.Vector3();
const _muzzleWorld = new THREE.Vector3();

export class WeaponSystem {
  constructor(camera, scene, enemySystem, hud) {
    this.camera = camera;
    this.scene = scene;
    this.enemySystem = enemySystem;
    this.hud = hud;
    this.weapons = WEAPONS.map(w => ({ ...w, ammoLeft: w.ammo, magLeft: w.mag }));
    this.index = 0;
    this.lastShot = 0;
    this.raycaster = new THREE.Raycaster();
    this.tracers = [];
    this.recoil = 0;
    this.flashLife = 0;
    this.time = 0;

    this.viewModel = new THREE.Group();
    this.viewModel.name = 'FirstPersonWeaponViewModel';
    this.viewModel.position.set(0.42, -0.34, -0.68);
    this.viewModel.rotation.set(0.03, -0.08, -0.035);
    this.viewModel.renderOrder = 1000;

    if (!this.camera.parent) this.scene.add(this.camera);
    this.camera.add(this.viewModel);

    this.models = new Map();
    this.materials = this.createMaterials();
    this.buildViewModels();
    this.switch(0);
  }

  get current() { return this.weapons[this.index]; }

  createTexture(base, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.22;
    for (let y = -128; y < 256; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y + 128);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 120; i++) ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.4, 2.4);
    return texture;
  }

  createMaterials() {
    const gunMetal = this.createTexture('#111722', '#72849a');
    const grip = this.createTexture('#101014', '#2e3848');
    const gold = this.createTexture('#292216', '#ffd166');
    const green = this.createTexture('#102216', '#6dff69');
    const baseOptions = { roughness: 0.38, metalness: 0.78, depthTest: false, depthWrite: false };
    return {
      body: new THREE.MeshStandardMaterial({ map: gunMetal, color: 0xaeb9c7, ...baseOptions }),
      dark: new THREE.MeshStandardMaterial({ map: grip, color: 0x2b3444, roughness: 0.55, metalness: 0.5, depthTest: false, depthWrite: false }),
      black: new THREE.MeshStandardMaterial({ color: 0x06080d, roughness: 0.6, metalness: 0.45, depthTest: false, depthWrite: false }),
      cyan: new THREE.MeshBasicMaterial({ color: 0x19f0ff, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false }),
      amber: new THREE.MeshStandardMaterial({ map: gold, color: 0xffd166, roughness: 0.31, metalness: 0.72, emissive: 0x332400, emissiveIntensity: 0.18, depthTest: false, depthWrite: false }),
      green: new THREE.MeshStandardMaterial({ map: green, color: 0x6dff69, roughness: 0.32, metalness: 0.62, emissive: 0x123611, emissiveIntensity: 0.34, depthTest: false, depthWrite: false }),
      glass: new THREE.MeshBasicMaterial({ color: 0x6dff69, transparent: true, opacity: 0.52, depthTest: false, depthWrite: false }),
      flash: new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
    };
  }

  mesh(geometry, material, position, rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(...position);
    part.rotation.set(...rotation);
    part.scale.set(...scale);
    part.renderOrder = 1001;
    return part;
  }

  box(size, material, position, rotation) {
    return this.mesh(new THREE.BoxGeometry(...size), material, position, rotation);
  }

  barrel(radius, length, material, position, rotation = [Math.PI / 2, 0, 0]) {
    return this.mesh(new THREE.CylinderGeometry(radius, radius, length, 20), material, position, rotation);
  }

  glowStrip(size, colorMaterial, position, rotation) {
    return this.box(size, colorMaterial, position, rotation);
  }

  buildViewModels() {
    this.models.set('pistol', this.buildPistol());
    this.models.set('pulse', this.buildPulseSMG());
    this.models.set('cleaner', this.buildCleanerRail());
    this.models.set('sniper', this.buildSniperRifle());
    this.muzzleFlash = this.mesh(new THREE.ConeGeometry(0.07, 0.18, 7), this.materials.flash, [0, 0, -0.55], [Math.PI / 2, 0, 0]);
    this.muzzleFlash.name = 'MuzzleFlash';
    this.viewLight = new THREE.PointLight(0xfff1a8, 0, 1.5);
    this.viewModel.add(this.muzzleFlash, this.viewLight);
    for (const model of this.models.values()) this.viewModel.add(model);
  }

  buildPistol() {
    const g = new THREE.Group();
    g.name = 'PistolViewModel';
    g.userData.muzzle = new THREE.Vector3(0.02, 0.09, -0.62);
    g.add(
      this.box([0.18, 0.13, 0.46], this.materials.body, [0.02, 0.06, -0.26], [0.02, 0, 0]),
      this.box([0.17, 0.055, 0.38], this.materials.dark, [0.02, 0.15, -0.31], [0.02, 0, 0]),
      this.box([0.12, 0.23, 0.15], this.materials.dark, [0.0, -0.09, -0.08], [-0.42, 0, 0]),
      this.box([0.09, 0.08, 0.18], this.materials.black, [0.0, -0.01, -0.24], [0.07, 0, 0]),
      this.barrel(0.027, 0.38, this.materials.black, [0.02, 0.095, -0.55]),
      this.glowStrip([0.024, 0.018, 0.24], this.materials.cyan, [0.105, 0.16, -0.31]),
      this.glowStrip([0.024, 0.018, 0.24], this.materials.cyan, [-0.065, 0.16, -0.31])
    );
    return g;
  }

  buildPulseSMG() {
    const g = new THREE.Group();
    g.name = 'PulseSMGViewModel';
    g.userData.muzzle = new THREE.Vector3(0.04, 0.10, -0.76);
    g.add(
      this.box([0.24, 0.16, 0.56], this.materials.body, [0.03, 0.06, -0.33], [0.015, 0, 0]),
      this.box([0.20, 0.08, 0.42], this.materials.dark, [0.03, 0.18, -0.33]),
      this.box([0.12, 0.36, 0.14], this.materials.dark, [-0.02, -0.14, -0.30], [-0.12, 0, 0]),
      this.box([0.15, 0.30, 0.12], this.materials.amber, [0.05, -0.17, -0.46], [-0.22, 0, 0]),
      this.barrel(0.022, 0.48, this.materials.black, [0.0, 0.10, -0.70]),
      this.barrel(0.018, 0.46, this.materials.black, [0.075, 0.10, -0.70]),
      this.barrel(0.018, 0.46, this.materials.black, [-0.075, 0.10, -0.70]),
      this.glowStrip([0.18, 0.025, 0.30], this.materials.amber, [0.03, 0.20, -0.34]),
      this.box([0.26, 0.035, 0.18], this.materials.black, [0.03, 0.255, -0.36])
    );
    return g;
  }

  buildCleanerRail() {
    const g = new THREE.Group();
    g.name = 'CleanerRailViewModel';
    g.userData.muzzle = new THREE.Vector3(0.02, 0.13, -0.88);
    g.add(
      this.box([0.20, 0.17, 0.72], this.materials.dark, [0.02, 0.06, -0.42], [0.02, 0, 0]),
      this.box([0.12, 0.11, 0.92], this.materials.body, [0.02, 0.13, -0.52]),
      this.barrel(0.024, 0.88, this.materials.black, [0.02, 0.135, -0.78]),
      this.barrel(0.016, 0.82, this.materials.green, [0.085, 0.16, -0.68]),
      this.barrel(0.016, 0.82, this.materials.green, [-0.045, 0.16, -0.68]),
      this.box([0.17, 0.08, 0.24], this.materials.glass, [0.02, 0.24, -0.44]),
      this.box([0.13, 0.32, 0.16], this.materials.dark, [-0.01, -0.15, -0.25], [-0.35, 0, 0]),
      this.box([0.23, 0.04, 0.12], this.materials.green, [0.02, 0.02, -0.74]),
      this.box([0.27, 0.05, 0.16], this.materials.black, [0.02, 0.245, -0.62])
    );
    return g;
  }

  buildSniperRifle() {
    const g = new THREE.Group();
    g.name = 'SniperRifleViewModel';
    g.userData.muzzle = new THREE.Vector3(0.02, 0.16, -1.02);
    g.add(
      this.box([0.16, 0.16, 0.86], this.materials.dark, [0.02, 0.05, -0.46], [0.018, 0, 0]),
      this.box([0.10, 0.10, 1.12], this.materials.body, [0.02, 0.13, -0.64]),
      this.barrel(0.019, 1.08, this.materials.black, [0.02, 0.155, -0.94]),
      this.barrel(0.030, 0.18, this.materials.black, [0.02, 0.155, -1.46]),
      this.box([0.32, 0.055, 0.14], this.materials.black, [0.02, 0.235, -0.53]),
      this.barrel(0.050, 0.34, this.materials.glass, [0.02, 0.30, -0.52], [0, 0, Math.PI / 2]),
      this.box([0.12, 0.34, 0.15], this.materials.dark, [-0.01, -0.16, -0.28], [-0.35, 0, 0]),
      this.glowStrip([0.024, 0.022, 0.54], this.materials.cyan, [0.10, 0.17, -0.65]),
      this.glowStrip([0.024, 0.022, 0.54], this.materials.cyan, [-0.06, 0.17, -0.65])
    );
    return g;
  }

  switch(index) {
    if (!this.weapons[index]) return;
    this.index = index;
    const activeId = this.current.id;
    for (const [id, model] of this.models) model.visible = id === activeId;
    this.hud.message(`${this.current.name} ready`);
  }

  reload() {
    const weapon = this.current;
    if (weapon.ammoLeft === Infinity) return;
    const needed = weapon.mag - weapon.magLeft;
    const take = Math.min(needed, weapon.ammoLeft);
    weapon.magLeft += take;
    weapon.ammoLeft -= take;
    this.recoil = Math.max(this.recoil, 0.22);
    this.hud.message(`Reloaded ${weapon.name}`);
  }

  update(delta, input, player) {
    this.time += delta;
    if (input.fire) this.fire(player);
    this.animateViewModel(delta, input);
    this.updateEffects(delta);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      t.material.opacity = Math.max(0, t.life * 4);
      if (t.life <= 0) { this.scene.remove(t); this.tracers.splice(i, 1); }
    }
  }

  animateViewModel(delta, input) {
    const move = Math.min(1, Math.abs(input.forward || 0) + Math.abs(input.strafe || 0));
    const bob = Math.sin(this.time * (input.sprint ? 14 : 9)) * 0.012 * move;
    const sway = (input.strafe || 0) * 0.025;
    this.recoil = THREE.MathUtils.lerp(this.recoil, 0, delta * 10);
    this.viewModel.position.x = THREE.MathUtils.lerp(this.viewModel.position.x, 0.42 + sway, delta * 8);
    this.viewModel.position.y = THREE.MathUtils.lerp(this.viewModel.position.y, -0.34 + bob - this.recoil * 0.04, delta * 8);
    this.viewModel.position.z = THREE.MathUtils.lerp(this.viewModel.position.z, -0.68 - this.recoil * 0.22, delta * 12);
    this.viewModel.rotation.x = THREE.MathUtils.lerp(this.viewModel.rotation.x, 0.03 + this.recoil * 0.22, delta * 10);
    this.viewModel.rotation.y = THREE.MathUtils.lerp(this.viewModel.rotation.y, -0.08 + sway * 0.8, delta * 8);
    this.viewModel.rotation.z = THREE.MathUtils.lerp(this.viewModel.rotation.z, -0.035 - sway * 0.9, delta * 8);
  }

  updateEffects(delta) {
    this.flashLife = Math.max(0, this.flashLife - delta * 8);
    this.muzzleFlash.material.opacity = this.flashLife;
    this.muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.45);
    this.muzzleFlash.rotation.z += delta * 24;
    this.viewLight.intensity = this.flashLife * 3.2;
  }

  fire(player) {
    const now = performance.now();
    const weapon = this.current;
    if (now - this.lastShot < weapon.rate) return;
    if (weapon.magLeft <= 0) { this.hud.message('Reload required'); return; }
    this.lastShot = now;
    if (weapon.magLeft !== Infinity) weapon.magLeft--;
    this.camera.getWorldDirection(_direction);
    _direction.x += (Math.random() - 0.5) * weapon.spread;
    _direction.y += (Math.random() - 0.5) * weapon.spread;
    _direction.z += (Math.random() - 0.5) * weapon.spread;
    _direction.normalize();
    _origin.copy(this.camera.position);
    this.raycaster.set(_origin, _direction);
    this.raycaster.far = 160;
    const intersections = this.raycaster.intersectObjects(this.enemySystem.hitTargets(), true);
    const end = _origin.clone().addScaledVector(_direction, 85);
    if (intersections.length) {
      const hit = intersections[0];
      end.copy(hit.point);
      const enemy = this.enemySystem.findByObject(hit.object);
      const damage = weapon.oneHit && enemy ? enemy.hp + 9999 : weapon.damage;
      if (enemy && this.enemySystem.damage(enemy, damage)) player.score += enemy.score;
    }
    this.triggerMuzzle(weapon);
    this.tracer(this.muzzleWorldPosition(), end, weapon.color);
  }

  muzzleWorldPosition() {
    const model = this.models.get(this.current.id);
    const muzzle = model?.userData?.muzzle || new THREE.Vector3(0, 0.08, -0.62);
    this.muzzleFlash.position.copy(muzzle);
    this.viewLight.position.copy(muzzle);
    return this.muzzleFlash.getWorldPosition(_muzzleWorld).clone();
  }

  triggerMuzzle(weapon) {
    this.recoil = Math.min(1, this.recoil + (weapon.id === 'sniper' ? 0.68 : weapon.id === 'cleaner' ? 0.58 : weapon.id === 'pulse' ? 0.17 : 0.30));
    this.flashLife = (weapon.id === 'cleaner' || weapon.id === 'sniper') ? 1 : 0.78;
    const color = new THREE.Color(weapon.color);
    this.muzzleFlash.material.color.copy(color);
    this.viewLight.color.copy(color);
  }

  tracer(a, b, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
    const line = new THREE.Line(geometry, material);
    line.life = 0.25;
    this.scene.add(line);
    this.tracers.push(line);
  }
}
