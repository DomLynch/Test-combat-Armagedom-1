// Shared Web Audio feedback on all platforms; one cached noise buffer, bounded voices.
export function createCombatAudio() {
  let context, output, noiseBuffer, enabled = true, played = 0, shotEvents = 0, hitEvents = 0, killEvents = 0;
  let lastShotLayers = 0, lastHitLayers = 0;
  const sources = new Set();
  function unlock() {
    if (!enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!context) {
        context = new Audio({ latencyHint: 'interactive' });
        const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -12; compressor.knee.value = 8; compressor.ratio.value = 4;
        output = context.createGain(); output.gain.value = 0.65; output.connect(compressor); compressor.connect(context.destination);
        noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.16), context.sampleRate);
        const data = noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      if (context.state === 'suspended') context.resume().catch(() => {});
    } catch { /* Optional audio must never interrupt gameplay. */ }
  }
  function play(source, duration, volume, filter) {
    if (!enabled || context?.state !== 'running' || sources.size >= 16) return;
    const now = context.currentTime, gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + 0.002); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter || gain); if (filter) filter.connect(gain); gain.connect(output);
    sources.add(source); played++;
    source.onended = () => { sources.delete(source); source.disconnect(); filter?.disconnect(); gain.disconnect(); };
    source.start(now); source.stop(now + duration + 0.01);
  }
  function tone(from, to, duration, volume, type = 'triangle') {
    if (!enabled || context?.state !== 'running') return;
    const source = context.createOscillator(); source.type = type; source.frequency.setValueAtTime(from, context.currentTime); source.frequency.exponentialRampToValueAtTime(to, context.currentTime + duration);
    play(source, duration, volume);
  }
  function noise(duration, volume, frequency) {
    if (!enabled || context?.state !== 'running') return;
    const source = context.createBufferSource(); source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter(); filter.type = 'highpass'; filter.frequency.value = frequency;
    play(source, duration, volume, filter);
  }
  document.addEventListener('pointerdown', unlock, { passive: true }); document.addEventListener('keydown', unlock);
  return {
    setEnabled(value) { enabled = value; if (enabled) unlock(); else for (const source of sources) { try { source.stop(); } catch {} } },
    shot(pistol, level = 'high') { if (!enabled || context?.state !== 'running') return; shotEvents++; lastShotLayers = level === 'off' ? 1 : 2; if (level === 'off') { tone(pistol ? 240 : 170, 55, pistol ? 0.08 : 0.055, 0.085); return; } tone(pistol ? 220 : 165, 48, pistol ? 0.11 : 0.07, pistol ? 0.22 : 0.16); noise(pistol ? 0.065 : 0.04, 0.15, pistol ? 900 : 1400); },
    hit(killed, level = 'high') { if (!enabled || context?.state !== 'running') return; hitEvents++; if (killed) killEvents++; lastHitLayers = level === 'off' ? 1 : killed ? 3 : 2; if (level === 'off') { tone(killed ? 1450 : 1000, killed ? 550 : 800, killed ? 0.09 : 0.035, 0.062, 'sine'); return; } tone(killed ? 160 : 280, killed ? 55 : 130, killed ? 0.14 : 0.065, 0.16); noise(killed ? 0.085 : 0.03, 0.1, 1700); if (killed) tone(1000, 1500, 0.09, 0.065, 'sine'); },
    snapshot() { return { enabled, ready: context?.state === 'running', played, voices: sources.size, shotEvents, hitEvents, killEvents, lastShotLayers, lastHitLayers }; }
  };
}
