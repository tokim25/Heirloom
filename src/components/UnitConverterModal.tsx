import React, { useState } from 'react';
import {
  X,
  Calculator,
  Flame,
  Scale,
  ArrowRightLeft,
  Info,
  BookOpen,
} from 'lucide-react';
import { fahrenheitToCelsius, celsiusToFahrenheit } from '../utils/units.ts';

interface UnitConverterModalProps {
  onClose: () => void;
}

const INGREDIENTS = [
  { name: 'All-Purpose Flour', density: 125, desc: '1 cup = 125g' },
  { name: 'Granulated Sugar', density: 200, desc: '1 cup = 200g' },
  { name: 'Brown Sugar (packed)', density: 213, desc: '1 cup = 213g' },
  { name: 'Powdered Sugar', density: 120, desc: '1 cup = 120g' },
  { name: 'Butter', density: 227, desc: '1 cup (2 sticks) = 227g' },
  { name: 'Olive / Vegetable Oil', density: 216, desc: '1 cup = 216g' },
  { name: 'Rolled Oats', density: 90, desc: '1 cup = 90g' },
  { name: 'Honey / Maple Syrup', density: 330, desc: '1 cup = 330g' },
  { name: 'Cocoa Powder', density: 100, desc: '1 cup = 100g' },
  { name: 'Diamond Crystal Kosher Salt', density: 140, desc: '1 cup = 140g' },
  { name: 'Fine Table Salt', density: 290, desc: '1 cup = 290g' },
];

