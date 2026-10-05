# Combat prototype state

2026-10-05. Canonical checkout: `/Users/domininclynch/Desktop/Business/Test-combat-Armagedom-1`. Repository: `DomLynch/Test-combat-Armagedom-1`. Scope: an isolated mobile-web control experiment; no main ARMAGEDOM source, Claude materials, or live game services modified.

Implemented: flat 2.5D Three.js range; independent analog movement/aim; two dedicated fire buttons; optional two-thumb aim-and-fire; rifle/pistol cadence, magazines, reload, recoil feedback and precision focus; hitscan dummies and one moving target. Static vendored runtime; Node server for local/LAN use; GitHub Pages delivery.

Verified on the VPS: four combat logic tests passed (`test-combat-armagedom-1-6fe37968c887`). Real Chromium mouse aiming/hits, three simultaneous fingers, release/cancel, two-thumb firing, weapon swap/reload, and landscape/portrait bounds passed with no runtime/console errors (`test-combat-armagedom-1-59649b92dcec`, exit 0). Job manifests pin source file SHA-256 values. Browser receipts/screenshots recovered into local ignored `artifacts/`. Landscape screenshot visually reviewed. Earlier browser attempts failed because of Snap cgroup restrictions and root-only/version-mismatched browser paths; the passing run used the installed shared browser.

Remaining acceptance: physical iPhone/Safari and player preference for stick size, placement, deadzone and firing mode. No phone performance claim. Next step: open the Pages link on a phone in landscape and compare separate fire against aim-and-fire while strafing around the moving dummy.

Delivery receipt: initial source commit `bd2126101c3b7a26932a9467b90e4c11a7bfc8a9` pushed to main; Pages run `37262846085` succeeded. Public URL: https://domlynch.github.io/Test-combat-Armagedom-1/ . All seven runtime files returned HTTP 200 and SHA-256 matched the tested local files. No runtime files changed during the later test/documentation refinement.

Final live-browser receipt: `test-combat-armagedom-1-5a1281c15a3f`, exit 0. The same Chromium checks passed against the public Pages URL, including spending a pistol round then verifying timed reload refills the magazine. Receipts recovered as `artifacts/live-result.json` and `artifacts/live-browser-result.json`.
