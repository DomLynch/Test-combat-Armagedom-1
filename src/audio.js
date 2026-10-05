// Tiny procedural cues; no downloads. Audio is unlocked by an actual gesture.
export function createCombatAudio() {
  let context, enabled = true, played = 0, voices = 0;
  function unlock() {
    if (!enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try { context ||= new Audio(); if (context.state === 'suspended') context.resume().catch(() => {}); } catch { /* Audio is optional. */ }
  }
  function tone(from, to, duration, volume, type) {
    if (!enabled || context?.state !== 'running') return;
    const now = context.currentTime, oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(from, now); oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + 0.003); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain); gain.connect(context.destination); voices++; played++;
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices--; };
    oscillator.start(now); oscillator.stop(now + duration + 0.01);
  }
  document.addEventListener('pointerdown', unlock, { passive: true });
  document.addEventListener('keydown', unlock);
  return {
    setEnabled(value) { enabled = value; if (enabled) unlock(); },
    shot(pistol) { tone(pistol ? 240 : 170, 55, pistol ? 0.08 : 0.055, 0.055, 'triangle'); },
    hit(killed) { tone(killed ? 1450 : 1000, killed ? 550 : 800, killed ? 0.09 : 0.035, 0.04, 'sine'); },
    snapshot() { return { enabled, ready: context?.state === 'running', played, voices }; }
  };
}
