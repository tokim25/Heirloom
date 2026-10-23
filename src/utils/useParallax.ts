import { useEffect, useRef } from 'react';
import { heroShift, onPageScroll, parallaxOffset, reducedMotion } from './parallax.ts';

/**
 * A picture that drifts slightly inside its frame as the frame scrolls through the screen. Only frames on screen
 * listen for scrolling. Attach `frameRef` to the clipping container and `mediaRef` to the image inside it.
 */
export function useCardParallax<F extends HTMLElement, M extends HTMLElement>(range = 10) {
  const frameRef = useRef<F>(null);
  const mediaRef = useRef<M>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const media = mediaRef.current;
    if (!frame || !media || reducedMotion()) return;
    let stop: (() => void) | null = null;
    const update = () => {
      const r = frame.getBoundingClientRect();
      media.style.transform = `translate3d(0, ${parallaxOffset(r.top, r.height, window.innerHeight, range).toFixed(1)}px, 0) scale(1.14)`;
    };
    const watcher = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!stop) stop = onPageScroll(update);
        } else {
          stop?.();
          stop = null;
        }
      },
      { rootMargin: '80px' }
    );
    watcher.observe(frame);
    return () => {
      watcher.disconnect();
      stop?.();
    };
  }, [range]);

  return { frameRef, mediaRef };
}

/** The picture at the top of a recipe sinks slower than the text scrolls over it. `scrollRef` is the scrolling container. */
export function useHeroParallax<S extends HTMLElement, H extends HTMLElement, M extends HTMLElement>() {
  const scrollRef = useRef<S>(null);
  const heroRef = useRef<H>(null);
  const mediaRef = useRef<M>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const hero = heroRef.current;
    const media = mediaRef.current;
    if (!scroller || !hero || !media || reducedMotion()) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      media.style.transform = `translate3d(0, ${heroShift(scroller.scrollTop, hero.offsetHeight).toFixed(1)}px, 0)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return { scrollRef, heroRef, mediaRef };
}
