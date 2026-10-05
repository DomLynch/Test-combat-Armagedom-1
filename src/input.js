import { stickVector } from './combat.js?v=isometric-2';
export function createInput(canvas, onReload, onSwap) {
  const state = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, keys: new Set(), fires: new Set(), focus: false, pointerAim: null, aimFire: false };
  const resets = [];
  for (const name of ['move', 'aim']) {
    const element = document.getElementById(name), knob = element.querySelector('.knob');
    let id = null;
    function update(e) {
      const rect = element.getBoundingClientRect(), radius = rect.width * 0.37;
      const x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
      state[name] = stickVector(x, y, radius);
      const factor = Math.min(1, radius / Math.max(1, Math.hypot(x, y)));
      knob.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
      if (name === 'aim') state.pointerAim = null;
    }
    function release(e) {
      if (e && e.pointerId !== id) return;
      const previous = id; id = null; state[name] = { x: 0, y: 0 }; knob.style.transform = '';
      if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
    }
    element.addEventListener('pointerdown', e => { e.preventDefault(); if (id !== null) return; id = e.pointerId; element.setPointerCapture(id); update(e); });
    element.addEventListener('pointermove', e => { if (id === e.pointerId) update(e); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, release);
    resets.push(() => release());
  }
  for (const name of ['fire-left', 'fire-right', 'focus']) {
    const element = document.getElementById(name); let id = null;
    function release(e) {
      if (e && e.pointerId !== id) return;
      const previous = id; id = null; state.fires.delete(name); if (name === 'focus') state.focus = false; element.classList.remove('held');
      if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
    }
    element.addEventListener('pointerdown', e => { e.preventDefault(); if (id !== null) return; id = e.pointerId; element.setPointerCapture(id); element.classList.add('held'); if (name === 'focus') state.focus = true; else state.fires.add(name); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, release);
    resets.push(() => release());
  }
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') state.pointerAim = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; canvas.setPointerCapture(e.pointerId); if (e.button === 0) state.fires.add('mouse'); if (e.button === 2) state.focus = true; });
  const releaseMouse = () => { state.fires.delete('mouse'); state.focus = false; };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, releaseMouse);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    state.keys.add(e.code); if (e.repeat) return;
    if (e.code === 'KeyR') onReload(); if (e.code === 'KeyQ') onSwap();
    if (e.code === 'Space') state.fires.add('keyboard');
  });
  document.addEventListener('keyup', e => { state.keys.delete(e.code); if (e.code === 'Space') state.fires.delete('keyboard'); });
  state.clear = () => { for (const reset of resets) reset(); state.keys.clear(); state.fires.clear(); state.focus = false; state.pointerAim = null; };
  window.addEventListener('blur', state.clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) state.clear(); });
  window.addEventListener('resize', state.clear);
  return state;
}
