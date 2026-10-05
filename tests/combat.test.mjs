import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector, worldVector, turnAim, followAngle, aimAssist, StickyAim, targetOnRay, rayCircle, WeaponState } from '../src/combat.js';
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
test('isometric sticks follow screen direction and preserve analog speed', () => {
  const up = worldVector(0, -1, 0.65, Math.PI / 4);
  const right = worldVector(1, 0, 0.65, Math.PI / 4);
  assert.ok(Math.abs(up.x + Math.SQRT1_2) < 1e-9 && Math.abs(up.z + Math.SQRT1_2) < 1e-9);
  assert.ok(Math.abs(right.x - Math.SQRT1_2) < 1e-9 && Math.abs(right.z + Math.SQRT1_2) < 1e-9);
  for (const [x, y] of [[1, 1], [0.3, 0.4], [-0.8, 0.2]]) {
    const v = worldVector(x, y, 0.65, Math.PI / 4);
    assert.ok(Math.abs(Math.hypot(v.x, v.z) - Math.min(1, Math.hypot(x, y))) < 1e-9);
    const screenX = v.x * Math.cos(Math.PI / 4) - v.z * Math.sin(Math.PI / 4);
    const screenY = (v.x * Math.sin(Math.PI / 4) + v.z * Math.cos(Math.PI / 4)) * 0.65;
    assert.ok(Math.abs(screenX * y - screenY * x) < 1e-9);
  }
});
test('fire rate, empty magazine, reload, and weapon swap state', () => {
  const w = new WeaponState(); assert.equal(w.fire(), true); assert.equal(w.fire(), false); assert.equal(w.ammo[0], 29);
  for (let i = 0; i < 29; i++) { w.tick(0.11); assert.equal(w.fire(), true); }
  w.tick(0.11); assert.equal(w.fire(), false); assert.ok(w.reloadRemaining > 0);
  w.tick(0.5); assert.equal(w.fire(), false); w.tick(1); assert.equal(w.ammo[0], 30);
  w.fire(); w.reload(); w.swap(); assert.equal(w.reloadRemaining, 0); assert.equal(w.ammo[0], 29); assert.equal(w.ammo[1], 12);
});

test('swipes turn 180, 270 and 360 degrees independent of radius and event chunking', () => {
  for (const radius of [3, 5, 14]) {
    for (const degrees of [180, 270, 360, -180, -360]) {
      const v = turnAim(0, -radius, degrees, 0);
      assert.ok(Math.abs(v.x / radius - Math.sin(Math.PI - degrees * Math.PI / 180)) < 1e-9);
      assert.ok(Math.abs(v.z / radius - Math.cos(Math.PI - degrees * Math.PI / 180)) < 1e-9);
      let small = { x: 0, z: -radius };
      for (let i = 0; i < 30; i++) small = turnAim(small.x, small.z, degrees / 30, 0);
      assert.ok(Math.hypot(small.x - v.x, small.z - v.z) < 1e-9);
    }
    const shortened = turnAim(0, -radius, 0, 1000);
    assert.ok(Math.abs(shortened.z + 3) < 1e-9); // vertical radius adjustment never reverses heading
  }
});
test('light assist fades with range, ignores distant/dead/behind targets and never locks', () => {
  const angle = 0, offset = 4 * Math.PI / 180;
  const target = distance => [{ x: Math.sin(offset) * distance, z: Math.cos(offset) * distance, hp: 100 }];
  const close = aimAssist(angle, 0, 0, target(2));
  assert.ok(Math.abs(close - 1.65 * Math.PI / 180) < 1e-9, '50% more correction than the combat10 1.1-degree nudge');
  assert.ok(Math.abs(aimAssist(angle, 0, 0, target(4)) - close / 2) < 1e-9);
  assert.ok(Math.abs(aimAssist(angle, 0, 0, target(6))) < 1e-12, 'zero pull at the range boundary within floating-point precision');
  const outside = 6.01 * Math.PI / 180;
  assert.equal(aimAssist(angle, 0, 0, [{x: Math.sin(outside) * 2, z: Math.cos(outside) * 2, hp: 100}]), 0);
  assert.ok(aimAssist(angle, 0, 0, target(4)) < close);
  assert.equal(aimAssist(angle, 0, 0, target(7)), 0);
  assert.equal(aimAssist(angle, 0, 0, [{ x: 0, z: -2, hp: 100 }]), 0);
  assert.equal(aimAssist(angle, 0, 0, [{ ...target(2)[0], hp: 0 }]), 0);
  assert.equal(aimAssist(Math.PI / 2, 0, 0, target(2)), 0);
});
test('reload provides explicit full/busy/started status without restarting repeated taps', () => {
  const w = new WeaponState(); assert.equal(w.reload(), 'full');
  w.fire(); assert.equal(w.reload(), 'started'); w.tick(0.2);
  const remaining = w.reloadRemaining;
  assert.equal(w.reload(), 'busy'); assert.equal(w.reloadRemaining, remaining);
  w.tick(2); assert.equal(w.ammo[0], 30); assert.equal(w.reload(), 'full');
});

