# Combat prototype state

## Current — independent Degree Choice delivery, 2026-10-05

Owner allocated `degree-choice.com` to this prototype and explicitly prohibited touching the main game. Live https://degree-choice.com/?v=direct-3 serves directly with no startup popup/iframe; canvas fills the viewport. App source `e1ceb82e`, release `direct-3-e1ceb82e-1ab526`, independent root `/var/www/test-combat-armagedom-1/current`. Existing Degree Choice TLS/ACME retained; only that vhost was replaced. Old `/armagedom` routes now 410; no main-game redirects/includes/assets on this host. HTTP/www canonicalise to prototype HTTPS. Home-screen manifest provided; OS/browser full-screen acceptance remains a phone check.

Nine runtime files verified by SHA-256/MIME/no-store over public HTTPS; retired paths 410, absent paths strict404. Live browser job `test-combat-armagedom-1-5ce9bd99a38c` exit 0: immediate start, viewport fill, hits/reload, concurrent movement/aim/fire, cancellation and both orientations; no runtime/console errors. `/etc/nginx/sites-available/playarmagedom.conf`, its preview snippet, and the exact main028 HTML hashes matched before/after. No main-game files or configuration edited. Receipts: local ignored `artifacts/degree-choice/`; private rollback `/var/backups/test-combat-armagedom-1/direct-3-e1ceb82e-1ab526/`. Initial activation verification ran before nginx workers had finished reloading and restored only Degree Choice; bounded convergence check fixed the deployment race.

Next: owner phone play using the query-bearing link to bypass the former cached301. Future prototype publishing changes only this isolated root/Degree Choice vhost. Main game and shared snippets remain outside this lane.

## Previous — isometric revision 02, 2026-10-05

Owner corrected the visual target to a Diablo/Path of Exile style 3D isometric presentation. ARMAGEDOM is a read-only visual reference; combat/input/targeting remain independent and authored from scratch here. No donor code or assets imported, no ARMAGEDOM files written.

Changed: 45° camera rotation, raised angled viewpoint, closer framing with gentle player follow, lit primitive humanoid holding a gun, articulated walking legs, dimensional floor/rails/targets and one 512px shadow map. Sticks are mapped through the isometric camera basis so screen direction remains correct; mouse aiming intersects weapon height. Weapons and touch ownership retain the independent prototype foundation.

Evidence: five logic tests PASS (`test-combat-armagedom-1-f15d119e69f6`); final browser PASS (`test-combat-armagedom-1-964eca0f3f71`, exit 0). Verified screen-relative strafing/aim, following camera, real hits, reload, three concurrent fingers, release/cancel, two-thumb mode and both viewport layouts without runtime/console errors. Landscape/portrait screenshots visually reviewed; recovered into `artifacts/isometric/` with exact job manifest/result. The first browser test used wall time that was too short for the VPS software renderer; checks now wait for bounded simulation progress and still require actual movement/shots/hits.

Delivery: source `14586015fbfe9707007974aee56975ede92c9247` published by successful Pages run `37264263355`. Final URL/module cache keys use `isometric-2` so prior browser caches cannot retain the old camera; this final import graph also passed the browser checks (`test-combat-armagedom-1-5cb4dbf57ce3`, exit 0; recovered in `artifacts/isometric/final/`). Final publication/runtime HTTP/hash verification is retained in `artifacts/isometric/live-verification.json`. Physical iPhone/Safari frame pacing and player feel remain unverified; next step is owner landscape play. Initial receipts below are historical.

## Initial prototype receipts

2026-10-05. Canonical checkout: `/Users/domininclynch/Desktop/Business/Test-combat-Armagedom-1`. Repository: `DomLynch/Test-combat-Armagedom-1`. Scope: an isolated mobile-web control experiment; no main ARMAGEDOM source, Claude materials, or live game services modified.

Implemented: flat 2.5D Three.js range; independent analog movement/aim; two dedicated fire buttons; optional two-thumb aim-and-fire; rifle/pistol cadence, magazines, reload, recoil feedback and precision focus; hitscan dummies and one moving target. Static vendored runtime; Node server for local/LAN use; GitHub Pages delivery.

Verified on the VPS: four combat logic tests passed (`test-combat-armagedom-1-6fe37968c887`). Real Chromium mouse aiming/hits, three simultaneous fingers, release/cancel, two-thumb firing, weapon swap/reload, and landscape/portrait bounds passed with no runtime/console errors (`test-combat-armagedom-1-59649b92dcec`, exit 0). Job manifests pin source file SHA-256 values. Browser receipts/screenshots recovered into local ignored `artifacts/`. Landscape screenshot visually reviewed. Earlier browser attempts failed because of Snap cgroup restrictions and root-only/version-mismatched browser paths; the passing run used the installed shared browser.

Remaining acceptance: physical iPhone/Safari and player preference for stick size, placement, deadzone and firing mode. No phone performance claim. Next step: open the Pages link on a phone in landscape and compare separate fire against aim-and-fire while strafing around the moving dummy.

Delivery receipt: initial source commit `bd2126101c3b7a26932a9467b90e4c11a7bfc8a9` pushed to main; Pages run `37262846085` succeeded. Public URL: https://domlynch.github.io/Test-combat-Armagedom-1/ . All seven runtime files returned HTTP 200 and SHA-256 matched the tested local files. No runtime files changed during the later test/documentation refinement.

Final live-browser receipt: `test-combat-armagedom-1-5a1281c15a3f`, exit 0. The same Chromium checks passed against the public Pages URL, including spending a pistol round then verifying timed reload refills the magazine. Receipts recovered as `artifacts/live-result.json` and `artifacts/live-browser-result.json`.
