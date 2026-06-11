import { FPSGame } from './core/FPSGame.js';

const game = new FPSGame({
  root: document.getElementById('game-root'),
  hudRoot: document.getElementById('hud')
});

game.bootstrap();
window.neonCityFPS = game;
