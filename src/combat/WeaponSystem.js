import * as THREE from 'three';
import { WEAPONS } from '../config/GameConfig.js';

const _origin = new THREE.Vector3();
const _direction = new THREE.Vector3();

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
  }

  get current() { return this.weapons[this.index]; }

  switch(index) {
    if (this.weapons[index]) this.index = index;
  }

  reload() {
    const weapon = this.current;
    if (weapon.ammoLeft === Infinity) return;
    const needed = weapon.mag - weapon.magLeft;
    const take = Math.min(needed, weapon.ammoLeft);
    weapon.magLeft += take;
    weapon.ammoLeft -= take;
    this.hud.message(`Reloaded ${weapon.name}`);
  }

  update(delta, input, player) {
    if (input.fire) this.fire(player);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= delta;
      t.material.opacity = Math.max(0, t.life * 4);
      if (t.life <= 0) { this.scene.remove(t); this.tracers.splice(i, 1); }
    }
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
      if (enemy && this.enemySystem.damage(enemy, weapon.damage)) player.score += enemy.score;
    }
    this.tracer(_origin, end, weapon.color);
  }

  tracer(a, b, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 });
    const line = new THREE.Line(geometry, material);
    line.life = 0.25;
    this.scene.add(line);
    this.tracers.push(line);
  }
}
