# Modular Three.js FPS Architecture

Prepared by **Manus AI** on June 4, 2026.

This repository now targets a **modular web-based Three.js FPS project** rather than a single monolithic prototype script. The implementation is guided by the official Three.js `games_fps` example, especially its use of a `PerspectiveCamera` with `YXZ` rotation order, pointer-lock mouse look, fixed physics substeps, capped delta time, gravity, and a capsule-shaped player collider.

| Area | Official FPS example pattern | Neon City modular target |
|---|---|---|
| Application entry | One HTML example bootstraps an ES module scene. | `modular-fps.html` loads `src/main.js` with an import map. |
| Runtime shell | Scene, camera, renderer, timer, input, and physics exist in one example file. | `src/core/FPSGame.js` coordinates small modules for rendering, input, physics, levels, combat, enemies, and UI. |
| Player controller | Pointer-lock camera rotation, velocity, gravity, and sub-stepped collision. | `src/core/PlayerController.js` applies the same FPS movement model with `Capsule` and substeps. |
| Physics world | Octree and capsule intersection in the example. | `src/core/PhysicsWorld.js` keeps lightweight AABB colliders for generated level geometry while preserving the capsule player model. |
| Levels | The example loads one collision world. | `src/world/LevelManager.js` swaps multiple generated levels: Neon City, Japan, Lost Jungle, and Underground. |
| Gameplay systems | Example fires physics spheres. | `src/combat/WeaponSystem.js` handles hitscan fire; `src/enemies/EnemySystem.js` handles spawn/update/cleanup. |
| UI | Example has minimal overlay text/stats. | `src/ui/HUD.js` maintains crosshair, health, ammo, score, wave, and map status. |

The modular version intentionally keeps the existing exported prototype files intact, while adding a clean ES-module application that can become the source of truth for future work. This avoids destroying the handoff prototype while providing a maintainable codebase for gameplay iteration.

## File Layout

| Path | Responsibility |
|---|---|
| `modular-fps.html` | Browser launcher for the modular FPS app. |
| `src/main.js` | Entry point that creates and starts the game. |
| `src/config/GameConfig.js` | Shared constants for gravity, movement, physics substeps, weapons, colors, and maps. |
| `src/core/FPSGame.js` | High-level orchestrator for scene lifecycle, update loop, level changes, and system coordination. |
| `src/core/Renderer.js` | Renderer and resize management. |
| `src/core/InputController.js` | Keyboard, mouse, pointer-lock, and input-state handling. |
| `src/core/PlayerController.js` | Capsule-based FPS movement, gravity, jumping, camera bob, and collision response. |
| `src/core/PhysicsWorld.js` | Static world-collider registry and capsule-vs-AABB collision resolution. |
| `src/world/LevelManager.js` | Level loading, unloading, and collider registration. |
| `src/world/levels/*.js` | Individual generated level modules. |
| `src/combat/WeaponSystem.js` | Weapon switching, fire rate, ammo, reload, hitscan, tracers, and damage. |
| `src/enemies/EnemySystem.js` | Enemy spawning, pursuit, damage handling, and wave progression. |
| `src/ui/HUD.js` | HUD rendering and status messaging. |
| `src/utils/GeometryFactory.js` | Reusable geometry/material helper functions. |

## Implementation Notes

The modular FPS app should remain a static HTML/JavaScript project with no required bundler. It uses native ES modules and a browser import map that resolves `three` and `three/addons/`. This makes the project easy to run with a simple static server while keeping the codebase aligned with current Three.js example conventions.
