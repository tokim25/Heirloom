// Utility for scaling recipe ingredient amounts and converting cooking units

export type UnitSystem = 'imperial' | 'metric';

// Common ingredient density map for cup to gram conversions (grams per 1 cup)
const INGREDIENT_DENSITIES: Record<string, number> = {
  flour: 125,
  'all-purpose flour': 125,
  'bread flour': 130,
  'cake flour': 115,
  'whole wheat flour': 120,
  sugar: 200,
  'granulated sugar': 200,
  'brown sugar': 213,
  'powdered sugar': 120,
  'confectioners sugar': 120,
  butter: 227,
  oil: 218,
  'olive oil': 216,
  'vegetable oil': 218,
  water: 240,
  milk: 245,
  cream: 240,
  'heavy cream': 238,
  sour_cream: 240,
  yogurt: 245,
  honey: 340,
  maple_syrup: 322,
  rice: 185,
  oats: 90,
  cocoa: 100,
  'cocoa powder': 100,
  parmesan: 100,
  cheese: 115,
  nuts: 120,
  walnuts: 110,
  almonds: 140,
  salt: 290,
  chocolate_chips: 170,
};

/**
 * Scale an ingredient quantity from originalServings to targetServings
 */
export function scaleQuantity(
  amount: number | null,
  originalServings: number,
  targetServings: number
): number | null {
  if (amount === null || amount === undefined || isNaN(amount)) return null;
  if (!originalServings || originalServings <= 0) return amount;
  const ratio = targetServings / originalServings;
  const scaled = amount * ratio;
  // Round to nearest 2 decimal places
  return Math.round(scaled * 100) / 100;
}

/**
 * Format a number as an elegant culinary fraction
 * e.g. 0.5 -> 1/2, 1.25 -> 1 1/4, 2.33 -> 2 1/3
 */
export function formatFraction(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '';
  if (val === 0) return '0';

  const whole = Math.floor(val);
  const frac = val - whole;

  // Tolerances for common culinary fractions
  const fractionMap: { frac: number; text: string }[] = [
    { frac: 0.125, text: '⅛' },
    { frac: 0.25, text: '¼' },
    { frac: 0.333, text: '⅓' },
    { frac: 0.375, text: '⅜' },
    { frac: 0.5, text: '½' },
    { frac: 0.625, text: '⅝' },
    { frac: 0.667, text: '⅔' },
    { frac: 0.75, text: '¾' },
    { frac: 0.875, text: '⅞' },
  ];

  for (const { frac: target, text } of fractionMap) {
    if (Math.abs(frac - target) < 0.05) {
      return whole > 0 ? `${whole} ${text}` : text;
    }
  }

  // If very close to next whole number
  if (Math.abs(frac - 1.0) < 0.05) {
    return `${whole + 1}`;
  }
  // If very close to 0
  if (frac < 0.05) {
    return `${whole}`;
  }

  // Otherwise, format cleanly as 1 or 2 decimals
  return Number(val.toFixed(1)) === val ? val.toFixed(1) : val.toFixed(2);
}

/**
 * Convert quantity and unit between Imperial and Metric
 */
export function convertUnit(
  amount: number | null,
  unit: string,
  ingredientName: string,
  targetSystem: UnitSystem
): { amount: number | null; unit: string } {
  if (amount === null || isNaN(amount)) return { amount, unit };
  const u = (unit || '').trim().toLowerCase();
  const name = ingredientName.toLowerCase();

  // Find density if cup -> gram
  let density = 200; // default medium density
  for (const [key, val] of Object.entries(INGREDIENT_DENSITIES)) {
    if (name.includes(key)) {
      density = val;
      break;
    }
  }

  if (targetSystem === 'metric') {
    // Imperial to Metric conversions
    if (u === 'cup' || u === 'cups' || u === 'c') {
      const grams = Math.round(amount * density);
      return { amount: grams, unit: 'g' };
    }
    if (u === 'tbsp' || u === 'tablespoon' || u === 'tablespoons') {
      const ml = Math.round(amount * 15);
      return { amount: ml, unit: 'ml' };
    }
    if (u === 'tsp' || u === 'teaspoon' || u === 'teaspoons') {
      const ml = Math.round(amount * 5 * 10) / 10;
      return { amount: ml, unit: 'ml' };
    }
    if (u === 'oz' || u === 'ounce' || u === 'ounces') {
      const grams = Math.round(amount * 28.35);
      return { amount: grams, unit: 'g' };
    }
    if (u === 'fl oz' || u === 'fluid ounce' || u === 'fluid ounces') {
      const ml = Math.round(amount * 29.57);
      return { amount: ml, unit: 'ml' };
    }
    if (u === 'lb' || u === 'lbs' || u === 'pound' || u === 'pounds') {
      const grams = amount * 453.6;
      if (grams >= 1000) {
        return { amount: Math.round((grams / 1000) * 100) / 100, unit: 'kg' };
      }
      return { amount: Math.round(grams), unit: 'g' };
    }
    if (u === 'pinch' || u === 'dash') {
      return { amount, unit: u };
    }
  } else {
    // Metric to Imperial conversions
    if (u === 'g' || u === 'gram' || u === 'grams') {
      if (amount >= 450) {
        return { amount: Math.round((amount / 453.6) * 100) / 100, unit: 'lb' };
      }
      const cups = amount / density;
      if (cups >= 0.25) {
        return { amount: Math.round(cups * 4) / 4, unit: 'cups' };
      }
      return { amount: Math.round((amount / 28.35) * 10) / 10, unit: 'oz' };
    }
    if (u === 'kg' || u === 'kilogram' || u === 'kilograms') {
      return { amount: Math.round(amount * 2.20462 * 10) / 10, unit: 'lb' };
    }
    if (u === 'ml' || u === 'milliliter' || u === 'milliliters') {
      if (amount >= 240) {
        return { amount: Math.round((amount / 240) * 4) / 4, unit: 'cups' };
      }
      if (amount >= 15) {
        return { amount: Math.round((amount / 15) * 2) / 2, unit: 'tbsp' };
      }
      return { amount: Math.round((amount / 5) * 2) / 2, unit: 'tsp' };
    }
    if (u === 'l' || u === 'liter' || u === 'liters') {
      return { amount: Math.round((amount * 1000) / 240 * 10) / 10, unit: 'cups' };
    }
  }

  // Fallback to original
  return { amount, unit };
}

/**
 * Convert temperature between Fahrenheit and Celsius
 */
export function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}

export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

/**
 * Parse and convert temperatures embedded in recipe step text
 * e.g., "Bake at 375°F for 20 minutes" -> returns equivalent with °C
 */
export function formatStepTemperatures(text: string, unitSystem: UnitSystem): string {
  if (unitSystem === 'metric') {
    // Convert 350°F or 350 F or 350 degrees F to Celsius
    return text.replace(/(\d{3})\s*(?:°\s*F|F\b|degrees\s*F)/gi, (match, tempStr) => {
      const f = parseInt(tempStr, 10);
      const c = fahrenheitToCelsius(f);
      return `${c}°C (${f}°F)`;
    });
  } else {
    // Convert 180°C or 180 C to Fahrenheit
    return text.replace(/(\d{2,3})\s*(?:°\s*C|C\b|degrees\s*C)/gi, (match, tempStr) => {
      const c = parseInt(tempStr, 10);
      const f = celsiusToFahrenheit(c);
      return `${f}°F (${c}°C)`;
    });
  }
}
