import * as THREE from 'three';
import { Capsule } from 'three/addons/math/Capsule.js';
import { PHYSICS } from '../config/GameConfig.js';

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

export class PlayerController {
  constructor(camera, physicsWorld) {
    this.camera = camera;
    this.physicsWorld = physicsWorld;
    this.collider = new Capsule(
      new THREE.Vector3(0, PHYSICS.playerRadius, 0),
      new THREE.Vector3(0, PHYSICS.playerHeight, 0),
      PHYSICS.playerRadius
    );
    this.velocity = new THREE.Vector3();
    this.onFloor = false;
    this.health = 120;
    this.maxHealth = 120;
    this.score = 0;
    this.bob = 0;
    this.spawn = new THREE.Vector3();
    this.camera.rotation.order = 'YXZ';
  }

  reset(position = new THREE.Vector3(0, 1, 8)) {
    this.spawn.copy(position);
    this.teleport(position);
    this.health = this.maxHealth;
  }

  teleport(position) {
    this.collider.start.set(position.x, position.y - PHYSICS.playerHeight + PHYSICS.playerRadius, position.z);
    this.collider.end.set(position.x, position.y, position.z);
    this.velocity.set(0, 0, 0);
    this.onFloor = false;
    this.camera.position.copy(this.collider.end);
  }

  update(delta, input) {
    const speed = input.sprint ? PHYSICS.sprintSpeed : PHYSICS.walkSpeed;
    const control = this.onFloor ? 1 : PHYSICS.airControl;
    this.camera.getWorldDirection(_forward);
    _forward.y = 0;
    _forward.normalize();
    _right.crossVectors(_forward, this.camera.up).normalize();
    _move.set(0, 0, 0).addScaledVector(_forward, input.forward).addScaledVector(_right, input.strafe);
    if (_move.lengthSq() > 1) _move.normalize();
    this.velocity.addScaledVector(_move, speed * control * delta * 8);
    if (this.onFloor) {
      const damping = Math.exp(-PHYSICS.damping * delta) - 1;
      this.velocity.addScaledVector(this.velocity, damping);
      if (input.jump) this.velocity.y = PHYSICS.jumpSpeed;
    } else {
      this.velocity.y -= PHYSICS.gravity * delta;
    }
    this.collider.translate(this.velocity.clone().multiplyScalar(delta));
    this.onFloor = this.physicsWorld.resolveCapsule(this.collider, this.velocity);
    if (this.collider.end.y < -30) this.reset(this.spawn);
    this.bob += Math.min(1, Math.abs(input.forward) + Math.abs(input.strafe)) * delta * (input.sprint ? 12 : 8);
    this.camera.position.copy(this.collider.end);
    this.camera.position.y += this.onFloor ? Math.sin(this.bob) * 0.025 : 0;
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.reset(this.spawn);
  }
}
