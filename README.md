# Test-combat-Armagedom-1

Simple Three.js mobile-web combat prototype. Lit 3D isometric range with a close, gently following orthographic camera, a primitive armed humanoid, and seven targets (one moving). No art pipeline, game engine, or bundler.

## Play

**[Open the mobile demo](https://domlynch.github.io/Test-combat-Armagedom-1/)**

- Left stick moves; right stick aims independently. Both sticks follow screen direction through the rotated isometric camera. Facing stays where you last aimed.
- Hold either FIRE button. Left FIRE supports a third finger while both thumbs use sticks.
- Toggle **Aim + fire** for two-thumb movement and shooting. Firing starts past half stick travel.
- RIFLE/PISTOL switches weapon; RELOAD refills with unlimited reserve. FOCUS reduces spread and movement speed while held.
- Desktop: WASD/arrows, mouse aim, left mouse/Space fire, right mouse focus, R reload, Q switch.
- Landscape recommended; safe-area padding and portrait layout included.

```sh
npm ci
npm start
```

Open http://localhost:4173 or the Mac's LAN IP on a phone on the same Wi-Fi. Three.js 0.186.1 is vendored with its MIT license; runtime uses no third-party CDN. Update vendor files intentionally from the pinned npm package.

## Control rationale

[PUBG Mobile's official controls](https://pubgmobile.helpshift.com/hc/en/3-pubg-mobile/faq/37-what-are-the-controls/) separate movement, aim and attack. [Fortnite's official mobile guide](https://www.fortnite.com/news/getting-started---fortnite-for-mobile) documents dedicated held fire and alternative firing modes. This prototype adapts those principles to a top-down direction stick; it does not reproduce their first-person camera controls or claim a ranking of 2026 games.

Pointer capture tracks each finger separately, with a radial deadzone, analog movement, normalized diagonal speed, immediate aim, and clearing on cancellation/backgrounding/resize. No aim assist: the test exposes the underlying feel. Simple Lambert materials, two lights, one 512px shadow map, capped pixel ratio, pooled tracers, no textures or postprocessing.

ARMAGEDOM was inspected read-only for angled-camera and lit-actor visual inspiration. All movement, input, targeting and weapon code is independently authored in this repository; no ARMAGEDOM combat code, actors, assets, or dependencies are imported.

## Verification

`npm test` checks deadzone, normalized motion, hitscan, firing cadence, magazines/reload and swap. `npm run test:browser` performs real Chromium mouse and simultaneous multi-touch checks; run on the VPS through the workspace runner. Browser screenshots land in ignored `artifacts/`. Physical iPhone/Safari feel requires device play.

On the workspace VPS, use `CHROMIUM_PATH=/opt/frankendom-shadow/ms-playwright/chromium-1234/chrome-linux64/chrome npm run test:browser` to reuse the installed browser. Else install the pinned Playwright browser with `npx playwright install chromium`.
