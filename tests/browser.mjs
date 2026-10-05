import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
await mkdir('artifacts', { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: '4187' }, stdio: 'pipe' });
await new Promise((resolve, reject) => { server.stdout.once('data', resolve); server.once('error', reject); });
let browser;
const results = [];
try {
  browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}), headless: true, args: ['--no-sandbox', '--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4187', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__combat);
  await page.waitForFunction(() => window.__combat.snapshot().started);
  assert.equal(await page.locator('#welcome').isVisible(), false, 'no startup popup');
  assert.equal(await page.locator('iframe').count(), 0, 'direct document, no iframe');
  const gameBounds = await page.locator('#game').boundingBox();
  assert.equal(gameBounds.width, 844); assert.equal(gameBounds.height, 390);
  results.push('Starts directly with viewport-filling canvas and no startup popup or iframe');
  const snapshot = () => page.evaluate(() => window.__combat.snapshot());
  const advance = async seconds => {
    const until = (await snapshot()).simTime + seconds;
    await page.waitForFunction(time => window.__combat.snapshot().simTime >= time, until, { timeout: 15000 });
  };
  let before = await snapshot();
  assert.equal(before.view, 'isometric-v2');
  const target = before.targets[0];
  await page.mouse.move(target.screenX, target.screenY);
  await page.keyboard.down('Space');
  await advance(0.08); assert.equal((await snapshot()).hitMarker, true); assert.equal(await page.locator('#hit-marker').evaluate(el => el.style.opacity), '1');
  await advance(0.44); await page.keyboard.up('Space');
  let after = await snapshot(); assert.ok(after.shots >= 3); assert.ok(after.hits >= 3); results.push('Mouse aim and held fire hit real targets');
  await page.locator('#swap').click(); await advance(0.25);
  assert.equal((await snapshot()).weapon, 'PISTOL');
  await page.keyboard.down('Space'); await advance(0.08); await page.keyboard.up('Space');
  assert.equal((await snapshot()).ammo, 11);
  await page.locator('#reload').click(); assert.ok((await snapshot()).reloading > 0);
  await advance(0.1); assert.equal(await page.locator('#fire-label').textContent(), 'RELOAD');
  assert.ok(Number(await page.locator('#reload-ring').evaluate(el => el.style.strokeDashoffset)) < 100);
  await advance(1.05);
  assert.equal((await snapshot()).reloading, 0); assert.equal((await snapshot()).ammo, 12); results.push('Weapon switching and actual magazine reload through UI');
  await page.locator('#reset').click();
  await page.locator('#assist').click(); assert.equal((await snapshot()).assistEnabled, false);
  const center = async id => { const b = await page.locator(id).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const move = await center('#move'), fire = await center('#fire-right');
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([id, x, y]) => ({ id, x, y, radiusX: 4, radiusY: 4, force: 1 })) });
  const closeOffset = (a, b) => { assert.ok(Math.abs(a.x - b.x) < 1e-5 && Math.abs(a.z - b.z) < 1e-5, 'reticle offset preserved: ' + JSON.stringify({ a, b })); };
  assert.equal(await page.locator('#aim, #fire-left, #mode, #focus').count(), 0, 'no second joystick or claw controls');
  before = await snapshot();
  assert.equal(before.controls, 'two-thumb-turn');
  await touch('touchStart', [[1, move.x, move.y], [2, 620, 170]]);
  await advance(0.08); closeOffset((await snapshot()).aimOffset, before.aimOffset);
  await touch('touchMove', [[1, move.x + 40, move.y], [2, 685, 195]]);
  await advance(0.5);
  after = await snapshot();
  assert.ok(after.x > before.x + 0.7 && after.z < before.z - 0.7);
  assert.ok(Math.abs(after.aimX - before.aimX) > 0.1, 'free swipe changes gun direction');
  assert.equal(after.shots, before.shots); assert.equal(after.fireCount, 0);
  assert.ok(after.cameraX > before.cameraX && after.cameraZ < before.cameraZ, 'camera follows movement');
  assert.ok(Math.abs(after.playerScreenX - 422) < 50, 'player stays close to screen center');
  assert.equal(after.cameraYaw, before.cameraYaw, 'look does not rotate the isometric camera');
  results.push('Two thumbs: left moves while free right swipe aims without firing or touch-down snapping');
  await touch('touchEnd', [[2, 685, 195]]);
  await advance(0.08); closeOffset((await snapshot()).aimOffset, after.aimOffset);
  before = await snapshot(); assert.ok(before.move.x > 0); assert.equal(before.looking, false);
  await touch('touchStart', [[1, move.x + 40, move.y], [2, fire.x, fire.y]]);
  await advance(0.08); closeOffset((await snapshot()).aimOffset, before.aimOffset);
  // Drag beyond the button boundary: pointer capture must keep aim and fire together.
  await touch('touchMove', [[1, move.x + 40, move.y], [2, fire.x - 110, fire.y - 80]]);
  await advance(0.4); after = await snapshot();
  assert.ok(after.x > before.x + 0.7); assert.ok(after.shots > before.shots); assert.equal(after.fireCount, 1);
  assert.ok(Math.abs(after.aimX - before.aimX) > 0.15);
  results.push('Exactly two fingers move, aim and fire together; fire drag works outside button');
  await touch('touchEnd', []); await advance(0.18);
  const released = await snapshot(); assert.equal(released.fireCount, 0); assert.equal(released.move.x, 0); assert.equal(released.looking, false);
  await advance(0.2); after = await snapshot(); assert.equal(after.shots, released.shots); assert.equal(after.x, released.x); closeOffset(after.aimOffset, released.aimOffset);
  results.push('Release stops movement and firing while retaining the last aim');

  await page.locator('#reset').click();
  const swipe = async (x, y, dx, dy) => {
    await touch('touchStart', [[2, x, y]]); await touch('touchMove', [[2, x + dx, y + dy]]); await advance(0.08); await touch('touchEnd', []); await advance(0.05);
  };
  const heading = s => Math.atan2(s.aimOffset.x, s.aimOffset.z);
  const angularDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const initialHeading = heading(await snapshot());
  for (let i = 1; i <= 4; i++) {
    await swipe(i % 2 ? 620 : 530, 170, 90, 0);
    assert.ok(angularDistance(heading(await snapshot()), initialHeading - i * Math.PI / 2) < 0.01);
  }
  for (let i = 1; i <= 4; i++) {
    await swipe(650, 170, -90, 0);
    assert.ok(angularDistance(heading(await snapshot()), initialHeading + i * Math.PI / 2) < 0.01);
  }
  assert.equal((await snapshot()).shots, 0);
  results.push('Actual touch swipes turn 90/180/270/full 360 in both directions with lift/replant');

  // Reload using CDP touch, including with left thumb still moving and repeated taps.
  const reloadButton = await center('#reload');
  await touch('touchStart', [[1, move.x + 20, move.y], [2, fire.x, fire.y]]); await advance(0.25);
  await touch('touchEnd', [[2, fire.x, fire.y]]); before = await snapshot(); assert.ok(before.ammo < 30);
  await touch('touchStart', [[1, move.x + 20, move.y], [2, reloadButton.x, reloadButton.y]]);
  after = await snapshot(); assert.ok(after.reloading > 0); assert.ok(after.move.x > 0); assert.equal(after.fireCount, 0);
  assert.equal(await page.locator('#fire-label').textContent(), 'RELOAD');
  await touch('touchEnd', [[2, reloadButton.x, reloadButton.y]]); await advance(0.15);
  for (let i = 0; i < 3; i++) {
    before = await snapshot();
    await touch('touchStart', [[1, move.x + 20, move.y], [2, reloadButton.x, reloadButton.y]]);
    await touch('touchEnd', [[2, reloadButton.x, reloadButton.y]]);
    after = await snapshot(); assert.ok(after.reloading <= before.reloading, 'repeated taps do not restart timer');
  }
  await advance(1.4); after = await snapshot(); assert.equal(after.ammo, 30); assert.equal(after.reloading, 0);
  await touch('touchStart', [[1, move.x + 20, move.y], [2, reloadButton.x, reloadButton.y]]);
  assert.equal(await page.locator('#feedback').textContent(), 'MAGAZINE FULL');
  await touch('touchEnd', []); results.push('Real touch reload works with moving thumb, repeated taps preserve progress, full-mag tap responds');

  await page.locator('#reset').click(); before = await snapshot();
  const mobileTarget = before.targets[0];
  const desired = Math.atan2(mobileTarget.x - before.x, mobileTarget.z - before.z);
  const delta = Math.atan2(Math.sin(heading(before) - desired), Math.cos(heading(before) - desired));
  await swipe(620, 170, delta * 180 / Math.PI, 0);
  const aimed = await snapshot();
  await touch('touchStart', [[2, fire.x, fire.y]]); await advance(0.4);
  after = await snapshot(); assert.ok(after.hits >= 3); closeOffset(after.aimOffset, aimed.aimOffset);
  await touch('touchCancel', []); await advance(0.12);
  const cancelled = await snapshot(); assert.equal(cancelled.fireCount, 0); assert.equal(cancelled.looking, false);
  await advance(0.2); assert.equal((await snapshot()).shots, cancelled.shots);
  results.push('Mobile swipe then held fire hits real targets; touch cancellation stops shooting');

  await touch('touchStart', [[1, move.x, move.y], [2, fire.x, fire.y]]);
  await touch('touchMove', [[1, move.x + 40, move.y], [2, fire.x + 20, fire.y]]);
  await page.setViewportSize({ width: 846, height: 392 }); await advance(0.12);
  after = await snapshot(); assert.equal(after.fireCount, 0); assert.equal(after.move.x, 0); assert.equal(after.looking, false);
  await touch('touchCancel', []);
  await page.setViewportSize({ width: 844, height: 390 }); await advance(0.05);
  results.push('Orientation/viewport change clears held controls');
  await page.locator('#reset').click();
  await swipe(620, 170, 0, -210); await swipe(620, 170, 0, -150);
  assert.equal((await snapshot()).aimEdge, true);
  const edge = await page.locator('#aim-edge').boundingBox();
  assert.ok(edge.x >= 0 && edge.y >= 0 && edge.x + edge.width <= 844 && edge.y + edge.height <= 390);
  await page.screenshot({ path: 'artifacts/edge-indicator.png' });
  results.push('Off-screen aim keeps a visible, bounded edge indicator');

  await page.locator('#reset').click();
  const nearHeading = heading(await snapshot());
  await swipe(620, 170, 0, 140); await swipe(620, 170, 0, 140);
  assert.ok(Math.abs(Math.hypot((await snapshot()).aimOffset.x, (await snapshot()).aimOffset.z) - 3) < 0.01);
  assert.ok(angularDistance(heading(await snapshot()), nearHeading) < 0.01);
  await swipe(620, 170, 14, 0);
  assert.ok(angularDistance(heading(await snapshot()), nearHeading) < 0.26, '14px near-player swipe remains small');
  await swipe(620, 170, 180, 0);
  assert.ok(angularDistance(heading(await snapshot()), nearHeading - 194 * Math.PI / 180) < 0.01);
  results.push('Minimum aim distance retains fine control and allows immediate 180-degree reversal');

  await page.locator('#reset').click(); await page.locator('#sensitivity').click();
  assert.equal((await snapshot()).sensitivity, 1.35); await swipe(620, 170, 40, 0); const high = (await snapshot()).aimOffset.x;
  await page.locator('#sensitivity').click(); await page.locator('#reset').click();
  assert.equal((await snapshot()).sensitivity, 0.65); await swipe(620, 170, 40, 0); const low = (await snapshot()).aimOffset.x;
  assert.ok(high > low * 1.5); await page.locator('#sensitivity').click();
  assert.equal((await snapshot()).sensitivity, 1); results.push('Sensitivity setting changes actual swipe response');

  const audioBefore = (await snapshot()).audio; assert.ok(audioBefore.ready && audioBefore.played > 0);
  await page.locator('#sound').click(); const mutedCount = (await snapshot()).audio.played;
  await page.keyboard.down('Space'); await advance(0.2); await page.keyboard.up('Space');
  assert.equal((await snapshot()).audio.played, mutedCount);
  await page.locator('#sound').click(); await page.keyboard.down('Space'); await advance(0.2); await page.keyboard.up('Space');
  assert.ok((await snapshot()).audio.played > mutedCount); results.push('Gesture-unlocked audio schedules actual cues and mute suppresses them');

  await page.locator('#reset').click(); await touch('touchStart', [[1, move.x, move.y]]);
  const deadline = (await snapshot()).simTime + 14;
  for (let i = 0; i < 140; i++) {
    const s = await snapshot(), dx = -s.x, dz = -7.4 - s.z, distance = Math.hypot(dx, dz);
    if (distance < 0.03 || s.simTime > deadline) break;
    const sx = dx * Math.cos(s.cameraYaw) - dz * Math.sin(s.cameraYaw), sy = (dx * Math.sin(s.cameraYaw) + dz * Math.cos(s.cameraYaw)) * s.verticalScale;
    const length = Math.hypot(sx, sy), radius = 118 * 0.37 * (0.13 + 0.87 * Math.min(0.45, distance / 4));
    await touch('touchMove', [[1, move.x + sx / length * radius, move.y + sy / length * radius]]); await advance(0.075);
  }
  await touch('touchEnd', []); await advance(0.08); before = await snapshot();
  const range = Math.hypot(before.x, before.z + 8); assert.ok(range > 0.5 && range < 0.7, 'controlled point-blank position: ' + range);
  await page.locator('#assist').click(); assert.equal((await snapshot()).assistEnabled, true);
  await swipe(620, 170, -4, 0); before = await snapshot();
  assert.ok(before.assistCorrection < 0 && Math.abs(before.assistCorrection) < 0.027, 'light near-target nudge is bounded');
  await page.locator('#assist').click(); await advance(0.08); assert.equal((await snapshot()).assistCorrection, 0);
  await swipe(620, 170, 4, 0);
  results.push('Close-range assist adds a small visible correction and OFF removes it immediately');
  await touch('touchStart', [[2, fire.x, fire.y]]); await advance(0.4); await touch('touchEnd', []); after = await snapshot();
  assert.ok(after.hits >= 3 && after.targets[0].hp <= 25, 'actual close-range shots damage the dummy');
  await page.screenshot({ path: 'artifacts/point-blank-fixed.png' });
  results.push('Original ~0.62-unit point-blank reproduction now hits and damages target');
  await page.screenshot({ path: 'artifacts/landscape.png' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
  const portraitCanvas = await page.locator('#game').boundingBox();
  assert.equal(portraitCanvas.width, 390); assert.equal(portraitCanvas.height, 844);
  for (const id of ['#move', '#fire-right', '#reload', '#swap', '#sound', '#sensitivity', '#assist']) { const b = await page.locator(id).boundingBox(); assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= 391 && b.y + b.height <= 845, id + ' within portrait viewport'); }
  await page.screenshot({ path: 'artifacts/portrait.png' });
  assert.deepEqual(errors, []); results.push('Landscape/portrait UI fits; no runtime or console errors');
  await writeFile('artifacts/browser-result.json', JSON.stringify({ pass: true, results, snapshot: await snapshot() }, null, 2));
  console.log(JSON.stringify({ pass: true, results }, null, 2));
} finally { if (browser) await browser.close(); server.kill(); }
