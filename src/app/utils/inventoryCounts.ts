import type { InventoryItem } from '../contexts/InventoryContext';

export type InventoryCountStatus = 'in-stock' | 'low-stock' | 'out-of-stock';

export interface InventoryCountEntry {
  itemId: string;
  name: string;
  hypothetical: number;
  sales: number;
  counted: number;
  parLevel: number;
  unit: string;
  unitOptions?: string[];
  unitCost: number;
  value: number;
  status: InventoryCountStatus;
}

export interface InventoryCount {
  id: string;
  countDate: string;
  description: string;
  locked: string;
  countType?: 'day-end' | 'day-start';
  entries: InventoryCountEntry[];
  value: number;
}

function getInventoryStatus(current: number, par: number): InventoryCountStatus {
  if (current <= 0) return 'out-of-stock';
  if (current < par * 0.5) return 'low-stock';
  return 'in-stock';
}

export function buildCountEntries(items: InventoryItem[]): InventoryCountEntry[] {
  return items.map(item => {
    const counted = Number(item.currentStock) || 0;
    const unitCost = Number(item.unitCost) || 0;
    const value = counted * unitCost;
    return {
      itemId: item.id,
      name: item.name,
      hypothetical: counted,
      sales: 0,
      counted,
      parLevel: Number(item.parLevel) || 0,
      unit: item.unit || 'ea',
      unitOptions: [item.unit || 'ea'],
      unitCost,
      value,
      status: getInventoryStatus(counted, Number(item.parLevel) || 0),
    };
  });
}

export function createInventoryCount(items: InventoryItem[], overrides: Partial<InventoryCount> = {}): InventoryCount {
  const entries = buildCountEntries(items);
  const value = entries.reduce((sum, entry) => sum + entry.value, 0);
  return {
    id: overrides.id ?? `count-${Date.now()}`,
    countDate: overrides.countDate ?? new Date().toISOString().slice(0, 10),
    description: overrides.description ?? 'Live inventory count',
    locked: overrides.locked ?? 'Yes',
    countType: overrides.countType === 'day-start' ? 'day-start' : 'day-end',
    entries,
    value,
  };
}
