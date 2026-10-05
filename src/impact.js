// Presentation clocks only: movement, aim, damage and weapon timers never pause.
export class ImpactFeedback {
  constructor(level = 'high') { this.level = level; this.reset(); }
  reset() { this.recoil = this.slide = this.hold = this.cameraX = this.cameraZ = this.cameraAge = 0; this.pistol = false; this.lastHold = 0; }
  setLevel(level) { this.level = ['high', 'low', 'off'].includes(level) ? level : 'low'; this.reset(); }
  shot(pistol, dx, dz) {
    this.pistol = pistol;
    this.recoil = this.level === 'off' ? 0 : this.level === 'low' ? 0.4 : 1;
    this.slide = pistol ? this.recoil : 0;
    this.impulse(-dx, -dz, pistol ? 1.8 : 0.8);
  }
  hit(killed, dx, dz) {
    this.hold = this.level === 'high' ? killed ? 0.08 : this.pistol ? 0.05 : 0.04 : 0;
    this.lastHold = this.hold;
    this.impulse(dx, dz, killed ? 4 : 2.2);
  }
  impulse(dx, dz, strength) {
    if (this.level !== 'high') return;
    this.cameraX += dx * strength; this.cameraZ += dz * strength;
    const length = Math.hypot(this.cameraX, this.cameraZ);
    if (length > 4) { this.cameraX *= 4 / length; this.cameraZ *= 4 / length; }
    this.cameraAge = 0;
  }
  tick(dt) {
    dt = Math.max(0, dt);
    const visualDt = Math.max(0, dt - this.hold);
    this.hold = Math.max(0, this.hold - dt);
    this.recoil *= Math.exp(-visualDt * (this.pistol ? 20 : 30));
    this.slide *= Math.exp(-visualDt * 45);
    this.cameraX *= Math.exp(-dt * 30); this.cameraZ *= Math.exp(-dt * 30); this.cameraAge += dt;
    if (this.recoil < 0.001) this.recoil = 0;
    if (this.slide < 0.001) this.slide = 0;
    if (Math.hypot(this.cameraX, this.cameraZ) < 0.001) this.cameraX = this.cameraZ = 0;
  }
  get cameraWave() { return Math.cos(this.cameraAge * 45); }
}
export class HitReaction {
  constructor() { this.reset(); }
  reset() { this.energy = this.hold = this.x = this.z = 0; this.killed = false; }
  hit(dx, dz, killed, level) {
    this.x = dx; this.z = dz; this.killed = killed;
    this.energy = level === 'off' ? 0 : level === 'low' ? 0.4 : 1;
    this.hold = level === 'high' ? killed ? 0.08 : 0.045 : 0;
  }
  tick(dt) {
    const visualDt = Math.max(0, dt - this.hold); this.hold = Math.max(0, this.hold - dt);
    this.energy *= Math.exp(-visualDt * (this.killed ? 15 : 22));
    if (this.energy < 0.001) this.energy = 0;
  }
}
