// Shared conversion implementation is also used by server-side weekly emails.
export { normalizeUnit, getUnitFamily, formatUnitLabel, getCompatibleUnits, convertQuantity, getIngredientCompatibleUnits, convertIngredientQuantity } from './unitConversionCore.js';

export type UnitFamily = 'volume' | 'weight' | 'count' | 'unknown';

export type PackagedUnitItem = {
  name: string;
  unit: string;
  packSize?: number;
  packUnit?: string;
  unitsPerPack?: number;
  packNickname?: string;
  purchaseOptions?: Array<{
    packSize: number;
    packUnit: string;
    packNickname?: string;
    packsPerCase?: number;
    isMain: boolean;
  }>;
};
