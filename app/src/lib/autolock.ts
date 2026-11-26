import { isUnlocked, lock } from './vault';

/**
 * Locks the vault after `ms` of no touch/keyboard/mouse activity, and whenever
 * the app is sent to the background for that long. Returns a stop function.
 */
export function startAutoLock(ms: number, onLock: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let hiddenAt = 0;

  const fire = () => {
    if (isUnlocked()) {
      lock();
      onLock();
    }
  };
  const reset = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fire, ms);
  };
  const onVisibility = () => {
    if (document.hidden) hiddenAt = Date.now();
    else {
      if (hiddenAt && Date.now() - hiddenAt >= ms) fire();
      hiddenAt = 0;
      reset();
    }
  };

  const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;
  events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
  document.addEventListener('visibilitychange', onVisibility);
  reset();

  return () => {
    if (timer) clearTimeout(timer);
    events.forEach((e) => window.removeEventListener(e, reset));
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
