import * as THREE from 'three';
import { WeaponState, worldVector, rayCircle } from './combat.js';
import { createInput } from './input.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' }); }
catch { $('welcome').innerHTML = '<div class="welcome-card"><h1>WebGL unavailable</h1><p>Open this link in Safari or Chrome with hardware acceleration enabled.</p></div>'; throw new Error('WebGL unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const scene = new THREE.Scene(); scene.background = new THREE.Color('#13191e');
const camera = new THREE.OrthographicCamera(-20, 20, 14, -14, 0.1, 80);
camera.position.set(0, 24, 17); camera.lookAt(0, 0, 0);
const verticalScale = 24 / Math.hypot(24, 17);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const materials = {};
function material(color) { return materials[color] ||= new THREE.MeshBasicMaterial({ color }); }
function box(parent, color, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(unitBox, material(color)); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
}
box(scene, '#202a30', 0, -0.1, 0, 28, 0.2, 28);
const grid = new THREE.GridHelper(28, 28, '#44535a', '#2d3a41'); grid.position.y = 0.015; scene.add(grid);
for (const x of [-14, 14]) box(scene, '#71818a', x, 0.25, 0, 0.16, 0.5, 28);
for (const z of [-14, 14]) box(scene, '#71818a', 0, 0.25, z, 28, 0.5, 0.16);
const player = new THREE.Group(); scene.add(player);
const legs = new THREE.Group(); player.add(legs);
const leftLeg = box(legs, '#6c9595', -0.2, 0.18, 0, 0.24, 0.3, 0.44);
const rightLeg = box(legs, '#6c9595', 0.2, 0.18, 0, 0.24, 0.3, 0.44);
const torso = new THREE.Group(); player.add(torso);
box(torso, '#a9f9d0', 0, 0.65, 0, 0.75, 0.65, 0.45);
box(torso, '#dfe9e6', 0, 1.15, -0.03, 0.42, 0.42, 0.42);
box(torso, '#477362', 0, 1.15, -0.26, 0.29, 0.1, 0.035);
box(torso, '#a9f9d0', -0.28, 0.7, -0.34, 0.17, 0.18, 0.56);
box(torso, '#a9f9d0', 0.36, 0.7, -0.31, 0.17, 0.18, 0.56);
const gun = new THREE.Group(); torso.add(gun);
const barrel = box(gun, '#e4bd87', 0.25, 0.75, -0.76, 0.17, 0.16, 0.95);
box(gun, '#343e45', 0.25, 0.69, -0.43, 0.25, 0.28, 0.3);
const flash = box(gun, '#fff1b5', 0.25, 0.75, -1.32, 0.25, 0.22, 0.27); flash.visible = false;
const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.65, 16), material('#0f181d')); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; player.add(shadow);
const reticle = new THREE.Group(); scene.add(reticle);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.24, 20), new THREE.MeshBasicMaterial({ color: '#a9f9d0', side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; reticle.add(ring);
box(reticle, '#a9f9d0', 0, 0.03, 0, 0.025, 0.025, 0.65);
box(reticle, '#a9f9d0', 0, 0.03, 0, 0.65, 0.025, 0.025);
const sightGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
const sight = new THREE.Line(sightGeometry, new THREE.LineBasicMaterial({ color: '#597e72', transparent: true, opacity: 0.7 })); scene.add(sight);
const targetPositions = [[0, -8], [-7, -6], [7, -6], [-9, 2], [9, 2], [-5, 8], [5, 8]];
const targets = targetPositions.map(([x, z], i) => {
  const group = new THREE.Group(); scene.add(group); group.position.set(x, 0, z);
  const bodyMaterial = new THREE.MeshBasicMaterial({ color: '#d98e7d' });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 12), bodyMaterial); body.position.y = 0.65; group.add(body);
  box(group, '#ffe2cf', 0, 1.3, 0, 0.32, 0.25, 0.32);
  const health = box(group, '#a9f9d0', 0, 1.7, 0, 1, 0.065, 0.07);
  return { group, bodyMaterial, health, x, z, baseX: x, baseZ: z, hp: 100, down: 0, flash: 0, moving: i === 6 };
});
const tracers = Array.from({ length: 16 }, () => {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffe3a2' })); line.visible = false; scene.add(line);
  return { line, remaining: 0 };
});
let tracerIndex = 0, started = false, angle = 0, aimX = 0, aimZ = -1, kick = 0, flashTime = 0, shots = 0, hits = 0, kills = 0, elapsed = 0, previousTime = 0, hudTime = 0, feedbackTime = 0;
const weapons = new WeaponState();
function reload() { if (started) weapons.reload(); }
function swap() { if (!started) return; weapons.swap(); barrel.scale.z = weapons.index ? 0.5 : 0.95; barrel.position.z = weapons.index ? -0.6 : -0.76; }
const input = createInput(canvas, reload, swap);
$('reload').onclick = reload; $('swap').onclick = swap;
$('mode').onclick = () => { input.aimFire = !input.aimFire; $('mode').textContent = `Aim + fire: ${input.aimFire ? 'ON' : 'OFF'}`; $('mode').setAttribute('aria-pressed', String(input.aimFire)); };
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { showFeedback('Use landscape for more room'); } };
$('start').onclick = () => { started = true; $('welcome').classList.add('hidden'); input.clear(); };
$('reset').onclick = () => {
  input.clear(); weapons.reset(); player.position.set(0, 0, 3); shots = hits = kills = elapsed = 0; aimX = 0; aimZ = -1; angle = 0; kick = flashTime = 0;
  barrel.scale.z = 0.95; barrel.position.z = -0.76; for (const t of targets) { t.hp = 100; t.down = t.flash = 0; t.group.visible = true; }
  for (const t of tracers) { t.remaining = 0; t.line.visible = false; } showFeedback('Range reset');
};
player.position.z = 3;
function showFeedback(message) { $('feedback').textContent = message; feedbackTime = 0.7; }
function resize() {
  const width = innerWidth, height = innerHeight, aspect = width / height;
  const halfHeight = Math.max(13.5, 15.3 / aspect);
  camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect; camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
window.addEventListener('resize', resize); resize();
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), mouseWorld = new THREE.Vector3();
const muzzle = new THREE.Vector3();
function setLine(line, x1, y1, z1, x2, y2, z2) {
  const p = line.geometry.attributes.position; p.setXYZ(0, x1, y1, z1); p.setXYZ(1, x2, y2, z2); p.needsUpdate = true; line.geometry.computeBoundingSphere();
}
function shoot(moving) {
  if (!weapons.fire()) return;
  shots++; kick = weapons.weapon.kick; flashTime = 0.045;
  const spread = weapons.weapon.spread * (input.focus ? 0.25 : 1) * (moving ? 2 : 1);
  const direction = Math.atan2(aimX, aimZ) + (Math.random() - 0.5) * spread * 2;
  const dx = Math.sin(direction), dz = Math.cos(direction);
  muzzle.set(0.25, 0.75, weapons.index ? -0.95 : -1.25); torso.localToWorld(muzzle);
  let distance = 32, hitTarget = null;
  for (const target of targets) {
    if (target.hp <= 0) continue;
    const d = rayCircle(muzzle.x, muzzle.z, dx, dz, target.x, target.z, 0.58);
    if (d < distance) { distance = d; hitTarget = target; }
  }
  // Keep the shot inside the arena, including targets beyond the wall.
  const wallX = dx ? ((dx > 0 ? 14 : -14) - muzzle.x) / dx : Infinity;
  const wallZ = dz ? ((dz > 0 ? 14 : -14) - muzzle.z) / dz : Infinity;
  const wall = Math.min(wallX, wallZ);
  if (wall < distance) { distance = wall; hitTarget = null; }
  if (hitTarget) {
    hits++; hitTarget.hp = Math.max(0, hitTarget.hp - weapons.weapon.damage); hitTarget.flash = 0.1;
    if (!hitTarget.hp) { kills++; hitTarget.down = 2; showFeedback('TARGET DOWN'); } else showFeedback('HIT');
    if (navigator.vibrate) navigator.vibrate(8);
  }
  const tracer = tracers[tracerIndex++ % tracers.length]; tracer.remaining = 0.065; tracer.line.visible = true;
  setLine(tracer.line, muzzle.x, 0.75, muzzle.z, muzzle.x + dx * distance, 0.75, muzzle.z + dz * distance);
}
function updateHud() {
  $('status').textContent = weapons.reloadRemaining ? `${weapons.weapon.name} · RELOADING ${weapons.reloadRemaining.toFixed(1)}s` : `${weapons.weapon.name} · ${weapons.ammo[weapons.index]} / ${weapons.weapon.capacity}`;
  $('swap').textContent = weapons.index ? 'RIFLE' : 'PISTOL';
  $('stats').textContent = `Hits ${hits} · Shots ${shots} · Accuracy ${shots ? Math.round(hits / shots * 100) + '%' : '—'} · Down ${kills}`;
}
renderer.setAnimationLoop(time => {
  const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0; previousTime = time;
  if (started && !document.hidden) {
    elapsed += dt; weapons.tick(dt);
    const keys = input.keys;
    let mx = input.move.x, my = input.move.y;
    if (keys.size) { mx += Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')); my += Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp')); }
    const move = worldVector(mx, my, verticalScale), moving = Math.hypot(move.x, move.z) > 0.01;
    const speed = input.focus ? 3 : 6;
    player.position.x = THREE.MathUtils.clamp(player.position.x + move.x * dt * speed, -13.1, 13.1);
    player.position.z = THREE.MathUtils.clamp(player.position.z + move.z * dt * speed, -13.1, 13.1);
    if (moving) { legs.rotation.y = Math.atan2(-move.x, -move.z); leftLeg.position.z = Math.sin(elapsed * 18) * 0.13; rightLeg.position.z = -leftLeg.position.z; } else leftLeg.position.z = rightLeg.position.z = 0;
    const aim = worldVector(input.aim.x, input.aim.y, verticalScale);
    if (Math.hypot(aim.x, aim.z) > 0.01) { const length = Math.hypot(aim.x, aim.z); aimX = aim.x / length; aimZ = aim.z / length; }
    else if (input.pointerAim) {
      pointer.set(input.pointerAim.x / innerWidth * 2 - 1, 1 - input.pointerAim.y / innerHeight * 2); raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(ground, mouseWorld)) { const x = mouseWorld.x - player.position.x, z = mouseWorld.z - player.position.z, length = Math.hypot(x, z); if (length > 0.1) { aimX = x / length; aimZ = z / length; } }
    }
    angle = Math.atan2(-aimX, -aimZ); torso.rotation.y = angle;
    kick *= Math.exp(-dt * 22); gun.position.z = kick;
    player.updateMatrixWorld(true);
    if (input.fires.size || (input.aimFire && Math.hypot(input.aim.x, input.aim.y) > 0.5)) shoot(moving);
    flashTime = Math.max(0, flashTime - dt); flash.visible = flashTime > 0;
    reticle.position.set(player.position.x + aimX * 5, 0.05, player.position.z + aimZ * 5);
    setLine(sight, player.position.x, 0.06, player.position.z, reticle.position.x, 0.06, reticle.position.z);
    for (const target of targets) {
      if (target.down > 0) { target.down -= dt; target.group.visible = false; if (target.down <= 0) { target.hp = 100; target.group.visible = true; } }
      if (target.moving) target.x = target.baseX + Math.sin(elapsed * 0.9) * 2;
      target.group.position.x = target.x; target.flash = Math.max(0, target.flash - dt);
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
    return { started, x: player.position.x, z: player.position.z, aimX, aimZ, shots, hits, weapon: weapons.weapon.name, ammo: weapons.ammo[weapons.index], reloading: weapons.reloadRemaining, move: { ...input.move }, aim: { ...input.aim }, fireCount: input.fires.size, drawCalls: renderer.info.render.calls,
      targets: targets.map(t => { const v = new THREE.Vector3(t.x, 0, t.z).project(camera); return { x: t.x, z: t.z, hp: t.hp, screenX: (v.x + 1) / 2 * innerWidth, screenY: (1 - v.y) / 2 * innerHeight }; }) };
  }
};
window.addEventListener('pagehide', () => { input.clear(); renderer.setAnimationLoop(null); });
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
