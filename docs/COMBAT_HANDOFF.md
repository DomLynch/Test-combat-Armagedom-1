# ARMAGEDOM developer handoff: mobile combat

Prepared 5 October 2026. This describes the independent prototype Dom has just accepted visually, with the exact implementation supplied alongside this guide. It is an integration reference, not an ARMAGEDOM patch.

- Play reference: https://degree-choice.com/?v=combat-18
- Repository: https://github.com/DomLynch/Test-combat-Armagedom-1
- Frozen runtime/code revision: `ab135cc977089c0972d724c0e67c53f7a139cd7e`
- Live release: `combat-18-ab135cc9-d6a9e9`
- Documentation baseline before this handoff: `de12e38ba1b75d3674fd2820b11917f770c07fa0`
- No main ARMAGEDOM source, assets or hosting were changed to produce this package.

## Intended player experience

On mobile, the left thumb moves and turns the whole character through any angle. Nearby opponents get partial aim assistance and gentle retention while walking. The right button only fires; dragging it does not steer. This leaves room for ARMAGEDOM's future attack, block and guard buttons. Desktop retains WASD/arrows plus mouse aim and mouse/Space fire.

The final design is an isometric adaptation. Earlier versions had a right aim stick, swipe aiming and hold-and-drag FIRE; these were superseded by Dom's fire-only request. Do not port those older controls.

## What changed, how and why

| Area | Final implementation | Reason |
| --- | --- | --- |
| Movement | Screen-relative analog left stick; radial neutral zone; normalized diagonals | Thumb direction matches the angled view; diagonal travel cannot exceed normal speed |
| Turning | Smooth direction changes, then rotate one whole-character root | Avoid sudden flicks and the torso twisting while feet remain north |
| Fire | Independent pointer ownership; press/hold/release, no drag aim | Two thumbs suffice; firing cannot trap facing or occupy a second movement control |
| Short taps | Queue a contact until the next animation frame; cancel clears it | A tap shorter than a frame can still shoot when the weapon is ready |
| Aim assistance | Partial correction close to an already-nearby bearing, fading with distance | Easier targeting for beginners without full auto-targeting |
| Retention | Acquire inside 6°, retain inside 9°; compensate bearing changes during travel | Small walking changes no longer force repeated reacquisition |
| Target indicator | First live opponent intersected by actual gun heading | Arrow/ring sit on the opponent rather than a fixed midpoint |
| Shooting | Analytic hitscan; nearest hit; wall clipping; logical origin at actor | Predictable hits and point-blank shots despite a protruding visual barrel |
| Reload | Contact action; started/busy/full states; visible countdown and ring | Repeated taps do not restart reload; a full magazine visibly explains no refill |
| Impact | Recoil/slide, local visual hold, victim flinch, flash, burst, camera impulse and sound | Make individual hits and kills readable on a small screen |
| High versus Off | Larger/longer High visuals and layered sound; Off uses original simple feedback | Prior contrast was too subtle; opposing shot/hit camera impulses also cancelled |
| Browser controls | Separate pointer IDs/capture, cancellation cleanup, layered zoom guards | Simultaneous movement/fire remain reliable without browser zoom taking over |

## Code map

All listed files are included in the runnable `prototype/` folder of the ZIP.

| File | What to use |
| --- | --- |
| [src/combat.js](../src/combat.js) | Pure math, `StickyAim`, ray-circle tests, target selection, weapon state |
| [src/input.js](../src/input.js) | Pointer/keyboard adapter, fire-only contract, queued taps, `bindAction` |
| [src/main.js](../src/main.js) | Integration/frame order, actor heading, shooting, HUD, particles and camera |
| [src/impact.js](../src/impact.js) | Presentation-only `ImpactFeedback` and `HitReaction` clocks |
| [src/audio.js](../src/audio.js) | Gesture-unlocked, bounded procedural Web Audio |
| [src/touch.js](../src/touch.js) | Safari gesture and double-tap prevention with valid two-thumb pair |
| [index.html](../index.html), [style.css](../style.css) | Required control IDs, overlays, viewport, safe areas and layout |
| [tests/combat.test.mjs](../tests/combat.test.mjs) | 18 logic tests; reusable after adapting imports |
| [tests/browser.mjs](../tests/browser.mjs) | Real mouse/two-finger reference play checks; adapt selectors/diagnostics to ARMAGEDOM |

