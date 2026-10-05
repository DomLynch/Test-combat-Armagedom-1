import * as THREE from 'three';
import { WeaponState, worldVector, followAngle, aimAssist, StickyAim, targetOnRay, rayCircle } from './combat.js?v=combat-14';
import { createCombatAudio } from './audio.js?v=combat-14';
import { installTouchGuards } from './touch.js?v=combat-14';
import { createInput, bindAction } from './input.js?v=combat-14';

const $ = id => document.getElementById(id);
const canvas = $('game');
installTouchGuards();
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' }); }
catch { $('welcome').classList.remove('hidden'); $('welcome').innerHTML = '<div class="welcome-card"><h1>WebGL unavailable</h1><p>Open this link in Safari or Chrome with hardware acceleration enabled.</p></div>'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#17222b');
const camera = new THREE.OrthographicCamera(-20, 20, 14, -14, 0.1, 80);
const cameraYaw = Math.PI / 4;
const cameraOffset = new THREE.Vector3(18, 22, 18);
const cameraFocus = new THREE.Vector3(0, 0, 3);
const verticalScale = cameraOffset.y / cameraOffset.length();
function updateCamera(dt, immediate = false) {
  const alpha = immediate ? 1 : 1 - Math.exp(-dt * 7);
  cameraFocus.x += (player.position.x - cameraFocus.x) * alpha;
  cameraFocus.z += (player.position.z - cameraFocus.z) * alpha;
  camera.position.copy(cameraFocus).add(cameraOffset);
  camera.lookAt(cameraFocus); camera.updateMatrixWorld(true);
}
scene.add(new THREE.HemisphereLight('#d5e8ff', '#776e59', 2));
const sun = new THREE.DirectionalLight('#ffe0b4', 2.4); sun.position.set(-10, 22, 8); sun.castShadow = true;
sun.shadow.mapSize.set(512, 512); sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22; sun.shadow.camera.far = 65; sun.shadow.normalBias = 0.04;
scene.add(sun);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const materials = {};
function material(color) { return materials[color] ||= new THREE.MeshLambertMaterial({ color }); }
function box(parent, color, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(unitBox, material(color)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; parent.add(mesh); return mesh;
}
const floor = box(scene, '#657078', 0, -0.4, 0, 28, 0.8, 28); floor.receiveShadow = true; floor.castShadow = false;
const grid = new THREE.GridHelper(28, 14, '#85939a', '#73818a'); grid.position.y = 0.015; scene.add(grid);
for (const x of [-14, 14]) { box(scene, '#3f4d59', x, 0.3, 0, 0.3, 0.6, 28); box(scene, '#d5ac58', x, 0.62, 0, 0.32, 0.04, 28); }
for (const z of [-14, 14]) { box(scene, '#3f4d59', 0, 0.3, z, 28, 0.6, 0.3); box(scene, '#d5ac58', 0, 0.62, z, 28, 0.04, 0.32); }
for (const x of [-13.7, 13.7]) for (const z of [-13.7, 13.7]) box(scene, '#364756', x, 1, z, 0.65, 2, 0.65);
const player = new THREE.Group(); scene.add(player);
const legs = new THREE.Group(); player.add(legs);
function makeLeg(x) {
  const pivot = new THREE.Group(); pivot.position.set(x, 0.8, 0); legs.add(pivot);
  box(pivot, '#394c5f', 0, -0.24, 0, 0.24, 0.48, 0.27);
  box(pivot, '#304052', 0, -0.58, 0.01, 0.22, 0.3, 0.25);
  box(pivot, '#192832', 0, -0.72, -0.08, 0.28, 0.16, 0.42);
  return pivot;
}
const leftLeg = makeLeg(-0.19), rightLeg = makeLeg(0.19);
box(legs, '#394c5f', 0, 0.77, 0, 0.58, 0.23, 0.38);
const torso = new THREE.Group(); player.add(torso);
box(torso, '#6faaa1', 0, 1.15, 0, 0.67, 0.63, 0.43);
box(torso, '#304a52', 0, 1.13, -0.25, 0.53, 0.43, 0.13);
box(torso, '#49616c', 0, 1.16, 0.29, 0.43, 0.46, 0.2);
box(torso, '#e4b99b', 0, 1.49, 0, 0.18, 0.18, 0.2);
const head = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 8), material('#e4b99b')); head.position.set(0, 1.72, -0.01); head.castShadow = true; torso.add(head);
box(torso, '#253c46', 0, 1.89, 0.015, 0.43, 0.16, 0.4);
box(torso, '#6faaa1', -0.34, 1.27, -0.15, 0.19, 0.24, 0.36).rotation.y = -0.5;
box(torso, '#6faaa1', 0.38, 1.24, -0.19, 0.2, 0.23, 0.42);
box(torso, '#e4b99b', -0.1, 1.22, -0.43, 0.37, 0.14, 0.17);
box(torso, '#e4b99b', 0.28, 1.22, -0.49, 0.15, 0.14, 0.19);
const gun = new THREE.Group(); torso.add(gun);
const barrel = box(gun, '#202b33', 0.25, 1.25, -0.76, 0.17, 0.16, 0.95);
box(gun, '#51616c', 0.25, 1.25, -0.46, 0.23, 0.2, 0.35);
box(gun, '#202b33', 0.25, 1.08, -0.46, 0.13, 0.23, 0.16);
const flash = box(gun, '#fff1b5', 0.25, 1.25, -1.32, 0.25, 0.22, 0.27); flash.material = new THREE.MeshBasicMaterial({ color: '#fff1b5' }); flash.castShadow = false; flash.visible = false;
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.52, 16), new THREE.MeshBasicMaterial({ color: '#26343c', transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; player.add(shadow);
const reticle = new THREE.Group(); scene.add(reticle);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 20), new THREE.MeshBasicMaterial({ color: '#a9f9d0', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; reticle.add(ring);
box(reticle, '#a9f9d0', 0, 0.03, 0, 0.025, 0.025, 0.65).castShadow = false;
box(reticle, '#a9f9d0', 0, 0.03, 0, 0.65, 0.025, 0.025).castShadow = false;
const sightGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const sight = new THREE.Line(sightGeometry, new THREE.LineBasicMaterial({ color: '#597e72', transparent: true, opacity: 0.7 })); scene.add(sight);
const targetPositions = [[0, -8], [-7, -6], [7, -6], [-9, 2], [9, 2], [-5, 8], [5, 8]];
const targets = targetPositions.map(([x, z], i) => {
  const group = new THREE.Group(); scene.add(group); group.position.set(x, 0, z);
  const bodyMaterial = new THREE.MeshLambertMaterial({ color: '#d98e7d' });
  box(group, '#354654', 0, 0.08, 0, 1.1, 0.16, 1.1);
  box(group, '#596b76', 0, 0.43, 0, 0.2, 0.6, 0.2);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.42, 0.95, 12), bodyMaterial); body.position.y = 1.12; body.castShadow = true; group.add(body);
  box(group, '#ffe2cf', 0, 1.72, 0, 0.4, 0.35, 0.4);
  const health = box(group, '#a9f9d0', 0, 2.12, 0, 1, 0.065, 0.07); health.rotation.y = cameraYaw; health.castShadow = false;
  return { group, bodyMaterial, health, x, z, baseX: x, baseZ: z, hp: 100, down: 0, flash: 0, moving: i === 6 };
});
const tracers = Array.from({ length: 16 }, () => {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffe3a2' })); line.visible = false; scene.add(line);
  return { line, remaining: 0 };
});
let tracerIndex = 0, started = true, angle = 0, aimX = 0, aimZ = -1, kick = 0, flashTime = 0, shots = 0, hits = 0, kills = 0, elapsed = 0, previousTime = 0, hudTime = 0, feedbackTime = 0;
const aimOffset = new THREE.Vector2(0, -5);
const audio = createCombatAudio();
let targetIndex = -1, lastHitX = 0, lastHitZ = 0;
const stickyAim = new StickyAim();
let assistEnabled = true, assistCorrection = 0, previousMoveAngle = null, steeringAngle = null, movementFacing = false;
let soundEnabled = true, hitMarkerTime = 0;
const weapons = new WeaponState();
function reload() {
  if (!started) return;
  const result = weapons.reload();
  showFeedback(result === 'full' ? 'MAGAZINE FULL' : result === 'busy' ? 'RELOADING…' : 'RELOAD STARTED');
  updateHud();
}
function swap() { if (!started) return; weapons.swap(); barrel.scale.z = weapons.index ? 0.5 : 0.95; barrel.position.z = weapons.index ? -0.6 : -0.76; }
const input = createInput(canvas, reload, swap);
bindAction($('reload'), reload); bindAction($('swap'), swap);
$('assist').onclick = () => { assistEnabled = !assistEnabled; stickyAim.reset(); $('assist').textContent = assistEnabled ? 'Assist: Light' : 'Assist: OFF'; $('assist').setAttribute('aria-pressed', String(assistEnabled)); };
$('sound').onclick = () => { soundEnabled = !soundEnabled; audio.setEnabled(soundEnabled); $('sound').textContent = `Sound: ${soundEnabled ? 'ON' : 'OFF'}`; $('sound').setAttribute('aria-pressed', String(soundEnabled)); };
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { showFeedback('Full screen unavailable in this browser'); } };
$('reset').onclick = () => {
  input.clear(); stickyAim.reset(); weapons.reset(); player.position.set(0, 0, 3); shots = hits = kills = elapsed = 0; aimX = 0; aimZ = -1; aimOffset.set(0, -5); angle = 0; targetIndex = -1; previousMoveAngle = steeringAngle = null; movementFacing = false; player.rotation.y = 0; kick = flashTime = hitMarkerTime = 0;
  barrel.scale.z = 0.95; barrel.position.z = -0.76; for (const t of targets) { t.hp = 100; t.down = t.flash = 0; t.group.visible = true; }
  for (const t of tracers) { t.remaining = 0; t.line.visible = false; } updateCamera(0, true); showFeedback('Range reset');
};
player.position.z = 3;
function showFeedback(message) { $('feedback').textContent = message; feedbackTime = 0.7; }
function resize() {
  const width = innerWidth, height = innerHeight, aspect = width / height;
  const halfHeight = aspect > 1 ? 8 : 11;
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
  renderer.setSize(width, height, false); updateCamera(0, true);
}
window.addEventListener('resize', resize); resize();
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster(), aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.25), mouseWorld = new THREE.Vector3();
const muzzle = new THREE.Vector3(), reticleScreen = new THREE.Vector3(), markerScreen = new THREE.Vector3();
function setLine(line, x1, y1, z1, x2, y2, z2) {
  const p = line.geometry.attributes.position; p.setXYZ(0, x1, y1, z1); p.setXYZ(1, x2, y2, z2); p.needsUpdate = true; line.geometry.computeBoundingSphere();
}
function shoot(moving) {
  if (!weapons.fire()) return;
  shots++; audio.shot(weapons.index === 1); kick = weapons.weapon.kick; flashTime = 0.045;
  const spread = weapons.weapon.spread * (input.focus ? 0.25 : 1) * (moving ? 2 : 1);
  const direction = Math.atan2(aimX, aimZ) + (Math.random() - 0.5) * spread * 2;
  const dx = Math.sin(direction), dz = Math.cos(direction);
  muzzle.set(0.25, 1.25, weapons.index ? -0.95 : -1.25); torso.localToWorld(muzzle);
  let distance = 32, hitTarget = null;
  for (const target of targets) {
    if (target.hp <= 0) continue;
    const d = rayCircle(player.position.x, player.position.z, dx, dz, target.x, target.z, 0.58);
    if (d < distance) { distance = d; hitTarget = target; }
  }
  // Keep the shot inside the arena, including targets beyond the wall.
  const wallX = dx ? ((dx > 0 ? 14 : -14) - player.position.x) / dx : Infinity;
  const wallZ = dz ? ((dz > 0 ? 14 : -14) - player.position.z) / dz : Infinity;
  const wall = Math.min(wallX, wallZ);
  if (wall < distance) { distance = wall; hitTarget = null; }
  if (hitTarget) {
    hits++; hitTarget.hp = Math.max(0, hitTarget.hp - weapons.weapon.damage); hitTarget.flash = 0.1;
    if (!hitTarget.hp) { kills++; hitTarget.down = 2; showFeedback('TARGET DOWN'); }
    lastHitX = hitTarget.x; lastHitZ = hitTarget.z;
    hitMarkerTime = 0.2; $('hit-marker').classList.toggle('kill', !hitTarget.hp); audio.hit(!hitTarget.hp);
    if (navigator.vibrate) navigator.vibrate(8);
  }
  const tracer = tracers[tracerIndex++ % tracers.length]; tracer.remaining = 0.065; tracer.line.visible = true;
  // Close impacts lie before the barrel; keep their tracer on the hit segment.
  const beforeMuzzle = distance < (muzzle.x - player.position.x) * dx + (muzzle.z - player.position.z) * dz;
  setLine(tracer.line, beforeMuzzle ? player.position.x : muzzle.x, 1.25, beforeMuzzle ? player.position.z : muzzle.z, player.position.x + dx * distance, 1.25, player.position.z + dz * distance);
}
function updateHud() {
  $('status').textContent = weapons.reloadRemaining ? `${weapons.weapon.name} · RELOADING ${weapons.reloadRemaining.toFixed(1)}s` : `${weapons.weapon.name} · ${weapons.ammo[weapons.index]} / ${weapons.weapon.capacity}`;
  $('swap').textContent = weapons.index ? 'RIFLE' : 'PISTOL';
  const reloading = weapons.reloadRemaining > 0;
  $('fire-right').classList.toggle('reloading', reloading);
  $('fire-label').textContent = reloading ? 'RELOAD' : 'FIRE';
  $('fire-hint').textContent = reloading ? weapons.reloadRemaining.toFixed(1) + 's' : 'HOLD TO FIRE';
  $('reload-ring').style.strokeDashoffset = String(reloading ? 100 * weapons.reloadRemaining / weapons.weapon.reload : 100);
  $('reload').textContent = reloading ? 'RELOADING…' : 'RELOAD';
  $('reload').classList.toggle('held', reloading);
  $('stats').textContent = `Hits ${hits} · Shots ${shots} · Accuracy ${shots ? Math.round(hits / shots * 100) + '%' : '—'} · Down ${kills}`;
}
renderer.setAnimationLoop(time => {
  const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0; previousTime = time;
  if (started && !document.hidden) {
    const wasReloading = weapons.reloadRemaining > 0;
    elapsed += dt; weapons.tick(dt);
    if (wasReloading && !weapons.reloadRemaining) { showFeedback('RELOADED'); updateHud(); }
    // Update opponent positions before aiming so marker and model share this frame.
    for (const target of targets) {
      if (target.down > 0) { target.down -= dt; target.group.visible = false; if (target.down <= 0) { target.hp = 100; target.group.visible = true; } }
      if (target.moving) target.x = target.baseX + Math.sin(elapsed * 0.9) * 2;
      target.group.position.x = target.x;
    }
    const keys = input.keys;
    let mx = input.move.x, my = input.move.y;
    if (keys.size) { mx += Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')); my += Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')); }
    const move = worldVector(mx, my, verticalScale, cameraYaw), moving = Math.hypot(move.x, move.z) > 0.01;
    // Gentle thumb response: steer both travel and targeting through one filter.
    // Releasing the stick still stops travel immediately, without inertia.
    if (input.moveHeld && moving && !input.pointerAim) {
      const desired = Math.atan2(move.x, move.z), strength = Math.hypot(move.x, move.z);
      steeringAngle = steeringAngle === null ? desired : followAngle(steeringAngle, desired, dt, 10);
      move.x = Math.sin(steeringAngle) * strength; move.z = Math.cos(steeringAngle) * strength;
    } else if (!input.moveHeld) steeringAngle = null;
    const speed = input.focus ? 3 : input.moveHeld ? 4.5 : 6;
    player.position.x = THREE.MathUtils.clamp(player.position.x + move.x * dt * speed, -13.1, 13.1);
    player.position.z = THREE.MathUtils.clamp(player.position.z + move.z * dt * speed, -13.1, 13.1);
    if (moving) { leftLeg.rotation.x = Math.sin(elapsed * 14) * 0.36; rightLeg.rotation.x = -leftLeg.rotation.x; } else leftLeg.rotation.x = rightLeg.rotation.x = 0;
    updateCamera(dt);
    // The left stick owns mobile movement and targeting. FIRE never affects heading.
    const stickyActive = assistEnabled && input.touchAim && input.moveHeld && !input.pointerAim;
    let rawAngle = stickyAim.track(Math.atan2(aimOffset.x, aimOffset.y), player.position.x, player.position.z, targets, stickyActive);
    if (input.pointerAim) {
      pointer.set(input.pointerAim.x / innerWidth * 2 - 1, 1 - input.pointerAim.y / innerHeight * 2); raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(aimPlane, mouseWorld)) rawAngle = Math.atan2(mouseWorld.x - player.position.x, mouseWorld.z - player.position.z);
    } else if (moving) {
      const moveAngle = Math.atan2(move.x, move.z);
      // Retention compensates travel; changes of left-stick direction remain manual.
      rawAngle = stickyAim.target >= 0 && previousMoveAngle !== null
        ? rawAngle + Math.atan2(Math.sin(moveAngle - previousMoveAngle), Math.cos(moveAngle - previousMoveAngle))
        : moveAngle;
      previousMoveAngle = input.moveHeld ? moveAngle : null;
    }
    if (!input.moveHeld) previousMoveAngle = null;
    const aimLength = Math.max(3, aimOffset.length());
    aimOffset.set(Math.sin(rawAngle) * aimLength, Math.cos(rawAngle) * aimLength);
    const retainedCorrection = stickyAim.update(rawAngle, player.position.x, player.position.z, targets, stickyActive, moving);
    movementFacing = moving && !input.pointerAim && stickyAim.target < 0;
    assistCorrection = assistEnabled && input.touchAim && !input.pointerAim
      ? (stickyActive ? retainedCorrection : aimAssist(rawAngle, player.position.x, player.position.z, targets)) : 0;
    if (aimLength > 0.15) {
      const desiredYaw = Math.atan2(-Math.sin(rawAngle + assistCorrection), -Math.cos(rawAngle + assistCorrection));
      angle = followAngle(angle, desiredYaw, dt);
      aimX = -Math.sin(angle); aimZ = -Math.cos(angle);
    }
    // One root yaw keeps feet, hips, torso and gun together, including while strafing.
    player.rotation.y = angle;
    kick *= Math.exp(-dt * 22); gun.position.z = kick;
    player.updateMatrixWorld(true);
    if (input.fires.size || input.firePressed) shoot(moving);
    input.firePressed = false;
    flashTime = Math.max(0, flashTime - dt); flash.visible = flashTime > 0;
    const wallX = aimX ? ((aimX > 0 ? 14 : -14) - player.position.x) / aimX : Infinity;
    const wallZ = aimZ ? ((aimZ > 0 ? 14 : -14) - player.position.z) / aimZ : Infinity;
    targetIndex = targetOnRay(player.position.x, player.position.z, aimX, aimZ, targets, Math.min(32, wallX, wallZ));
    const target = targetIndex >= 0 ? targets[targetIndex] : null;
    reticle.position.set(target ? target.x : player.position.x + aimX * aimLength, 1.25, target ? target.z : player.position.z + aimZ * aimLength);
    reticle.scale.setScalar(target ? 2.8 : 1);
    reticleScreen.copy(reticle.position).project(camera);
    const rx = (reticleScreen.x + 1) * innerWidth / 2, ry = (1 - reticleScreen.y) * innerHeight / 2;
    const edge = rx < 26 || ry < 26 || rx > innerWidth - 26 || ry > innerHeight - 26;
    const ex = THREE.MathUtils.clamp(rx, 26, innerWidth - 26), ey = THREE.MathUtils.clamp(ry, 26, innerHeight - 26);
    $('aim-edge').classList.toggle('hidden', !edge);
    $('aim-edge').style.transform = `translate(${ex}px, ${ey}px) translate(-50%, -50%) rotate(${Math.atan2(ry - innerHeight / 2, rx - innerWidth / 2)}rad)`;
    markerScreen.set(reticle.position.x, 2.65, reticle.position.z).project(camera);
    $('target-marker').classList.toggle('hidden', !target || edge);
    $('target-marker').style.transform = `translate(${(markerScreen.x + 1) * innerWidth / 2}px, ${(1 - markerScreen.y) * innerHeight / 2}px) translate(-50%, -50%)`;
    hitMarkerTime = Math.max(0, hitMarkerTime - dt);
    $('hit-marker').style.opacity = hitMarkerTime > 0 ? '1' : '0';
    markerScreen.set(lastHitX, 1.25, lastHitZ).project(camera);
    $('hit-marker').style.transform = `translate(${THREE.MathUtils.clamp((markerScreen.x + 1) * innerWidth / 2, 26, innerWidth - 26)}px, ${THREE.MathUtils.clamp((1 - markerScreen.y) * innerHeight / 2, 26, innerHeight - 26)}px) translate(-50%, -50%)`;
    setLine(sight, player.position.x, 1.25, player.position.z, reticle.position.x, 1.25, reticle.position.z);
    for (const target of targets) {
      target.flash = Math.max(0, target.flash - dt);
      target.bodyMaterial.color.set(target.flash ? '#fff3dd' : '#d98e7d'); target.health.scale.x = target.hp / 100;
    }
    for (const tracer of tracers) { tracer.remaining = Math.max(0, tracer.remaining - dt); tracer.line.visible = tracer.remaining > 0; }
    feedbackTime = Math.max(0, feedbackTime - dt); if (!feedbackTime) $('feedback').textContent = '';
    hudTime += dt; if (hudTime > 0.08) { updateHud(); hudTime = 0; }
  }
  renderer.render(scene, camera);
});
updateHud();
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); input.clear(); started = false; showFeedback('Graphics paused. Reload this page to resume.'); });
// Read-only diagnostics used by real browser checks; no test input bypass.
window.__combat = {
  snapshot() {
    const worldYaw = group => { const direction = group.getWorldDirection(new THREE.Vector3()); return Math.atan2(direction.x, direction.z); };
    const playerScreen = new THREE.Vector3(player.position.x, 1, player.position.z).project(camera);
    return { started, simTime: elapsed, x: player.position.x, z: player.position.z, aimX, aimZ, bodyYaw: worldYaw(player), legsYaw: worldYaw(legs), torsoYaw: worldYaw(torso), shots, hits, weapon: weapons.weapon.name, ammo: weapons.ammo[weapons.index], reloading: weapons.reloadRemaining, move: { ...input.move }, aimOffset: { x: aimOffset.x, z: aimOffset.y }, moveHeld: input.moveHeld, controls: 'left-move-aim-fire-button', movementFacing, selectedTarget: targetIndex < 0 ? null : targetIndex, reticle: { x: reticle.position.x, z: reticle.position.z }, targetMarker: !$('target-marker').classList.contains('hidden'), assistEnabled, assistCorrection, assistTarget: stickyAim.target < 0 ? null : stickyAim.target, audio: audio.snapshot(), hitMarker: hitMarkerTime > 0, aimEdge: !$('aim-edge').classList.contains('hidden'), fireCount: input.fires.size, drawCalls: renderer.info.render.calls, view: 'isometric-v2', cameraYaw, verticalScale, cameraX: camera.position.x, cameraZ: camera.position.z, playerScreenX: (playerScreen.x + 1) / 2 * innerWidth, playerScreenY: (1 - playerScreen.y) / 2 * innerHeight,
      targets: targets.map(t => { const v = new THREE.Vector3(t.x, 1.25, t.z).project(camera); return { x: t.x, z: t.z, hp: t.hp, screenX: (v.x + 1) / 2 * innerWidth, screenY: (1 - v.y) / 2 * innerHeight }; }) };
  }
};
window.addEventListener('pagehide', () => { input.clear(); renderer.setAnimationLoop(null); });
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
