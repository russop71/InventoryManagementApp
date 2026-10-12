// Shared units and package conversions for app screens and server reports.
const UNIT_ALIASES                         = {
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

const UNITS                          = {
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

  ea: { family: 'count', toBase: 1, label: 'each' },
  batch: { family: 'count', toBase: 1, label: 'batch' },
};

const FAMILY_UNITS                                                   = {
  volume: ['ml', 'l', 'fl oz', 'cup', 'tbsp', 'tsp', 'gallon'],
  weight: ['mg', 'g', 'kg', 'oz', 'lb'],
  count: ['ea', 'batch'],
};



function cleanUnit(unit           ) {
  return String(unit ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeUnit(unit           ) {
  const cleaned = cleanUnit(unit);
  return UNIT_ALIASES[cleaned] || cleaned;
}

export function getUnitFamily(unit           )             {
  const normalized = normalizeUnit(unit);
  return UNITS[normalized]?.family || 'unknown';
}

export function formatUnitLabel(unit           ) {
  const normalized = normalizeUnit(unit);
  return UNITS[normalized]?.label || normalized;
}

export function getCompatibleUnits(unit           ) {
  const normalized = normalizeUnit(unit);
  if (!normalized) return [];
  const family = getUnitFamily(normalized);
  if (family === 'unknown') {
    return [{ value: normalized, label: formatUnitLabel(normalized) }];
  }

  return FAMILY_UNITS[family].map(value => ({
    value,
    label: formatUnitLabel(value),
  }));
}

export function convertQuantity(quantity        , fromUnit           , toUnit           )                {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (!from || !to) return null;
  if (from === to) return quantity;
  const fromDef = UNITS[from];
  const toDef = UNITS[to];

  if (!fromDef || !toDef) return null;
  if (fromDef.family !== toDef.family) return null;
  if (fromDef.family === 'count') return quantity;

  const inBase = quantity * fromDef.toBase;
  return inBase / toDef.toBase;
}

















function packagedUnitDefinition(item                  ) {
  const mainPurchaseOption = item.purchaseOptions?.find(option => option.isMain) || item.purchaseOptions?.[0];
  let size = Number(item.packSize ?? mainPurchaseOption?.packSize);
  let unit = item.packUnit ?? mainPurchaseOption?.packUnit;
  const packsPerContainer = Math.max(1, Number(mainPurchaseOption?.packsPerCase ?? item.unitsPerPack ?? 1) || 1);
  const innerUnit = String(mainPurchaseOption?.packNickname ?? item.packNickname ?? '').trim();

  // Older bottle records may only carry their capacity in the product name.
  if ((!size || !unit) && normalizeUnit(item.unit) === 'bottle') {
    const namedCapacity = item.name.match(/(\d+(?:\.\d+)?)\s*(ml|l)\b/i);
    if (namedCapacity) {
      size = Number(namedCapacity[1]);
      unit = namedCapacity[2];
    }
  }

  if (!Number.isFinite(size) || size <= 0 || !unit) return null;
  return {
    containerUnit: normalizeUnit(item.unit),
    innerCount: packsPerContainer,
    innerUnit: innerUnit ? normalizeUnit(innerUnit) : null,
    containedQuantityPerInner: size,
    containedUnit: normalizeUnit(unit),
  };
}

/** Units that can be used when an inventory container has a configured inner size. */
export function getIngredientCompatibleUnits(item                  ) {
  const packaged = packagedUnitDefinition(item);
  if (!packaged) return getCompatibleUnits(item.unit);

  const containedOptions = getUnitFamily(packaged.containedUnit) === 'count'
    ? [{ value: packaged.containedUnit, label: formatUnitLabel(packaged.containedUnit) }]
    : getCompatibleUnits(packaged.containedUnit);
  const options = [
    { value: packaged.containerUnit, label: formatUnitLabel(item.unit) },
    ...(packaged.innerUnit && packaged.innerUnit !== packaged.containerUnit && packaged.innerCount > 1
      ? [{ value: packaged.innerUnit, label: formatUnitLabel(packaged.innerUnit) }]
      : []),
    ...containedOptions,
  ];
  return options.filter((option, index) => options.findIndex(candidate => candidate.value === option.value) === index);
}

/** Convert recipe quantities through a package, such as 1 case = 24 each. */
export function convertIngredientQuantity(
  item                  ,
  quantity        ,
  fromUnit        ,
  toUnit        ,
) {
  const direct = convertQuantity(quantity, fromUnit, toUnit);
  if (direct !== null) return direct;

  const packaged = packagedUnitDefinition(item);
  if (!packaged) return null;
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);

  const quantityInContainedUnit = from === packaged.containerUnit
    ? quantity * packaged.innerCount * packaged.containedQuantityPerInner
    : packaged.innerUnit && from === packaged.innerUnit
      ? quantity * packaged.containedQuantityPerInner
      : convertQuantity(quantity, fromUnit, packaged.containedUnit);
  if (quantityInContainedUnit === null) return null;

  if (to === packaged.containerUnit) {
    return quantityInContainedUnit / (packaged.innerCount * packaged.containedQuantityPerInner);
  }
  if (packaged.innerUnit && to === packaged.innerUnit) {
    return quantityInContainedUnit / packaged.containedQuantityPerInner;
  }
  return convertQuantity(quantityInContainedUnit, packaged.containedUnit, toUnit);
}