`src/main.js` is a complete reference scene, not a module to paste wholesale over ARMAGEDOM. Extract the relevant frame logic into its existing player/input/combat/presentation owners. `turnAim()` in combat.js is a historical swipe helper still tested; the final runtime does not call it.

## Coordinate and movement contract

The ground plane is X/Z; Y is height. Ground heading is `atan2(x, z)`. An actor built facing local −Z uses:

```js
const desiredYaw = Math.atan2(-Math.sin(rawAngle + correction),
                             -Math.cos(rawAngle + correction));
bodyYaw = followAngle(bodyYaw, desiredYaw, dt); // default rate 24
playerRoot.rotation.y = bodyYaw;
aimX = -Math.sin(bodyYaw);
aimZ = -Math.cos(bodyYaw);
```

Feet, hips, torso and gun inherit that same root heading. Leg gait animates locally, without separate leg yaw. If ARMAGEDOM's model faces +Z, supply a model-facing offset once; do not apply this −Z convention blindly.

Stick coordinates use screen-right X and screen-down Y. `worldVector()` compensates vertical isometric foreshortening and camera yaw, preserving radial analog strength. Reference camera yaw is π/4 and verticalScale is `22 / sqrt(18² + 22² + 18²)`, approximately 0.653882. Use ARMAGEDOM's actual stable camera basis if its angle differs.

| Setting | Exact final value |
| --- | --- |
| Stick neutral zone | 13% of effective radius |
| Effective stick radius | 37% of the control element's width |
| Radial strength | `clamp((length/radius - 0.13) / 0.87, 0, 1)` |
| Normal walking speed | 6 prototype world units/second |
| Desktop focus speed | 3 units/second while right mouse focus is held |
| Mobile angular steering filter | Exponential shortest-arc rate 10/second |
| Whole-body heading filter | Exponential shortest-arc rate 24/second |
| Filter formula | `current + wrap(target-current) * (1-exp(-dt*rate))` |

Angular steering changes the travel direction without reducing radial walking speed. Lifting the stick stops translation immediately; there is no travel inertia. The body settles its short turn filter. In ordinary unassisted movement it faces travel; during target retention it can face the assisted opponent while travelling sideways. FIRE never overrides either behavior.

## Aim assistance and stickiness

The UI's **+50%** is a boost over the combat10 gain, not a 50% hit chance, 50% accuracy, 50% correction or an extra 50% each frame.

```js
const gain = 0.4125; // original 0.275 * 1.5
const falloff = Math.max(0, Math.min(1, (6 - distance) / 4));
const correction = wrappedBearingError * gain * falloff;
// effectiveHeading = rawHeading + correction
```

| Setting | Value/behavior |
| --- | --- |
| Acquire cone | Strictly less than 6° absolute bearing error |
| Retain cone | Strictly less than 9° absolute bearing error |
| Range | Strictly less than 6 world units; ignore distances below 0.01 |
| Full strength | At distance ≤2 |
| Half strength | At distance 4 |
| Zero strength | At/above distance 6 |
| Gain | 0.4125 for both rifle and pistol, acquisition and retention |
| Candidate choice | Smallest angular error among living, in-range targets |
| Example | 4° error at distance2 receives 1.65° correction; 2.35° manual error remains |

The correction is added to a stored **raw** heading, not fed back into it every frame. This prevents passive convergence into a hard lock.

