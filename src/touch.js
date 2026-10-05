// Safari native gestures are separate from the game's pointer ownership.
// Never stop propagation or cancel the two player-control pointers.
export function installTouchGuards() {
  const surface = '#game, #move, #fire-right, .actions';
  const onGame = target => Boolean(target?.closest?.(surface));
  const role = target => target?.closest?.('#move') ? 'move' : target?.closest?.('#game, #fire-right, .actions') ? 'aim' : null;
  const options = { passive: false, capture: true };
  let lastGameEnd = -Infinity;
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, event => { if (event.cancelable) event.preventDefault(); }, options);
  }
  for (const type of ['touchstart', 'touchmove']) {
    document.addEventListener(type, event => {
      if (event.touches.length < 2 || !Array.from(event.touches).some(t => onGame(t.target))) return;
      const roles = Array.from(event.touches, t => role(t.target));
      const controlPair = roles.length === 2 && roles.includes('move') && roles.includes('aim');
      // Allow the real two-thumb pair. Extra/unowned contacts get no native pinch action.
      if (!controlPair && event.cancelable) event.preventDefault();
    }, options);
  }
  document.addEventListener('touchend', event => {
    if (event.touches.length || !onGame(event.target)) return;
    if (event.timeStamp - lastGameEnd < 350 && event.cancelable) event.preventDefault();
    lastGameEnd = event.timeStamp;
  }, options);
  window.addEventListener('blur', () => { lastGameEnd = -Infinity; });
}
