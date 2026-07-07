# Implementation Notes — Open World Refactor

## Key Line Ranges in js/game.js (3107 lines total)
- Constructor: 4-106
- initWorld: 108-113
- buildWorld (level dispatch): 115-181 — calls _expandWorld(3.0) at end
- buildDesert: 184-407
- buildRailCity: 408-670
- buildMegaCity: 671-878
- buildCity: 880-1048
- buildFields: 1051-1161
- createWeaponModel: 1164-1600
- initUI: 1587-1701
- setupInputs: 1703-1795 (wheel switching already at 1738-1743)
- start(): 1798-1843
- switchWeapon: 1874-1882
- buildWave/spawnWave: 1892-1939
- buildRange: 1944-2066
- spawnEnemy: 2025-2108
- fireWeapon: 2142-2322
- update(): 2530-2977
- drawMinimap: 2979-3008
- updateHUD: 3011-3037
- endGame: 3039-3047
- autoQuality: 3051-3070
- animate: 3072-3079
- window.onload: 3091-3107

## Key Architecture Facts
- buildWorld destroys old worldGroup and creates a new one
- _expandWorld(3.0) scales all geometry positions x/z by 3.0 (so 700-unit ground becomes 2100)
- Level builders add sky domes, ground planes, objects, lights to W (worldGroup)
- Each builder sets scene.fog and scene.background
- Enemies spawn via spawnEnemy() which uses EnemyFactory from enemies.js
- All enemies are golems (grunt, tank, shooter, boss, spider, runner)
- Wheel switching: already implemented at line 1738-1743
- No portals in this version of game.js (only in project/js/game.js which is 4201 lines)
- The _expandWorld(3.0) call means all coordinates in builders are multiplied by 3

## Texture Assets Available (root of repo)
- T_Concrete_Asphalt_BaseColor.png (asphalt roads)
- T_Concrete_BaseColor.png + T_Concrete_Normal.png + T_Concrete_ORM.png (buildings)
- T_Dirt_BaseColor.png + T_Dirt_Normal.png + T_Dirt_ORM.png (fields/transitions)
- T_MarbleFloor_BaseColor.png + T_MarbleFloor_Normal.png + T_MarbleFloor_ORM.png (interiors)
- T_MetalConcrete_BaseColor.png (industrial)
- T_RedBrick_Normal.png + T_RedBrick_ORM.png (buildings)
- T_RoofSlate_BaseColor.png + T_RoofSlate_ORM.png (rooftops)
- T_Trim_BaseColor.png + T_Trim_Normal.png + T_Trim_ORM.png (building trim)
- T_Street_Decals.png (road markings)
- T_lit_interior_1.png, T_lit_interior_2.png, T_dark_interior.png (windows)
- T_Blinds.png, T_Curtains.png (window details)

## TextureGen Already Loads These (textures.js lines 27-76):
- asphalt, concrete, lit1, lit2, dark, concreteN, marble, marbleN, dirt, dirtN, metal, brickN

## Strategy for Open World
1. Replace buildWorld() to call ALL sector builders into offset sub-groups
2. Each sector gets its own THREE.Group positioned at sector offset
3. Sector visibility toggled by distance from player (perf optimization)
4. Remove _expandWorld(3.0) — sectors are already large enough at native scale
5. Single sky dome + dynamic fog that blends between sectors
6. Spawn enemies around player regardless of sector
7. Add sector-entering HUD notification
8. Minimap shows sector boundaries

## project/js/game.js Differences (4201 lines)
- Has buildHouseYardBossLevel and portals (createPortal, updatePortals)
- Has more levels (houseyard, jungle)
- Has more weapon types (railgun, sniper, bow, katana, shuriken)
- Has dual-wield system
- We will REPLACE project/js/game.js with the new unified version (copy from js/game.js)