`StickyAim.track()` adds the change in target bearing caused by player/opponent travel to the raw heading. The frame loop separately adds the wrapped change in filtered left-stick direction. Together they preserve intentional aim error while walking, and still allow deliberate turning away. `StickyAim.update()` retains the existing candidate within9° before considering another candidate within6°. A competing target cannot steal a valid retained target.

Retention is active only when assist is enabled, touch aiming owns the mode, the left control remains held and desktop pointer aim is absent. New sticky acquisition requires actual movement. Lift/cancel/OFF, death, range loss or deliberate turning beyond the release cone clear retention. After lifting, the stateless proximity nudge can still apply to the stored touch heading; retained travel tracking is cleared. There is no 50% time delay to unlock: the earlier “50% stickiness” became the wider angular release cone.

`StickyAim.target` is an array index in this fixed seven-target prototype. In a production mob list, use a stable entity ID/reference so despawns, reordering and pooling cannot silently transfer retention. Filter faction/visibility and test wall occlusion against ARMAGEDOM's world; the prototype assist itself does not test line of sight.

## Shooting, hit tests and reload

| Weapon | Magazine | Shot interval | Reload | Damage | Base spread half-angle |
| --- | --- | --- | --- | --- | --- |
| Rifle | 30 | 0.105s (~9.52 shots/s nominal) | 1.35s | 25 | 0.022rad (~1.26°) |
| Pistol | 12 | 0.27s (~3.70 shots/s nominal) | 0.95s | 40 | 0.012rad (~0.69°) |

The random shot angle is `heading + (random()-0.5)*spread*2`. Moving doubles spread; desktop right-mouse focus multiplies it by0.25. Visual recoil does not add ballistic aim drift or cumulative spread. The `kick` fields in WEAPONS are legacy values, unused by this runtime's effects; use impact.js/main.js values instead.

`WeaponState.fire()` gates shots on cooldown, reload and ammo. Empty-trigger fire starts reload; reserve ammo is unlimited. Holding FIRE repeats shots for both weapons, including the pistol. It is not a true one-shot-per-press semiautomatic implementation. A brief ready pistol tap queues one frame opportunity; a tap during cooldown/reload is consumed without waiting indefinitely. Swapping cancels reload, preserves both magazines and applies a0.22s switch cooldown.

Reload returns `started`, `busy` or `full`; repeated busy taps do not reset the timer. `tick(dt)` refills when reload reaches zero. The HUD changes immediately on contact and completion, otherwise roughly every80ms, with countdown and progress ring around FIRE.

Hitscan uses a normalized shot direction and a circle radius0.58 on the ground plane, maximum distance32. The nearest living target entry wins, unless an arena wall at±14 lies closer. Damage uses the true actor/target positions. The ray starts at the player center so the long visual gun cannot overshoot point-blank opponents. The tracer starts at the muzzle except when an impact lies before it, in which case it starts at the player. Tracers last65ms and reuse a16-slot pool.

For ARMAGEDOM, use its actual collision bodies and blockers. Preserve the close-range behavior but do not transplant flat-circle hitboxes, arena bounds, unlimited ammo or the dummy's two-second respawn into its gameplay. Authoritative damage, cadence, ammo and reload belong in its existing multiplayer/server model.

## Target arrow versus assisted target

The arrow/ring uses `targetOnRay()` with the **smoothed visible gun direction before random bullet spread**, choosing the first living intersected target before a wall. It is separate from `StickyAim.target`. An assisted nearby opponent may be retained while the actual ray still misses it; therefore the arrow can clear even while partial assistance is active. This avoids promising a hit the current gun heading does not make. Spread can still make an individual shot miss.

When a target is selected, the ring uses its current X/Z and scales2.8; the overhead arrow is projected at height2.65. Otherwise the ring sits along the aim ray at the stored distance (initially5, minimum3). Offscreen feedback clamps an edge arrow26px inside the viewport. The hit marker lasts200ms at the last hit opponent's center; particles burst at the ray entry. Adapt heights and scale to ARMAGEDOM's models/camera.

