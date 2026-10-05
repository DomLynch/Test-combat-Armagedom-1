export const WEAPONS = [
  { name: 'RIFLE', capacity: 30, interval: 0.105, reload: 1.35, damage: 25, spread: 0.022, kick: 0.14 },
  { name: 'PISTOL', capacity: 12, interval: 0.27, reload: 0.95, damage: 40, spread: 0.012, kick: 0.23 },
];
export function stickVector(x, y, radius, deadzone = 0.13) {
  const length = Math.hypot(x, y);
  if (length <= radius * deadzone) return { x: 0, y: 0 };
  const strength = Math.min(1, (length / radius - deadzone) / (1 - deadzone));
  return { x: x / length * strength, y: y / length * strength };
}
export function worldVector(x, y, verticalScale, yaw = 0) {
  const length = Math.hypot(x, y / verticalScale);
  if (!length) return { x: 0, z: 0 };
  const strength = Math.min(1, Math.hypot(x, y));
  const right = x / length * strength, down = y / verticalScale / length * strength;
  return { x: right * Math.cos(yaw) + down * Math.sin(yaw), z: -right * Math.sin(yaw) + down * Math.cos(yaw) };
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
export class WeaponState {
  constructor() { this.reset(); }
  reset() { this.index = 0; this.ammo = WEAPONS.map(w => w.capacity); this.cooldown = 0; this.reloadRemaining = 0; }
  get weapon() { return WEAPONS[this.index]; }
  swap() { this.index = 1 - this.index; this.reloadRemaining = 0; this.cooldown = 0.22; }
  reload() { if (!this.reloadRemaining && this.ammo[this.index] < this.weapon.capacity) this.reloadRemaining = this.weapon.reload; }
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
