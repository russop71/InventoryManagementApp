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

const INVENTORY_COUNTS_KEY = 'inventory-counts-v1';

function getInventoryStatus(current: number, par: number): InventoryCountStatus {
  if (current <= 0) return 'out-of-stock';
  if (current < par * 0.5) return 'low-stock';
  return 'in-stock';
}

export function loadInventoryCounts(): InventoryCount[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(INVENTORY_COUNTS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as InventoryCount[];
    if (!Array.isArray(parsed)) return [];

    return parsed.map(count => ({
      ...count,
      countDate: count.countDate === 'Current inventory count' ? 'Live inventory count' : count.countDate,
      description: count.description === 'Current inventory count' ? 'Live inventory count' : count.description,
      countType: count.countType === 'day-start' ? 'day-start' : 'day-end',
      entries: (count.entries || []).map(entry => ({
        ...entry,
        hypothetical: typeof entry.hypothetical === 'number' ? entry.hypothetical : entry.counted,
        sales: typeof entry.sales === 'number' ? entry.sales : 0,
        unitOptions: Array.isArray(entry.unitOptions) && entry.unitOptions.length > 0 ? entry.unitOptions.slice(0, 4) : [entry.unit],
      })),
    }));
  } catch {
    return [];
  }
}

export function saveInventoryCounts(counts: InventoryCount[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(INVENTORY_COUNTS_KEY, JSON.stringify(counts));
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
