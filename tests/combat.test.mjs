import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, worldVector, rayCircle, WeaponState } from '../src/combat.js';
test('stick deadzone, analog response, and clamping', () => {
  assert.deepEqual(stickVector(1, 1, 50), { x: 0, y: 0 });
  assert.equal(stickVector(100, 0, 50).x, 1);
  assert.ok(stickVector(25, 0, 50).x > 0 && stickVector(25, 0, 50).x < 1);
});
test('diagonal movement cannot exceed cardinal speed', () => {
  for (const [x, y] of [[1, 1], [0, 1], [1, 0]]) { const v = worldVector(x, y, 0.8); assert.ok(Math.hypot(v.x, v.z) <= 1.000001); }
  const v = worldVector(0, -1, 0.8); assert.deepEqual(v, { x: 0, z: -1 });
});
test('hitscan distinguishes hits, misses, and targets behind muzzle', () => {
  assert.equal(rayCircle(0, 0, 0, -1, 0, -5, 0.5), 4.5);
  assert.equal(rayCircle(0, 0, 0, -1, 2, -5, 0.5), Infinity);
  assert.equal(rayCircle(0, 0, 0, -1, 0, 5, 0.5), Infinity);
});
test('fire rate, empty magazine, reload, and weapon swap state', () => {
  const w = new WeaponState(); assert.equal(w.fire(), true); assert.equal(w.fire(), false); assert.equal(w.ammo[0], 29);
  for (let i = 0; i < 29; i++) { w.tick(0.11); assert.equal(w.fire(), true); }
  w.tick(0.11); assert.equal(w.fire(), false); assert.ok(w.reloadRemaining > 0);
  w.tick(0.5); assert.equal(w.fire(), false); w.tick(1); assert.equal(w.ammo[0], 30);
  w.fire(); w.reload(); w.swap(); assert.equal(w.reloadRemaining, 0); assert.equal(w.ammo[0], 29); assert.equal(w.ammo[1], 12);
});
