import { stickVector } from './combat.js?v=combat-14';
export function createInput(canvas, onReload, onSwap) {
  const state = { move: { x: 0, y: 0 }, moveHeld: false, touchAim: false, keys: new Set(), fires: new Set(), firePressed: false, focus: false, pointerAim: null };
  const element = document.getElementById('move'), knob = element.querySelector('.knob');
  let moveId = null;
  function updateMove(e) {
    const rect = element.getBoundingClientRect(), radius = rect.width * 0.37;
    const x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
    state.move = stickVector(x, y, radius);
    const factor = Math.min(1, radius / Math.max(1, Math.hypot(x, y)));
    knob.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
  }
  function releaseMove(e) {
    if (e && e.pointerId !== moveId) return;
    const previous = moveId; moveId = null; state.moveHeld = false; state.move = { x: 0, y: 0 }; knob.style.transform = '';
    if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
  }
  element.addEventListener('pointerdown', e => { e.preventDefault(); if (moveId !== null) return; moveId = e.pointerId; state.moveHeld = true; state.touchAim = true; state.pointerAim = null; element.setPointerCapture(moveId); updateMove(e); });
  element.addEventListener('pointermove', e => { if (moveId === e.pointerId) updateMove(e); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, releaseMove);

  // FIRE owns only its press/release. Pointer travel never steers or moves.
  const fire = document.getElementById('fire-right');
  let fireId = null;
  function releaseFire(e) {
    if (fireId === null || (e && e.pointerId !== fireId)) return;
    if (e && e.type !== 'pointerup') state.firePressed = false;
    const previous = fireId; fireId = null; state.fires.delete('touch-fire'); fire.classList.remove('held');
    if (fire.hasPointerCapture(previous)) fire.releasePointerCapture(previous);
  }
  fire.addEventListener('pointerdown', e => {
    if (e.button !== 0 || fireId !== null) return;
    e.preventDefault(); fireId = e.pointerId; fire.setPointerCapture(fireId);
    state.firePressed = true; state.fires.add('touch-fire'); fire.classList.add('held');
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) fire.addEventListener(event, releaseFire);
  // Desktop mouse aim remains available; mobile canvas touches have no aim role.
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { state.touchAim = false; state.pointerAim = { x: e.clientX, y: e.clientY }; } });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; canvas.setPointerCapture(e.pointerId); if (e.button === 0) { state.firePressed = true; state.fires.add('mouse'); } if (e.button === 2) state.focus = true; });
  const releaseMouse = e => { if (e.pointerType !== 'mouse') return; if (e.type !== 'pointerup' && state.fires.has('mouse')) state.firePressed = false; state.fires.delete('mouse'); state.focus = false; };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, releaseMouse);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    state.keys.add(e.code); if (e.repeat) return;
    if (e.code === 'KeyR') onReload(); if (e.code === 'KeyQ') onSwap();
    if (e.code === 'Space') { state.firePressed = true; state.fires.add('keyboard'); }
  });
  document.addEventListener('keyup', e => { state.keys.delete(e.code); if (e.code === 'Space') state.fires.delete('keyboard'); });
  state.clear = () => { releaseMove(); releaseFire(); state.keys.clear(); state.fires.clear(); state.firePressed = false; state.focus = false; state.pointerAim = null; };
  window.addEventListener('blur', state.clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) state.clear(); });
  window.addEventListener('resize', state.clear);
  return state;
}

// Respond on contact, including while another finger owns the movement stick.
// Suppress the compatibility click; detail=0 retains keyboard/accessibility activation.
export function bindAction(element, action) {
  element.addEventListener('pointerdown', e => { if (e.button !== 0) return; e.preventDefault(); action(); });
  element.addEventListener('click', e => { if (e.detail === 0) action(); });
}
