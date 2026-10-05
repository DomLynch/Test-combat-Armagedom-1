export const WEAPONS = [
  { name: 'RIFLE', capacity: 30, interval: 0.105, reload: 1.35, damage: 25, spread: 0.022, kick: 0.14 },
  { name: 'PISTOL', capacity: 12, interval: 0.27, reload: 0.95, damage: 40, spread: 0.012, kick: 0.23 },
];
export function stickVector(x, y, radius, deadzone = 0.16) {
  const length = Math.hypot(x, y);
  if (length <= radius * deadzone) return { x: 0, y: 0 };
  const strength = Math.min(1, ((length / radius - deadzone) / (1 - deadzone)) ** 1.25);
  return { x: x / length * strength, y: y / length * strength };
}
export function worldVector(x, y, verticalScale, yaw = 0) {
  const length = Math.hypot(x, y / verticalScale);
  if (!length) return { x: 0, z: 0 };
  const strength = Math.min(1, Math.hypot(x, y));
  const right = x / length * strength, down = y / verticalScale / length * strength;
  return { x: right * Math.cos(yaw) + down * Math.sin(yaw), z: -right * Math.sin(yaw) + down * Math.cos(yaw) };
}
// Horizontal travel rotates freely; vertical travel adjusts reticle distance.
// Keeping radius separate from heading avoids a cursor clamp resisting reversal.
export function turnAim(x, z, dx, dy, sensitivity = 1, unitsPerPixel = 0.04) {
  const angle = Math.atan2(x, z) - dx * Math.PI / 180 * sensitivity;
  const radius = Math.max(3, Math.min(14, Math.hypot(x, z) - dy * unitsPerPixel * sensitivity));
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}
// Follow the shortest arc at a time-based rate, including across the ±180° seam.
export function followAngle(current, target, dt, rate = 24) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-Math.max(0, dt) * rate));
}
// A small, non-accumulating correction near a living target. No lock or long-range pull.
export function aimAssist(angle, ox, oz, targets) {
  const cone = 6 * Math.PI / 180;
  let correction = 0, best = cone;
  for (const t of targets) {
    if (t.hp <= 0) continue;
    const distance = Math.hypot(t.x - ox, t.z - oz);
    if (distance >= 6 || distance < 0.01) continue;
    const delta = Math.atan2(Math.sin(Math.atan2(t.x - ox, t.z - oz) - angle), Math.cos(Math.atan2(t.x - ox, t.z - oz) - angle));
    if (Math.abs(delta) >= best) continue;
    best = Math.abs(delta);
    correction = delta * 0.3575 * Math.max(0, Math.min(1, (6 - distance) / 4));
  }
  return correction;
}
// Acquire inside 6°, retain inside 9°: 50% more angular effort to leave.
// Follow bearing changes without removing the player's intentional aim error.
export class StickyAim {
  constructor() { this.reset(); }
  reset() { this.target = -1; this.bearing = 0; this.correction = 0; }
  valid(ox, oz, targets) {
    const t = targets[this.target];
    const distance = t ? Math.hypot(t.x - ox, t.z - oz) : Infinity;
    return t && t.hp > 0 && distance >= 0.01 && distance < 6;
  }
  track(angle, ox, oz, targets, active) {
    if (!active || !this.valid(ox, oz, targets)) { this.reset(); return angle; }
    const t = targets[this.target], bearing = Math.atan2(t.x - ox, t.z - oz);
    const change = Math.atan2(Math.sin(bearing - this.bearing), Math.cos(bearing - this.bearing));
    this.bearing = bearing;
    return angle + change;
  }
  update(angle, ox, oz, targets, active, acquire = true) {
    this.correction = 0;
    if (!active) { this.reset(); return 0; }
    let best = 6 * Math.PI / 180;
    if (this.valid(ox, oz, targets)) {
      const t = targets[this.target], bearing = Math.atan2(t.x - ox, t.z - oz);
      const delta = Math.atan2(Math.sin(bearing - angle), Math.cos(bearing - angle));
      if (Math.abs(delta) < 9 * Math.PI / 180) {
        this.bearing = bearing;
        this.correction = delta * 0.3575 * Math.max(0, Math.min(1, (6 - Math.hypot(t.x - ox, t.z - oz)) / 4));
        return this.correction;
      }
    }
    this.reset();
    if (!acquire) return 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i], distance = Math.hypot(t.x - ox, t.z - oz);
      if (t.hp <= 0 || distance >= 6 || distance < 0.01) continue;
      const bearing = Math.atan2(t.x - ox, t.z - oz);
      const delta = Math.atan2(Math.sin(bearing - angle), Math.cos(bearing - angle));
      if (Math.abs(delta) >= best) continue;
      best = Math.abs(delta); this.target = i; this.bearing = bearing;
      this.correction = delta * 0.3575 * Math.max(0, Math.min(1, (6 - distance) / 4));
    }
    return this.correction;
  }
}
// Analytic hitscan against a target circle, returning the entry distance.
export function rayCircle(ox, oz, dx, dz, cx, cz, radius) {
  const x = cx - ox, z = cz - oz;
  const along = x * dx + z * dz;
  const perpendicularSquared = x * x + z * z - along * along;
  if (perpendicularSquared > radius * radius) return Infinity;
  const half = Math.sqrt(Math.max(0, radius * radius - perpendicularSquared));
  if (along + half < 0) return Infinity;
  return Math.max(0, along - half);
}
// First live opponent intersected by the actual gun ray, independently of cursor distance.
export function targetOnRay(ox, oz, dx, dz, targets, maximum = 32) {
  let selected = -1, distance = maximum;
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]; if (t.hp <= 0) continue;
    const entry = rayCircle(ox, oz, dx, dz, t.x, t.z, 0.58);
    if (entry < distance) { distance = entry; selected = i; }
  }
  return selected;
}
export class WeaponState {
  constructor() { this.reset(); }
  reset() { this.index = 0; this.ammo = WEAPONS.map(w => w.capacity); this.cooldown = 0; this.reloadRemaining = 0; }
  get weapon() { return WEAPONS[this.index]; }
  swap() { this.index = 1 - this.index; this.reloadRemaining = 0; this.cooldown = 0.22; }
  reload() {
    if (this.reloadRemaining) return 'busy';
    if (this.ammo[this.index] === this.weapon.capacity) return 'full';
    this.reloadRemaining = this.weapon.reload; return 'started';
  }
  tick(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadRemaining > 0) {
      this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
      if (!this.reloadRemaining) this.ammo[this.index] = this.weapon.capacity;
    }
  }
  fire() {
    if (this.cooldown > 0 || this.reloadRemaining > 0) return false;
    if (!this.ammo[this.index]) { this.reload(); return false; }
    this.ammo[this.index]--; this.cooldown = this.weapon.interval; return true;
  }
}
