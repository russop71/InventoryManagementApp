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
  storageArea?: string;
  category?: string;
  supplier?: string;
  shelfOrder?: number;
  previousCounted?: number;
  isCounted?: boolean;
}

export interface InventoryCount {
  id: string;
  countDate: string;
  description: string;
  locked: string;
  countType?: 'day-end' | 'day-start';
  status?: 'draft' | 'finalized';
  createdAt?: string;
  updatedAt?: string;
  finalizedAt?: string;
  finalizedBy?: string;
  finalizedByRole?: string;
  previousCountId?: string;
  storageAreaOrder?: string[];
  entries: InventoryCountEntry[];
  value: number;
}

function getInventoryStatus(current: number, par: number): InventoryCountStatus {
  if (current <= 0) return 'out-of-stock';
  if (current < par * 0.5) return 'low-stock';
  return 'in-stock';
}

export function buildCountEntries(items: InventoryItem[], previousCount?: InventoryCount | null): InventoryCountEntry[] {
  const previousEntries = new Map(previousCount?.entries.map(entry => [entry.itemId, entry]) || []);
  return items.map((item, index) => {
    const hypothetical = Number(item.currentStock) || 0;
    const unitCost = Number(item.unitCost) || 0;
    const previousEntry = previousEntries.get(item.id);
    return {
      itemId: item.id,
      name: item.name,
      hypothetical,
      sales: 0,
      counted: 0,
      parLevel: Number(item.parLevel) || 0,
      unit: item.unit || 'ea',
      unitOptions: [item.unit || 'ea'],
      unitCost,
      value: 0,
      status: getInventoryStatus(hypothetical, Number(item.parLevel) || 0),
      storageArea: item.storageArea?.trim() || 'Unassigned',
      category: item.category || 'Other',
      supplier: item.supplier || 'Unknown',
      shelfOrder: item.countOrder ?? previousEntry?.shelfOrder ?? index,
      previousCounted: previousEntry?.counted ?? hypothetical,
      isCounted: false,
    };
  });
}

export function createInventoryCount(items: InventoryItem[], overrides: Partial<InventoryCount> = {}, previousCount?: InventoryCount | null): InventoryCount {
  const entries = overrides.entries || buildCountEntries(items, previousCount);
  const value = entries.reduce((sum, entry) => sum + entry.value, 0);
  const now = new Date().toISOString();
  const status = overrides.status === 'finalized' ? 'finalized' : 'draft';
  const inferredAreas = Array.from(new Set(entries.map(entry => entry.storageArea || 'Unassigned')));
  return {
    id: overrides.id ?? `count-${Date.now()}`,
    countDate: overrides.countDate ?? new Date().toISOString().slice(0, 10),
    description: overrides.description ?? 'Live inventory count',
    locked: status === 'finalized' ? 'Yes' : 'No',
    countType: overrides.countType === 'day-start' ? 'day-start' : 'day-end',
    status,
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    finalizedAt: overrides.finalizedAt,
    finalizedBy: overrides.finalizedBy,
    finalizedByRole: overrides.finalizedByRole,
    previousCountId: overrides.previousCountId || previousCount?.id,
    storageAreaOrder: overrides.storageAreaOrder?.length ? overrides.storageAreaOrder : inferredAreas,
    entries,
    value: overrides.value ?? value,
  };
}
