# Test-combat-Armagedom-1

Simple Three.js mobile-web combat prototype. Lit 3D isometric range with a close, gently following orthographic camera, a primitive armed humanoid, and seven targets (one moving). No art pipeline, game engine, or bundler.

## Play

**[Open the mobile demo](https://degree-choice.com/?v=combat-6)**

Opens straight into the range with a viewport-filling canvas and no start popup or iframe. Full screen is available through the button where the browser supports it; the web manifest supports opening from the home screen in standalone mode.

- Left stick moves. Swipe sideways on the free right half to turn the gun through 360°. Swipe up/down to adjust reticle distance. Lift and replant without an aim jump.
- Hold the right **FIRE** button to shoot. Drag the same thumb while holding to adjust aim, including outside the button. Left thumb can keep moving throughout: only two fingers needed.
- Aim sensitivity cycles Low/Normal/High. Normal sensitivity turns one degree per horizontal pixel; heading is independent of reticle distance, so short-radius aiming cannot block turns.
- Off-screen aiming has a visible edge arrow. Hits flash a marker at the reticle; reload shows progress around FIRE. Short procedural shot/impact sounds unlock on first interaction; Sound toggles mute.
- Swipe-to-aim alone never fires. The isometric camera keeps its fixed angle and follows the player.
- RIFLE/PISTOL switches weapon; RELOAD responds on contact and refills with unlimited reserve. Repeated taps retain reload progress; a full magazine gives explicit feedback.
- Assist: Light gives touch aim a small nudge only within six degrees of a nearby living target. It corrects at most 1.5° up close and fades to zero at six arena units. Toggle Assist: OFF for fully manual aim.
- Desktop: WASD/arrows, mouse aim, left mouse/Space fire, right mouse focus, R reload, Q switch.
- Landscape recommended; safe-area padding and portrait layout included.

```sh
npm ci
npm start
```

Open http://localhost:4173 or the Mac's LAN IP on a phone on the same Wi-Fi. Three.js 0.186.1 is vendored with its MIT license; runtime uses no third-party CDN. Update vendor files intentionally from the pinned npm package.

## Control rationale

[PUBG Mobile's official controls](https://pubgmobile.helpshift.com/hc/en/3-pubg-mobile/faq/37-what-are-the-controls/) separate movement, aim and attack. [Fortnite's official mobile guide](https://www.fortnite.com/news/getting-started---fortnite-for-mobile) documents dedicated held fire and alternative firing modes. This prototype uses a two-thumb adaptation for a fixed isometric camera: free right-side swipe aiming and a separate fire button that also accepts aiming drags. The owner-provided [COD Mobile HUD video](https://www.youtube.com/watch?v=rft_7jTa5N4) shows the two-finger baseline at 0:45 before its claw examples. No extra fingers, jump/crouch controls or first-person camera rotation are required.

Pointer capture tracks each finger separately, with a radial deadzone, analog movement, normalized diagonal speed, unrestricted relative angular turns, persistent aim, and clearing on cancellation/backgrounding/resize. Optional light proximity assist does not accumulate into the manual heading or retain a target lock. Simple Lambert materials, two lights, one 512px shadow map, capped pixel ratio, pooled tracers, no textures or postprocessing.

ARMAGEDOM was inspected read-only for angled-camera and lit-actor visual inspiration. All movement, input, targeting and weapon code is independently authored in this repository; no ARMAGEDOM combat code, actors, assets, or dependencies are imported.

## Verification

`npm test` checks deadzone, normalized motion, hitscan, full-circle turning independent of radius, light assist falloff and explicit reload status, firing cadence, magazines/reload and swap. `npm run test:browser` performs real Chromium mouse and simultaneous multi-touch checks; run on the VPS through the workspace runner. Browser screenshots land in ignored `artifacts/`. Physical iPhone/Safari feel requires device play.

On the workspace VPS, use `CHROMIUM_PATH=/opt/frankendom-shadow/ms-playwright/chromium-1234/chrome-linux64/chrome npm run test:browser` to reuse the installed browser. Else install the pinned Playwright browser with `npx playwright install chromium`.

## Degree Choice hosting

The prototype has an independent static root at `/var/www/test-combat-armagedom-1/current`, pointing to a hash-pinned release. `ops/degree-choice.conf` serves only Degree Choice and uses its existing TLS/ACME setup. Old `/armagedom` routes return 410 on this domain. `ops/activate-degree-choice.py` guards the inspected Degree Choice config, checks payload hashes, tests nginx, reloads only when the Degree Choice config changes, and verifies protected main-game config hashes and its pinned page before/after; rollback restores only this domain's config and prototype pointer. Routine payload updates swap only the prototype symlink and leave nginx configuration untouched. Private backups are under `/var/backups/test-combat-armagedom-1/`. It never edits `playarmagedom.com` configuration, shared game snippets, or game assets.
