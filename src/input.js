import { stickVector } from './combat.js?v=thumb-4';
export function createInput(canvas, onReload, onSwap) {
  const state = { move: { x: 0, y: 0 }, lookDelta: { x: 0, y: 0 }, looking: false, keys: new Set(), fires: new Set(), focus: false, pointerAim: null };
  const element = document.getElementById('move'), knob = element.querySelector('.knob');
  let moveId = null, look = null;
  function updateMove(e) {
    const rect = element.getBoundingClientRect(), radius = rect.width * 0.37;
    const x = e.clientX - rect.left - rect.width / 2, y = e.clientY - rect.top - rect.height / 2;
    state.move = stickVector(x, y, radius);
    const factor = Math.min(1, radius / Math.max(1, Math.hypot(x, y)));
    knob.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
  }
  function releaseMove(e) {
    if (e && e.pointerId !== moveId) return;
    const previous = moveId; moveId = null; state.move = { x: 0, y: 0 }; knob.style.transform = '';
    if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
  }
  element.addEventListener('pointerdown', e => { e.preventDefault(); if (moveId !== null) return; moveId = e.pointerId; element.setPointerCapture(moveId); updateMove(e); });
  element.addEventListener('pointermove', e => { if (moveId === e.pointerId) updateMove(e); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(event, releaseMove);

  // One right thumb owns either free look or fire + look. Aim is relative to
  // finger travel, so lifting/replanting the thumb never snaps the gun around.
  function releaseLook(e) {
    if (!look || (e && e.pointerId !== look.id)) return;
    const previous = look; look = null; state.looking = false;
    state.fires.delete('touch-fire'); previous.element.classList.remove('held');
    if (previous.element.hasPointerCapture(previous.id)) previous.element.releasePointerCapture(previous.id);
  }
  function bindLook(surface, firing) {
    surface.addEventListener('pointerdown', e => {
      if (!firing && (e.pointerType === 'mouse' || e.clientX < innerWidth / 2)) return;
      e.preventDefault(); if (look) return;
      look = { id: e.pointerId, element: surface, x: e.clientX, y: e.clientY };
      state.looking = true; state.pointerAim = null; surface.setPointerCapture(e.pointerId);
      if (firing) { state.fires.add('touch-fire'); surface.classList.add('held'); }
    });
    surface.addEventListener('pointermove', e => {
      if (!look || look.id !== e.pointerId || look.element !== surface) return;
      state.lookDelta.x += e.clientX - look.x; state.lookDelta.y += e.clientY - look.y;
      look.x = e.clientX; look.y = e.clientY;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(event, releaseLook);
  }
  bindLook(canvas, false); bindLook(document.getElementById('fire-right'), true);
  canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !look) state.pointerAim = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; canvas.setPointerCapture(e.pointerId); if (e.button === 0) state.fires.add('mouse'); if (e.button === 2) state.focus = true; });
  const releaseMouse = e => { if (e.pointerType !== 'mouse') return; state.fires.delete('mouse'); state.focus = false; };
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, releaseMouse);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    state.keys.add(e.code); if (e.repeat) return;
    if (e.code === 'KeyR') onReload(); if (e.code === 'KeyQ') onSwap();
    if (e.code === 'Space') state.fires.add('keyboard');
  });
  document.addEventListener('keyup', e => { state.keys.delete(e.code); if (e.code === 'Space') state.fires.delete('keyboard'); });
  state.clear = () => { releaseMove(); releaseLook(); state.lookDelta.x = state.lookDelta.y = 0; state.keys.clear(); state.fires.clear(); state.focus = false; state.pointerAim = null; };
  window.addEventListener('blur', state.clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) state.clear(); });
  window.addEventListener('resize', state.clear);
  return state;
}
