# Nightfall, Jungle Visibility, and Weapon Visual Update Validation

Validation date: 2026-06-04

## Root / Nightfall page

The repository root `index.html` redirects to `Neon City Nightfall.html`, so the main entry point is again the Nightfall experience. Browser validation loaded the Nightfall menu successfully at `http://127.0.0.1:8133/Neon%20City%20Nightfall.html`.

The theatre selector now visibly includes **LOST JUNGLE** between **EGYPT DESERT** and **FEUDAL JAPAN**. The Nightfall menu also exposes a **MODULAR FPS** link while preserving **BESTIARY** and the original prototype launcher flow.

Browser console status after root redirect and Nightfall menu load: **no console output / no runtime errors observed**.

## Modular FPS launcher

The modular launcher loaded successfully at `modular-fps.html`. The visible selector order is **Nightfall / Neon City**, **Lost Jungle**, **Underground Cleaners**, and **Japan**, and the level cards show **Lost Jungle** as a prominent selectable card. The first-person weapon view model rendered in the camera view, confirming that the revised `WeaponSystem` path is active.

Browser console status after modular launcher load: **no console output / no runtime errors observed**.

## Lost Jungle runtime check

Switching the modular FPS selector to **Lost Jungle** updated the HUD map label to **Lost Jungle** and rendered the green jungle environment with trees, terrain, water/ground accents, and the improved first-person weapon view. This verifies that the Jungle level is now both discoverable from the UI and runnable in the modular Three.js project.

Browser console status after Lost Jungle load: **no console output / no runtime errors observed**.
