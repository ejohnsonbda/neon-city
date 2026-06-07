
export const PHYSICS = Object.freeze({
  gravity: 30,
  stepsPerFrame: 5,
  maxDelta: 0.05,
  playerRadius: 0.35,
  playerHeight: 1.7,
  jumpSpeed: 10.5,
  walkSpeed: 10.5,
  sprintSpeed: 17.5,
  airControl: 0.36,
  damping: 10
});

export const RENDERING = Object.freeze({
  fov: 72,
  near: 0.1,
  far: 900,
  pixelRatioCap: 1.5,
  clearColor: 0x05060c
});

export const WEAPONS = Object.freeze([
  { id: 'pistol', name: 'Pistol', damage: 38, rate: 220, ammo: Infinity, mag: Infinity, spread: 0.006, color: 0x19f0ff },
  { id: 'pulse', name: 'Pulse SMG', damage: 13, rate: 70, ammo: 240, mag: 60, spread: 0.032, color: 0xffd166 },
  { id: 'cleaner', name: 'Cleaner Rail', damage: 95, rate: 760, ammo: 36, mag: 6, spread: 0.001, color: 0x6dff69 }
]);

export const LEVELS = Object.freeze({
  'neon-city': { label: 'Neon City', accent: 0x19f0ff },
  desert: { label: 'Egypt', accent: 0xffd166 },
  'lost-jungle': { label: 'Lost Jungle', accent: 0x78ff65 },
  underground: { label: 'Underground Cleaners', accent: 0xffd166 }
});