## Universal impact effects

`ImpactFeedback` and `HitReaction` are presentation state. They never pause movement, targeting, damage, cooldown or reload. Their short holds freeze only recoil/slide or victim-reaction decay, rather than the whole frame. The remaining time is consumed exactly: `visualDt = max(0, dt - remainingHold)`.

| Effect | High values |
| --- | --- |
| Gun recoil energy | Reset to1 per accepted shot; decay rifle18/s, pistol12/s |
| Backward local gun movement | Rifle0.34, pistol0.5 world units × energy |
| Upward gun rotation | Rifle0.14, pistol0.22rad × energy |
| Pistol slide | 0.22 local units × slide energy, decay26/s |
| Weapon visual hit hold | Rifle40ms, pistol50ms; kill80ms |
| Victim reaction hold | Normal45ms; kill80ms |
| Victim lean | Normal0.45rad, kill0.9rad × energy |
| Victim displacement | 0.16 units along shot direction × energy, visual pivot only |
| Victim decay | Normal12/s, kill10/s; kill adds visual downward collapse |
| Target white flash | 100ms |
| Muzzle flash | 60ms, size0.4×0.35×0.43 |
| Burst count | 8 hit / 12 kill |
| Burst size/lifetime | Hit0.12 units/300ms; kill0.16/420ms |
| Camera impulses | Rifle shot1.8; pistol shot3; hit4; kill8; accumulated vector capped8 |
| Camera return | Exponential decay18/s, cosine wave `cos(age*45)` |
| Hit label | HIT / DOWN,200ms |

Shot and impact camera impulses use the same backward direction; earlier opposite directions partly cancelled. Convert the amplitude using `(camera.top-camera.bottom)/viewportHeight`; these are pixel-scale world translations, not a guaranteed exact screen-axis8px displacement in every camera. Keep the DOM HUD stationary. Compute mouse aim against the unshaken camera, then restore cosmetic motion for rendering. Gun/reaction scales must be adapted to the actual mesh dimensions.

Keep the victim's logical collider/root fixed during flinch. The prototype uses a child visual pivot; kills remove the actor from aiming/damage immediately, while its dying visual remains briefly visible.

Particles use one48-instance mesh, a preallocated48-slot ring pool, shared geometry/material, no particle shadows and reused transform/color helpers. Tracers also reuse geometry. There is no impact-time particle mesh creation or postprocessing dependency.

| Mode | Behavior |
| --- | --- |
| High | Full recoil/slide/flinch, holds, camera, bursts and layered audio; larger flashes/HIT/DOWN |
| Low | Energy0.4; three smaller particles; no camera/holds; enhanced audio remains; smaller flash/× marker |
| Off | No added recoil/slide/flinch/particles/camera/holds; original basic flashes/tracers/× marker and simple shot/hit tones remain |

Reduced-motion preference starts Low. Changing mode/reset/swap/background/resize clears residual visual state. Sound mute is independent of FX. One visual/audio implementation works through standard browser capabilities; no vibration or separate Android/iOS effect path.

## Audio and input lifecycle

Audio unlocks on pointerdown/keydown. High/Low shots use a downward-pitched body tone plus cached filtered-noise transient. Hits use a short body tone plus transient; kills add a rising chime. Off uses one original simple tone per shot/hit. `src/audio.js` contains the exact frequencies, envelopes and volumes. One cached160ms noise buffer, output gain0.65, compressor threshold−12dB/knee8/ratio4 and at most16 active sources limit cost. Ended nodes disconnect; mute stops current sources. Lack of AudioContext must not break combat.

Left stick and FIRE have separate pointer IDs and pointer capture. Pointermove cannot steal an unowned finger. `pointerup` releases only that role; cancel/unexpected lost capture also removes queued fire. Blur, hidden document and resize clear held input. Pagehide clears controls/effects and stops rendering; restored back-forward-cache pages reload. WebGL context loss clears controls and pauses with a visible message.

