# Neon City: Nightfall - Unified Open World Design

## Overview
Transforming the existing level-based structure of Neon City: Nightfall into a single massive, continuous open world. This aligns with modern Battle Royale/Extraction Shooter paradigms (Fortnite, Call of Duty: Warzone), where players navigate a massive map comprising distinct themed sectors without loading screens or portals.

## Sector Layout & Coordinates
The world will be built on a massive grid. The previous distinct levels will be placed at significant offsets from the origin, creating a massive continuous map.

*   **Sector 1: Neon City (Center)**
    *   **Coordinates:** Origin (0, 0)
    *   **Radius:** ~300 units
    *   **Description:** The dense urban core with towering skyscrapers, neon signs, and the central plaza.
*   **Sector 2: The Fields / Countryside (North)**
    *   **Coordinates:** (0, 1000)
    *   **Radius:** ~400 units
    *   **Description:** Rolling hills, farmhouses, and the boss yard, acting as the rural outskirts.
*   **Sector 3: Egyptian Desert (South)**
    *   **Coordinates:** (0, -1000)
    *   **Radius:** ~400 units
    *   **Description:** Pyramids, sphinxes, and ruins blending into an oasis.
*   **Sector 4: Rail City / Industrial (East)**
    *   **Coordinates:** (1000, 0)
    *   **Radius:** ~350 units
    *   **Description:** Elevated monorail tracks, train cars, and industrial scaffolding.
*   **Sector 5: Megawatt City (West)**
    *   **Coordinates:** (-1000, 0)
    *   **Radius:** ~350 units
    *   **Description:** Denser, taller cyberpunk district with heavy traffic lanes.

## Seamless Transitions & Architecture
Instead of destroying and rebuilding the scene (`buildWorld`), the game will initialize all sectors into a single `THREE.Group` at startup.

1.  **Visibility Culling:** To maintain performance, each sector will be a sub-group. We will use a distance-check in the `update()` loop. If the player is > 800 units from a sector's center, that sector's group is set to `visible = false`. This mirrors the Wobbleton `AREAS` pattern.
2.  **Connecting Corridors:** To bridge the 1000-unit gaps, we will procedurally generate simple transitional geometry (e.g., ruined highways, desert canyons, or forested trails) connecting the sector hubs.
3.  **Portal Removal:** All `createPortal` calls will be deleted. Players will simply walk or sprint between zones.
4.  **Unified Sky & Fog:** The environment will use a single dynamic sky dome and fog setting that gently interpolates based on the player's current sector.

## Texture Integration
The repository contains high-quality PBR textures (BaseColor, Normal, ORM) that are currently underutilized in the main `js/game.js` runtime. We will inject these into the procedural builders:
*   `T_Concrete_Asphalt_BaseColor.png` & `T_Concrete_Normal.png` for city streets and highways.
*   `T_Dirt_BaseColor.png` & `T_Dirt_Normal.png` for the Fields and transition zones.
*   `T_RedBrick_Normal.png` & `T_RedBrick_ORM.png` for buildings and farmhouses.
*   `T_RoofSlate_BaseColor.png` for building tops.

## Gameplay Systems
*   **Minimap Updates:** The minimap will be scaled out to show the macro-sectors, or it will center on the player and dynamically render the local sector geometry. We will add a UI element indicating the current "Zone" (e.g., "ENTERING: EGYPTIAN DESERT").
*   **Weapon Wheel:** Already implemented in `js/game.js` lines 1738-1743. We will ensure it functions smoothly across the unified map.
*   **Unified Enemies:** The enemy factory already produces Golems exclusively. We will adjust the wave spawner to continuously spawn enemies around the player regardless of their current sector, utilizing the existing `enemies.js` definitions.

## Implementation Steps
1.  Refactor `Game.buildWorld()` to `Game.buildOpenWorld()`, calling all level builders but passing them offset `THREE.Group` containers.
2.  Modify the level builders (`buildCity`, `buildFields`, `buildDesert`, etc.) to accept `offsetX` and `offsetZ` parameters, applying these to all spawned geometry.
3.  Implement the sector distance-culling logic in `Game.update()`.
4.  Remove portal logic and `targetLevel` switching.
5.  Update `TextureGen` to force-load and apply the PBR maps to the corresponding materials.
6.  Mirror all changes from `js/game.js` to `project/js/game.js`.
