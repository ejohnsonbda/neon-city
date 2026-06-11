# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/Neon City Nightfall.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `bshoot` project files (HTML prototypes, assets, components)

## Modular Three.js FPS Launcher

The repository now includes a modular Three.js FPS implementation at [`modular-fps.html`](./modular-fps.html). This launcher uses native ES modules and an import map for Three.js, so it can run from any static web server without a bundler. Its structure follows the official Three.js FPS example's core ideas: pointer-lock mouse look, `YXZ` camera rotation, capsule-based player physics, gravity, capped delta time, and fixed physics substeps.

The modular source lives under [`src/`](./src/) and is split into focused systems for rendering, input, player physics, world loading, combat, enemies, HUD, and reusable geometry. The original prototype HTML and legacy `js/` files are still kept in place as reference material.

A new Underground Cleaners map is included in the modular version to provide the requested underground section and cleaner-drone theme as maintainable level content.