Reload/swap use `bindAction()` on pointerdown. Compatibility clicks are suppressed; detail0 click retains keyboard/accessibility activation. Ordinary menu toggles stay click-based. Do not attach multiple copies of these document listeners when switching scenes; add teardown or one app-lifetime owner in ARMAGEDOM.

The zoom kit consists of viewport scale bounds; whole-page touch-action:none/overscroll protection; minimum16px input/select/textarea fonts; non-passive gesturestart/change/end cancellation; guarded multi-touch; and game-only second touchend within350ms cancellation. Valid move+action two-thumb pairs are allowed. Neither preventDefault nor these guards should stop propagation/ownership of game pointers. Adapt `#game`, `#move`, `#fire-right`, `.actions` and role recognition for ARMAGEDOM's extra buttons; retain normal scrolling/focus behavior in its menus.

## Integration order and acceptance

1. Port math and input contracts into a private development build. Map camera axes, model forward direction, units, control IDs and stable mob IDs.
2. Use the reference frame order in main.js: tick ordinary weapon/effect clocks; update target positions; filter left direction and move; track retained bearing and manual direction delta; apply one partial correction; smooth whole-body yaw; derive gun direction; fire; update visuals; select/project indicators; render.
3. Integrate shooting/reload through existing collision and authoritative gameplay. Keep fire-only semantics and short contact handling.
4. Attach effects to accepted shot/hit/kill events using separate visual pivots/clocks. Drive mouse aiming from stable camera state. Add audio and FX High/Low/Off controls.
5. Reproduce the same touch/desktop scenarios before promoting into the main game. Use equivalent in-engine checks; the bundled browser test relies on the prototype DOM and read-only `window.__combat.snapshot()` diagnostics.

Acceptance scenarios:

- Walk and turn0°,37°,90°,133°,180°,225°,270°,315°,360°; feet/body/gun agree. No diagonal speed boost; release stops travel. Turning softens flicks without lowering walking speed.
- Hold FIRE while steering, drag FIRE around, release each finger separately, cancel a press, background/resize. FIRE never turns/moves; no stuck or orphan shot.
- Acquire close to a target; retain while walking/jittering; deliberately leave9°; lift/OFF/kill/despawn/out-of-range. Manual offset remains. Check walls, competing mobs and reordered entity lists.
- Shoot close, moving and behind cover with both weapons; marker follows the first real ray target and clears on death/turn-away. Test tap, hold, cooldown, empty magazine, repeated reload, full-mag feedback and swap.
- Compare High/Low/Off on hit and kill. Confirm recoil/slide/flinch/burst/sound distinction, bounded rapid-fire camera/pool/audio, stable HUD/mouse aim and continuing movement/reload/fire through visual holds.
- Rapid taps and simultaneous controls on actual iPhone Safari and Android, both orientations; tablet and Windows/Mac mouse/keyboard; reduced-motion/mute; safe-area HUD fit and device frame pacing.

Reference evidence:18 logic tests, local recorded Chromium play and public two-finger Chromium checks passed for this exact runtime. Twelve public file hashes/no-store checks matched. The evidence folder includes scoped results and reviewed motion contact sheet. These do not substitute for ARMAGEDOM integration or physical Safari/Android acceptance. Dom subsequently said the prototype looked amazing and liked it; this is subjective prototype feedback, not acceptance of a main-game port.

## Run the supplied reference

From the ZIP's `prototype/` directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm start
# Open http://localhost:4173
```

Pure logic: `npm test`. Browser reference: `npm run test:browser` with installed Playwright Chromium or `CHROMIUM_PATH` pointing at it. Dom's workspace runs substantial tests/captures through its VPS queue; reuse existing receipts for this unchanged code. Runtime Three.js0.186.1 is vendored with its MIT notice, with no external CDN required.

The ZIP contains no hosting/activation scripts, credentials or ARMAGEDOM files. Do not use it to replace the main game's project, assets or deployment configuration.
