import * as THREE from 'three';
import { PHYSICS, RENDERING } from '../config/GameConfig.js';
import { Renderer } from './Renderer.js';
import { InputController } from './InputController.js';
import { PhysicsWorld } from './PhysicsWorld.js';
import { PlayerController } from './PlayerController.js';
import { LevelManager } from '../world/LevelManager.js';
import { EnemySystem } from '../enemies/EnemySystem.js';
import { WeaponSystem } from '../combat/WeaponSystem.js';
import { HUD } from '../ui/HUD.js';

export class FPSGame {
  constructor({ root, hudRoot }) {
    this.root = root;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(RENDERING.fov, window.innerWidth / window.innerHeight, RENDERING.near, RENDERING.far);
    this.clock = new THREE.Clock();
    this.physicsWorld = new PhysicsWorld();
    this.levelId = 'neon-city';
    this.started = false;
    this.hud = new HUD(hudRoot);
    this.renderer = new Renderer(root, this.scene, this.camera);
    this.input = new InputController(this.camera, this.renderer.renderer.domElement, document.getElementById('message'));
    this.player = new PlayerController(this.camera, this.physicsWorld);
    this.levels = new LevelManager(this.scene, this.physicsWorld);
    this.enemies = new EnemySystem(this.scene, this.player, this.hud);
    this.weapons = new WeaponSystem(this.camera, this.scene, this.enemies, this.hud);
  }

  bootstrap() {
    this.addLighting();
    this.input.bind();
    this.input.onFire = () => this.weapons.fire(this.player);
    this.input.onReload = () => this.weapons.reload();
    this.input.onWeapon = (index) => this.weapons.switch(index);
    document.getElementById('start-button')?.addEventListener('click', () => this.start());
    document.getElementById('level-select')?.addEventListener('change', (event) => this.loadLevel(event.target.value));
    document.querySelectorAll('[data-level]').forEach((button) => {
      button.addEventListener('click', () => this.loadLevel(button.dataset.level));
    });
    this.loadLevel(this.levelId);
    this.renderer.setAnimationLoop(() => this.animate());
  }

  addLighting() {
    this.scene.add(new THREE.HemisphereLight(0x8dc1de, 0x080820, 1.45));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-12, 28, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    this.scene.add(sun);
  }

  start() {
    this.started = true;
    this.input.lock();
    this.hud.message('Systems online');
  }

  setLevelSelection(id) {
    document.getElementById('level-select')?.querySelectorAll('option').forEach((option) => {
      option.selected = option.value === id;
    });
    document.querySelectorAll('[data-level]').forEach((button) => {
      button.classList.toggle('active', button.dataset.level === id);
    });
  }

  loadLevel(id) {
    this.levelId = id;
    this.setLevelSelection(id);
    const level = this.levels.load(id);
    this.player.reset(level.spawn);
    this.enemies.reset(level.enemyTheme);
    this.hud.message(`${level.label} loaded`);
  }

  animate() {
    const delta = Math.min(PHYSICS.maxDelta, this.clock.getDelta());
    const input = this.input.state();
    if (this.started) {
      const step = delta / PHYSICS.stepsPerFrame;
      for (let i = 0; i < PHYSICS.stepsPerFrame; i++) this.player.update(step, input);
      this.enemies.update(delta);
      this.weapons.update(delta, input, this.player);
    }
    this.hud.update(delta, { player: this.player, weaponSystem: this.weapons, enemySystem: this.enemies, levelId: this.levelId });
    this.renderer.render();
  }
}
