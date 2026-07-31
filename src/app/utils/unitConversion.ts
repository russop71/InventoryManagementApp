export type UnitFamily = 'volume' | 'weight' | 'count' | 'unknown';

type UnitDef = {
  family: Exclude<UnitFamily, 'unknown'>;
  toBase: number;
  label: string;
};

const UNIT_ALIASES: Record<string, string> = {
  l: 'l',
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  'fl oz': 'fl oz',
  floz: 'fl oz',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  gallon: 'gallon',
  gallons: 'gallon',

  mg: 'mg',
  milligram: 'mg',
  milligrams: 'mg',
  g: 'g',
  gr: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',

  ea: 'ea',
  each: 'ea',
  unit: 'ea',
  units: 'ea',
  pc: 'ea',
  pcs: 'ea',
  piece: 'ea',
  pieces: 'ea',
  head: 'ea',
  heads: 'ea',
  batch: 'batch',
};

const UNITS: Record<string, UnitDef> = {
  ml: { family: 'volume', toBase: 1, label: 'mL' },
  l: { family: 'volume', toBase: 1000, label: 'L' },
  'fl oz': { family: 'volume', toBase: 29.5735, label: 'fl oz' },
  cup: { family: 'volume', toBase: 236.588, label: 'cup' },
  tbsp: { family: 'volume', toBase: 14.7868, label: 'tbsp' },
  tsp: { family: 'volume', toBase: 4.92892, label: 'tsp' },
  gallon: { family: 'volume', toBase: 3785.41, label: 'gallon' },

  mg: { family: 'weight', toBase: 0.001, label: 'mg' },
  g: { family: 'weight', toBase: 1, label: 'g' },
  kg: { family: 'weight', toBase: 1000, label: 'kg' },
  oz: { family: 'weight', toBase: 28.3495, label: 'oz' },
  lb: { family: 'weight', toBase: 453.592, label: 'lb' },

  ea: { family: 'count', toBase: 1, label: 'ea' },
  batch: { family: 'count', toBase: 1, label: 'batch' },
};

const FAMILY_UNITS: Record<Exclude<UnitFamily, 'unknown'>, string[]> = {
  volume: ['ml', 'l', 'fl oz', 'cup', 'tbsp', 'tsp', 'gallon'],
  weight: ['mg', 'g', 'kg', 'oz', 'lb'],
  count: ['ea', 'batch'],
};

function cleanUnit(unit: string) {
  return unit.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeUnit(unit: string) {
  const cleaned = cleanUnit(unit);
  return UNIT_ALIASES[cleaned] || cleaned;
}

export function getUnitFamily(unit: string): UnitFamily {
  const normalized = normalizeUnit(unit);
  return UNITS[normalized]?.family || 'unknown';
}

export function formatUnitLabel(unit: string) {
  const normalized = normalizeUnit(unit);
  return UNITS[normalized]?.label || unit;
}

export function getCompatibleUnits(unit: string) {
  const normalized = normalizeUnit(unit);
  const family = getUnitFamily(normalized);
  if (family === 'unknown') {
    return [{ value: normalized, label: formatUnitLabel(normalized) }];
  }

  return FAMILY_UNITS[family].map(value => ({
    value,
    label: formatUnitLabel(value),
  }));
}

export function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  const fromDef = UNITS[from];
  const toDef = UNITS[to];

  if (!fromDef || !toDef) return null;
  if (fromDef.family !== toDef.family) return null;
  if (fromDef.family === 'count') return quantity;

  const inBase = quantity * fromDef.toBase;
  return inBase / toDef.toBase;
}