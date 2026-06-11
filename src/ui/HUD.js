import { LEVELS } from '../config/GameConfig.js';

export class HUD {
  constructor(root) {
    this.root = root;
    this.els = {
      health: document.getElementById('hud-health'),
      ammo: document.getElementById('hud-ammo'),
      weapon: document.getElementById('hud-weapon'),
      wave: document.getElementById('hud-wave'),
      score: document.getElementById('hud-score'),
      map: document.getElementById('hud-map'),
      message: document.getElementById('message'),
      stats: document.getElementById('stats')
    };
    this.messageTimer = 0;
  }

  message(text, seconds = 2.0) {
    this.els.message.textContent = text;
    this.messageTimer = seconds;
  }

  update(delta, { player, weaponSystem, enemySystem, levelId }) {
    this.messageTimer = Math.max(0, this.messageTimer - delta);
    if (this.messageTimer === 0 && document.pointerLockElement) this.els.message.textContent = '';
    const weapon = weaponSystem.current;
    this.els.health.textContent = Math.round(player.health);
    this.els.ammo.textContent = weapon.magLeft === Infinity ? '∞' : `${weapon.magLeft}/${weapon.ammoLeft}`;
    this.els.weapon.textContent = weapon.name;
    this.els.wave.textContent = enemySystem.wave;
    this.els.score.textContent = player.score;
    this.els.map.textContent = LEVELS[levelId]?.label || levelId;
    this.els.stats.classList.toggle('health-low', player.health < player.maxHealth * 0.32);
  }
}
