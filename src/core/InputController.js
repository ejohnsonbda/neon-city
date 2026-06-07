export class InputController {
  constructor(camera, domElement, message) {
    this.camera = camera;
    this.domElement = domElement;
    this.message = message;
    this.keys = new Map();
    this.pointerLocked = false;
    this.mouseDown = false;
    this.sensitivity = 0.0022;
    this.onFire = () => {};
    this.onReload = () => {};
    this.onWeapon = () => {};
  }

  bind() {
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.domElement;
      this.setMessage(this.pointerLocked ? '' : 'Pointer released · click Deploy to resume');
    });
    this.domElement.addEventListener('click', () => this.lock());
    document.addEventListener('mousedown', () => { this.mouseDown = true; if (this.pointerLocked) this.onFire(); });
    document.addEventListener('mouseup', () => { this.mouseDown = false; });
    document.addEventListener('mousemove', (event) => this.look(event));
    document.addEventListener('keydown', (event) => this.key(event, true));
    document.addEventListener('keyup', (event) => this.key(event, false));
  }

  lock() {
    this.domElement.requestPointerLock?.();
  }

  key(event, down) {
    this.keys.set(event.code, down);
    if (!down) return;
    if (event.code === 'KeyR') this.onReload();
    if (event.code === 'Digit1') this.onWeapon(0);
    if (event.code === 'Digit2') this.onWeapon(1);
    if (event.code === 'Digit3') this.onWeapon(2);
    if (event.code === 'Digit7') this.onWeapon(3);
  }

  look(event) {
    if (!this.pointerLocked) return;
    this.camera.rotation.y -= event.movementX * this.sensitivity;
    this.camera.rotation.x -= event.movementY * this.sensitivity;
    this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
  }

  state() {
    return {
      forward: Number(this.keys.get('KeyW')) - Number(this.keys.get('KeyS')),
      strafe: Number(this.keys.get('KeyD')) - Number(this.keys.get('KeyA')),
      sprint: Boolean(this.keys.get('ShiftLeft') || this.keys.get('ShiftRight')),
      jump: Boolean(this.keys.get('Space')),
      fire: this.mouseDown && this.pointerLocked
    };
  }

  setMessage(text) {
    if (this.message) this.message.textContent = text;
  }
}
