import * as THREE from 'three';

const THEMES = {
  street: [{ name: 'Neon Runner', color: 0xff2d95, hp: 70, speed: 3.6, score: 100 }, { name: 'Void Titan', color: 0x7d5cff, hp: 220, speed: 1.8, score: 350 }],
  samurai: [{ name: 'Ronin Drone', color: 0xff6ec7, hp: 85, speed: 3.3, score: 120 }, { name: 'Oni Brute', color: 0xff3b30, hp: 190, speed: 2.0, score: 260 }],
  jungle: [{ name: 'Jungle Beast', color: 0x78ff65, hp: 120, speed: 3.0, score: 160 }, { name: 'Ancient Treant', color: 0x3c8c3c, hp: 240, speed: 1.4, score: 320 }],
  cleaners: [{ name: 'Cleaner Drone', color: 0xffd166, hp: 90, speed: 3.4, score: 140 }, { name: 'Sanitation Mech', color: 0x6dff69, hp: 210, speed: 1.7, score: 300 }]
};

export class EnemySystem {
  constructor(scene, player, hud) {
    this.scene = scene;
    this.player = player;
    this.hud = hud;
    this.enemies = [];
    this.wave = 1;
    this.theme = 'street';
    this.damageClock = 0;
  }

  reset(theme = 'street') {
    for (const enemy of this.enemies) this.scene.remove(enemy.group);
    this.enemies.length = 0;
    this.theme = theme;
    this.wave = 1;
    this.spawnWave();
  }

  spawnWave() {
    const defs = THEMES[this.theme] || THEMES.street;
    const count = 4 + this.wave * 2;
    for (let i = 0; i < count; i++) {
      const def = defs[i % defs.length];
      const angle = (i / count) * Math.PI * 2;
      const radius = 24 + Math.random() * 38;
      this.spawn(def, new THREE.Vector3(Math.cos(angle) * radius, 0.9, Math.sin(angle) * radius));
    }
    this.hud.message(`Wave ${this.wave}: ${defs[0].name}s inbound`);
  }

  spawn(def, position) {
    const group = new THREE.Group();
    group.position.copy(position);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.1, 4, 8), new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.35, roughness: 0.55 }));
    body.position.y = 0.9;
    body.castShadow = true;
    group.add(body);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.set(0, 1.45, -0.48);
    group.add(eye);
    this.scene.add(group);
    this.enemies.push({ ...def, hp: def.hp + this.wave * 10, maxHp: def.hp + this.wave * 10, group, body, score: def.score });
  }

  update(delta) {
    this.damageClock -= delta;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const toPlayer = this.player.camera.position.clone().sub(enemy.group.position);
      const distance = toPlayer.length();
      toPlayer.y = 0;
      if (toPlayer.lengthSq() > 0.001) enemy.group.position.addScaledVector(toPlayer.normalize(), enemy.speed * delta);
      enemy.group.lookAt(this.player.camera.position.x, enemy.group.position.y, this.player.camera.position.z);
      enemy.body.material.emissiveIntensity = 0.28 + Math.sin(performance.now() * 0.006) * 0.14;
      if (distance < 1.8 && this.damageClock <= 0) {
        this.player.damage(8 + this.wave);
        this.damageClock = 0.45;
      }
    }
    if (this.enemies.length === 0) {
      this.wave++;
      this.spawnWave();
    }
  }

  hitTargets() {
    return this.enemies.map(e => e.body);
  }

  findByObject(object) {
    return this.enemies.find(e => e.body === object || e.group === object || e.group.children.includes(object));
  }

  damage(enemy, amount) {
    enemy.hp -= amount;
    enemy.body.scale.setScalar(1 + Math.max(0, 1 - enemy.hp / enemy.maxHp) * 0.25);
    if (enemy.hp <= 0) {
      this.scene.remove(enemy.group);
      this.enemies.splice(this.enemies.indexOf(enemy), 1);
      return true;
    }
    return false;
  }
}