test('body turn eases without overshoot, is frame independent and crosses the angle seam', () => {
  const target = Math.PI / 2, first = followAngle(0, target, 1/60);
  assert.ok(first > 0 && first < target / 2);
  let fast = 0, slow = 0;
  for(let i=0;i<60;i++) fast=followAngle(fast,target,1/60);
  for(let i=0;i<30;i++) slow=followAngle(slow,target,1/30);
  assert.ok(Math.abs(fast-slow)<1e-9 && Math.abs(fast-target)<1e-8);
  const seam = followAngle(179*Math.PI/180,-179*Math.PI/180,1/60);
  assert.ok(seam > 179*Math.PI/180 && seam < 181*Math.PI/180);
});

test('marker selects first live target on ray, ignores misses/behind/dead/beyond-wall opponents', () => {
  const targets=[{x:0,z:-8,hp:100},{x:0,z:-4,hp:100},{x:3,z:-2,hp:100},{x:0,z:2,hp:100}];
  assert.equal(targetOnRay(0,0,0,-1,targets),1);
  assert.equal(targetOnRay(0,0,0,-1,targets,3),-1);
  targets[1].hp=0; assert.equal(targetOnRay(0,0,0,-1,targets),0);
  targets[0].hp=0; assert.equal(targetOnRay(0,0,0,-1,targets),-1);
  targets[2].x=0; assert.equal(targetOnRay(0,0,0,-1,targets),2);
});


test('sticky assist acquires at 6 degrees, retains to 9, follows travel and releases deliberately', () => {
  const a = new StickyAim(), rad = Math.PI / 180;
  const targets = [{x: 0, z: 3, hp: 100}, {x: 0.3, z: 3, hp: 100}];
  a.update(7 * rad, 0, 0, targets.slice(0,1), true); assert.equal(a.target, -1);
  a.update(4 * rad, 0, 0, targets, true); assert.equal(a.target, 1);
  a.reset(); a.update(4 * rad, 0, 0, targets.slice(0,1), true); assert.equal(a.target, 0);
  a.update(8.9 * rad, 0, 0, targets, true); assert.equal(a.target, 0, 'nearer competing bearing cannot steal retained target');
  assert.ok(Math.abs(a.correction + 8.9 * rad * 0.4125 * 0.75) < 1e-9, 'retained correction uses the same +50% boost and distance fade');
  assert.ok(Math.abs(a.correction) < 8.9 * rad, 'partial assist preserves manual error');
  const tracked = a.track(8.9 * rad, 1, 0, targets, true);
  assert.ok(Math.abs(tracked - (Math.atan2(-1,3) + 8.9 * rad)) < 1e-9, 'walking preserves intentional offset');
  a.update(tracked, 1, 0, targets, true); assert.equal(a.target, 0);
  a.update(Math.atan2(-1,3) - 9.1 * rad, 1, 0, targets, true); assert.equal(a.target, -1);
  a.update(0, 0, 0, targets, true); assert.equal(a.target, 0);
  targets[0].hp = 0; a.track(0, 0, 0, targets, true); assert.equal(a.target, -1);
  targets[0].hp = 100; a.update(0,0,0,targets,true); a.track(0,0,-4,targets,true); assert.equal(a.target,-1, 'range releases');
  a.update(0,0,0,targets,true); a.update(0,0,0,targets,false); assert.equal(a.target,-1, 'release/cancel/OFF resets retention');
});


test('turn smoothing preserves the original linear walking response and full travel', () => {
  assert.deepEqual(stickVector(12,0,100),{x:0,y:0});
  const half=stickVector(50,0,100).x;
  assert.ok(stickVector(15,0,100).x>0);
  assert.equal(half,(0.5-0.13)/(1-0.13));
  assert.ok(Math.abs(Math.hypot(...Object.values(stickVector(35.355339,35.355339,100)))-half)<1e-7);
  assert.equal(stickVector(100,0,100).x,1); assert.equal(stickVector(150,0,100).x,1);
});
test('gentle steering absorbs brief target wobble while a sustained deliberate turn releases', () => {
  const rad=Math.PI/180, targets=[{x:0,z:3,hp:100}], a=new StickyAim();
  a.update(4*rad,0,0,targets,true); assert.equal(a.target,0);
  const pulse=followAngle(0,12*rad,0.03,10); assert.ok(pulse>0 && pulse<4*rad);
  a.update(4*rad+pulse,0,0,targets,true); assert.equal(a.target,0);
  const deliberate=followAngle(0,12*rad,0.5,10);
  a.update(4*rad+deliberate,0,0,targets,true); assert.equal(a.target,-1);
});
