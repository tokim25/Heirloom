import React from 'react';

/**
 * The Heirloom mark (a heart with a sprouting leaf) drawn as outlines that write themselves in once.
 * Used where a screen is empty, so "nothing here yet" feels like a beginning. Static under reduced motion.
 */
export const Sprout: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 72 }) => (
  <svg
    viewBox="0 0 100 100"
    width={size}
    height={size}
    className={`sprout ${className}`}
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path
      className="sprout-heart"
      pathLength={1}
      stroke="currentColor"
      strokeWidth="5"
      d="M 50,84 C 25,64 10,42 28,26 C 40,16 48,28 50,36 C 52,28 60,16 72,26 C 90,42 75,64 50,84 Z"
    />
    <path className="sprout-leaf" pathLength={1} stroke="var(--color-sage)" strokeWidth="5" d="M 50,34 Q 58,19 68,14 Q 56,12 50,24" />
  </svg>
);
