import React from 'react';

const VULGAR: Record<string, [string, string]> = {
  '⅛': ['1', '8'],
  '¼': ['1', '4'],
  '⅓': ['1', '3'],
  '⅜': ['3', '8'],
  '½': ['1', '2'],
  '⅝': ['5', '8'],
  '⅔': ['2', '3'],
  '¾': ['3', '4'],
  '⅞': ['7', '8'],
};

/**
 * An amount from formatFraction ("2 ½", "⅓", "12"), set as a number: tabular figures, and the fraction
 * drawn as a small numerator over a fraction slash and denominator instead of the font's ½ ⅓ glyphs,
 * which many fonts lack and would swap in from another font mid-number.
 */
export const Quantity: React.FC<{ value: string; className?: string }> = ({ value, className = '' }) => {
  const match = value.match(/^(\d+)?\s?([⅛¼⅓⅜½⅝⅔¾⅞])$/);
  if (!match) return <span className={`tabular-nums ${className}`}>{value}</span>;
  const [, whole, glyph] = match;
  const [num, den] = VULGAR[glyph];
  return (
    <span className={`tabular-nums whitespace-nowrap ${className}`}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true">
        {whole}
        {whole && ' '}
        <span className="text-[0.62em] tracking-[0.02em]">
          <sup className="text-[1em] leading-none align-[0.5em]">{num}</sup>⁄<span className="leading-none">{den}</span>
        </span>
      </span>
    </span>
  );
};