export const UnitConverterModal: React.FC<UnitConverterModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'cupsToGrams' | 'temperature' | 'liquids' | 'weights'>('cupsToGrams');

  // Cups to grams state
  const [cupsInput, setCupsInput] = useState<string>('1');
  const [selectedIngredient, setSelectedIngredient] = useState(INGREDIENTS[0]);

  // Temperature state
  const [tempF, setTempF] = useState<number>(350);
  const [tempC, setTempC] = useState<number>(177);

  // Volume state
  const [tbspInput, setTbspInput] = useState<string>('1');

  // Weight state
  const [ozInput, setOzInput] = useState<string>('8');

  const calculatedGrams = () => {
    const val = parseFloat(cupsInput);
    if (isNaN(val)) return 0;
    return Math.round(val * selectedIngredient.density);
  };

  const handleFahrenheitChange = (val: number) => {
    setTempF(val);
    setTempC(fahrenheitToCelsius(val));
  };

  const handleCelsiusChange = (val: number) => {
    setTempC(val);
    setTempF(celsiusToFahrenheit(val));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-[#FAF9F5] rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500 text-stone-950">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                Kitchen Tool
              </span>
              <h2 className="font-serif text-2xl text-stone-900">
                Culinary Unit Converter
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-stone-200 text-stone-500 hover:text-stone-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-stone-200 bg-stone-100/70 p-1.5 gap-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('cupsToGrams')}
            className={`flex-1 py-2 rounded-xl text-center transition-all ${
              activeTab === 'cupsToGrams'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Cups ⇄ Grams
          </button>
          <button
            onClick={() => setActiveTab('temperature')}
            className={`flex-1 py-2 rounded-xl text-center transition-all ${
              activeTab === 'temperature'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            °F ⇄ °C Temp
          </button>
          <button
            onClick={() => setActiveTab('liquids')}
            className={`flex-1 py-2 rounded-xl text-center transition-all ${
              activeTab === 'liquids'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Spoons ⇄ mL
          </button>
          <button
            onClick={() => setActiveTab('weights')}
            className={`flex-1 py-2 rounded-xl text-center transition-all ${
              activeTab === 'weights'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Oz / Lb ⇄ Grams
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-6">
          {/* Cups to Grams Converter */}
          {activeTab === 'cupsToGrams' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block mb-1">
                  Ingredient (Density varies by food)
                </label>
                <select
                  value={selectedIngredient.name}
                  onChange={(e) => {
                    const found = INGREDIENTS.find((i) => i.name === e.target.value);
                    if (found) setSelectedIngredient(found);
                  }}
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-900 focus:outline-none"
                >
                  {INGREDIENTS.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.desc})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="bg-white p-4 rounded-2xl border border-stone-200">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Volume in Cups
                  </span>
                  <input
                    type="number"
                    step="0.125"
                    value={cupsInput}
                    onChange={(e) => setCupsInput(e.target.value)}
                    className="w-full text-2xl font-serif text-stone-900 font-medium bg-transparent focus:outline-none mt-1"
                  />
                  <div className="flex gap-1.5 mt-2">
                    {['0.25', '0.5', '1', '1.5', '2'].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setCupsInput(q)}
                        className="px-2 py-0.5 rounded-md bg-stone-100 text-[10px] text-stone-700 hover:bg-stone-200"
                      >
                        {q}c
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-amber-950">
                  <span className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider">
                    Weight in Grams
                  </span>
                  <p className="text-3xl font-serif font-bold text-amber-950 mt-1">
                    {calculatedGrams()} g
                  </p>
                  <span className="text-[11px] text-amber-800 mt-2 block">
                    Exact weight for {selectedIngredient.name}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Temperature Converter */}
          {activeTab === 'temperature' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-stone-200 flex flex-col">
                  <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    Fahrenheit (°F)
                  </span>
                  <input
                    type="number"
                    value={tempF}
                    onChange={(e) => handleFahrenheitChange(Number(e.target.value))}
                    className="text-3xl font-serif text-stone-900 font-medium bg-transparent focus:outline-none mt-1"
                  />
                  <span className="text-[11px] text-stone-400 mt-2">
                    Standard US Oven
                  </span>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex flex-col text-amber-950">
                  <span className="text-xs font-semibold text-amber-900 uppercase tracking-wider">
                    Celsius (°C)
                  </span>
                  <input
                    type="number"
                    value={tempC}
                    onChange={(e) => handleCelsiusChange(Number(e.target.value))}
                    className="text-3xl font-serif text-amber-950 font-bold bg-transparent focus:outline-none mt-1"
                  />
                  <span className="text-[11px] text-amber-800 mt-2">
                    European / Metric Oven
                  </span>
                </div>
              </div>

              {/* Quick Oven Preset Pills */}
              <div>
                <span className="text-xs font-semibold text-stone-600 block mb-2">
                  Common Baking Temperatures:
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { f: 300, name: 'Slow & Low (150°C)' },
                    { f: 350, name: 'Standard Bake (175°C)' },
                    { f: 375, name: 'Golden Roast (190°C)' },
                    { f: 400, name: 'High Heat (200°C)' },
                    { f: 425, name: 'Crisp Crust (220°C)' },
                    { f: 450, name: 'Pizza / Bread (230°C)' },
                  ].map((preset) => (
                    <button
                      key={preset.f}
                      type="button"
                      onClick={() => handleFahrenheitChange(preset.f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        tempF === preset.f
                          ? 'bg-amber-500 text-stone-950 border-amber-600 font-bold'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {preset.f}°F — {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Liquid Volume Converter */}
          {activeTab === 'liquids' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-2xl border border-stone-200">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Tablespoons (tbsp)
                </span>
                <input
                  type="number"
                  step="0.5"
                  value={tbspInput}
                  onChange={(e) => setTbspInput(e.target.value)}
                  className="w-full text-2xl font-serif text-stone-900 font-medium bg-transparent focus:outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-stone-100 rounded-xl">
                  <span className="text-stone-500 font-medium">Milliliters (mL):</span>
                  <p className="text-lg font-bold text-stone-900 mt-0.5">
                    {Math.round((parseFloat(tbspInput) || 0) * 15 * 10) / 10} mL
                  </p>
                </div>
                <div className="p-3 bg-stone-100 rounded-xl">
                  <span className="text-stone-500 font-medium">Teaspoons (tsp):</span>
                  <p className="text-lg font-bold text-stone-900 mt-0.5">
                    {(parseFloat(tbspInput) || 0) * 3} tsp
                  </p>
                </div>
                <div className="p-3 bg-stone-100 rounded-xl">
                  <span className="text-stone-500 font-medium">Fluid Ounces (fl oz):</span>
                  <p className="text-lg font-bold text-stone-900 mt-0.5">
                    {Math.round((parseFloat(tbspInput) || 0) * 0.5 * 10) / 10} fl oz
                  </p>
                </div>
                <div className="p-3 bg-stone-100 rounded-xl">
                  <span className="text-stone-500 font-medium">Cups:</span>
                  <p className="text-lg font-bold text-stone-900 mt-0.5">
                    {Math.round(((parseFloat(tbspInput) || 0) / 16) * 100) / 100} cups
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Weight Converter */}
          {activeTab === 'weights' && (
            <div className="flex flex-col gap-4">
              <div className="bg-white p-4 rounded-2xl border border-stone-200">
                <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  Weight in Ounces (oz)
                </span>
                <input
                  type="number"
                  step="0.5"
                  value={ozInput}
                  onChange={(e) => setOzInput(e.target.value)}
                  className="w-full text-2xl font-serif text-stone-900 font-medium bg-transparent focus:outline-none mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-950">
                  <span className="text-amber-800 font-semibold">Grams (g):</span>
                  <p className="text-xl font-serif font-bold text-amber-950 mt-0.5">
                    {Math.round((parseFloat(ozInput) || 0) * 28.3495)} g
                  </p>
                </div>
                <div className="p-3 bg-stone-100 rounded-xl">
                  <span className="text-stone-500 font-medium">Pounds (lb):</span>
                  <p className="text-xl font-serif font-bold text-stone-900 mt-0.5">
                    {Math.round(((parseFloat(ozInput) || 0) / 16) * 100) / 100} lb
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-100/70 border-t border-stone-200/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
