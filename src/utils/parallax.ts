/** People who ask for less motion get none of the movement below. */
export const reducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * How far to shift a picture inside its frame so it appears to move slower than the page. `progress` runs from +1
 * (the frame is just entering at the bottom of the screen) to -1 (just leaving at the top); the picture drifts the
 * opposite way by up to `range` pixels.
 */
export function parallaxOffset(frameTop: number, frameHeight: number, viewportHeight: number, range: number): number {
  const progress = (frameTop + frameHeight / 2 - viewportHeight / 2) / (viewportHeight / 2 + frameHeight / 2);
  return -Math.max(-1, Math.min(1, progress)) * range;
}

/** The hero picture on a recipe sinks at a third of the scroll speed, never further than its own travel. */
export function heroShift(scrollTop: number, heroHeight: number, factor = 0.35): number {
  return Math.max(0, Math.min(scrollTop, heroHeight)) * factor;
}

// One shared scroll listener drives every visible picture, so a long cookbook costs the same as a short one.
const listeners = new Set<() => void>();
let ticking = false;
let attached = false;
const tick = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    listeners.forEach((fn) => fn());
  });
};

export function onPageScroll(fn: () => void): () => void {
  listeners.add(fn);
  if (!attached) {
    window.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick);
    attached = true;
  }
  fn();
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && attached) {
      window.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
      attached = false;
    }
  };
}
