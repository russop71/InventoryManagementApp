import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiRequest } from '../utils/api';
import { locationScopedStorageKey, readScopedJson } from '../utils/storageScope';
import { useInventory } from './InventoryContext';
import { convertQuantity } from '../utils/unitConversion';

export interface WasteEntry {
  id: string; itemId: string; itemName: string; category: string; quantity: number; unit: string;
  inventoryQuantity: number; inventoryUnit: string; unitCost: number; totalCost: number; reason: string;
  notes: string; employeeName: string; loggedBy: string; occurredAt: string; createdAt: string;
}

type WasteInput = Pick<WasteEntry, 'itemId' | 'quantity' | 'unit' | 'reason' | 'notes' | 'employeeName' | 'occurredAt'>;
interface WasteContextValue { entries: WasteEntry[]; isWasteLoaded: boolean; recordWaste: (input: WasteInput) => Promise<WasteEntry>; }
const WasteContext = createContext<WasteContextValue | undefined>(undefined);

function demoWaste(): WasteEntry[] {
  const today = new Date();
  const at = (days: number, hour: number) => { const date = new Date(today); date.setDate(date.getDate() - days); date.setHours(hour, 0, 0, 0); return date.toISOString(); };
  return [
    { id: 'demo-waste-1', itemId: 'demo-arugula', itemName: 'Baby Arugula', category: 'Produce', quantity: 0.6, unit: 'lb', inventoryQuantity: 0.6, inventoryUnit: 'lb', unitCost: 7.2, totalCost: 4.32, reason: 'Spoilage', notes: 'Wilted during line check', employeeName: 'Maya Chen', loggedBy: 'Demo', occurredAt: at(0, 10), createdAt: at(0, 10) },
    { id: 'demo-waste-2', itemId: 'demo-brioche', itemName: 'Brioche Buns', category: 'Bakery', quantity: 4, unit: 'each', inventoryQuantity: 4, inventoryUnit: 'each', unitCost: 0.82, totalCost: 3.28, reason: 'Overproduction', notes: 'End of brunch service', employeeName: 'Luca Romano', loggedBy: 'Demo', occurredAt: at(1, 16), createdAt: at(1, 16) },
    { id: 'demo-waste-3', itemId: 'demo-lime', itemName: 'Fresh Lime', category: 'Produce', quantity: 3, unit: 'each', inventoryQuantity: 3, inventoryUnit: 'each', unitCost: 0.64, totalCost: 1.92, reason: 'Quality issue', notes: 'Damaged delivery pieces', employeeName: 'Noah Williams', loggedBy: 'Demo', occurredAt: at(2, 18), createdAt: at(2, 18) },
  ];
}

export function WasteProvider({ children }: { children: ReactNode }) {
  const { accountId, activeLocationId, token, user } = useAuth();
  const { inventory, updateInventoryItem } = useInventory();
  const isDemoAccount = user?.email?.trim().toLowerCase() === 'demo@zestiq.com';
  const [entries, setEntries] = useState<WasteEntry[]>([]);
  const [isWasteLoaded, setIsWasteLoaded] = useState(false);
  const storageKey = accountId && activeLocationId ? locationScopedStorageKey(accountId, activeLocationId, 'waste-v1') : null;

  useEffect(() => {
    if (!accountId || !activeLocationId) { setEntries([]); setIsWasteLoaded(true); return; }
    setIsWasteLoaded(false);
    const local = readScopedJson<WasteEntry[]>(storageKey, []);
    const demo = isDemoAccount ? demoWaste() : [];
    if (isDemoAccount) {
      const next = local.length ? local : demo;
      setEntries(next);
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      setIsWasteLoaded(true);
      return;
    }
    if (!token) { setEntries(local.length ? local : demo); setIsWasteLoaded(true); return; }
    void apiRequest<{ entries: WasteEntry[] }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/waste`)
      .then(remote => {
        const next = remote.entries?.length ? remote.entries : local;
        setEntries(next); if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
      }).catch(() => setEntries(local.length ? local : demo)).finally(() => setIsWasteLoaded(true));
  }, [accountId, activeLocationId, token, isDemoAccount, storageKey]);

  const value = useMemo<WasteContextValue>(() => ({
    entries, isWasteLoaded,
    recordWaste: async input => {
      if (!accountId || !activeLocationId) throw new Error('Choose a restaurant location before logging waste');
      if (isDemoAccount) {
        const item = inventory.find(candidate => candidate.id === input.itemId);
        if (!item) throw new Error('Choose an inventory item before logging waste');
        const inventoryQuantity = convertQuantity(Number(input.quantity), input.unit, item.unit) ?? Number(input.quantity);
        const entry: WasteEntry = {
          id: `demo-waste-${Date.now()}`,
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          quantity: Number(input.quantity),
          unit: input.unit,
          inventoryQuantity,
          inventoryUnit: item.unit,
          unitCost: item.unitCost,
          totalCost: inventoryQuantity * item.unitCost,
          reason: input.reason,
          notes: input.notes,
          employeeName: input.employeeName,
          loggedBy: user?.name || 'Demo',
          occurredAt: input.occurredAt,
          createdAt: new Date().toISOString(),
        };
        const next = [entry, ...entries];
        setEntries(next);
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
        updateInventoryItem(item.id, { currentStock: Math.max(0, item.currentStock - inventoryQuantity) });
        return entry;
      }
      const response = await apiRequest<{ waste: { entries: WasteEntry[] }; entry: WasteEntry }>(`/api/v1/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(activeLocationId)}/waste`, { method: 'POST', body: JSON.stringify(input) });
      setEntries(() => {
        const next = response.waste.entries;
        if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      return response.entry;
    },
  }), [entries, isWasteLoaded, accountId, activeLocationId, storageKey, user?.name, isDemoAccount, inventory, updateInventoryItem]);
  return <WasteContext.Provider value={value}>{children}</WasteContext.Provider>;
}

export function useWaste() { const context = useContext(WasteContext); if (!context) throw new Error('useWaste must be used within WasteProvider'); return context; }
