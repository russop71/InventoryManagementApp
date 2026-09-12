import { buildDemoSales } from './demoSales';
import { convertIngredientQuantity } from './unitConversion';
import type { DemoLocationData } from './demoData';
import type { InventoryCount } from './inventoryCounts';

export function buildDemoUsageData(data: DemoLocationData, anchor = new Date()) {
  const date = (offset: number) => new Date(anchor.getTime() - offset * 86400000).toISOString().slice(0, 10);
  const sales = buildDemoSales(data.recipes.map(recipe => ({ name: recipe.menuItemName, price: recipe.price })), anchor);
  const counts: InventoryCount[] = [];
  const invoices = [...data.invoices];
  let closing = data.inventory.map(item => item.currentStock);
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  const makeCount = (offset: number, quantities: number[]) => {
    const entries = data.inventory.map((item, index) => ({
      entryId: `${item.id}::${item.storageArea}`, itemId: item.id, name: item.name,
      hypothetical: quantities[index], counted: quantities[index], sales: 0, isCounted: true,
      parLevel: item.parLevel, unit: item.unit, unitCost: item.unitCost,
      value: round(quantities[index] * item.unitCost), status: 'in-stock' as const,
      storageArea: item.storageArea, category: item.category, supplier: item.supplier,
    }));
    return { id: `demo-usage-count-${offset}`, countDate: date(offset), description: `Demo sample · ${offset === 0 ? 'closing' : `${offset} days ago`}`,
      locked: 'Yes', status: 'finalized' as const, countType: 'day-end' as const,
      finalizedAt: `${date(offset)}T23:59:59.000Z`, finalizedBy: 'Demo Owner', finalizedByRole: 'Owner',
      entries, value: round(entries.reduce((sum, entry) => sum + entry.value, 0)) };
  };
  counts.push(makeCount(0, closing));
  for (const offset of [7, 14]) {
    const periodSales = sales.filter(day => day.date > date(offset) && day.date <= date(offset - 7));
    const deliveries = new Map<string, Array<{ itemId: string; quantity: number; cost: number }>>();
    const opening = data.inventory.map((item, index) => {
      let theoretical = 0;
      for (const recipe of data.recipes) {
        const sold = periodSales.flatMap(day => day.topItems).filter(sale => sale.itemName === recipe.menuItemName).reduce((sum, sale) => sum + sale.quantity, 0);
        for (const ingredient of recipe.ingredients.filter(line => line.inventoryItemId === item.id)) {
          const converted = convertIngredientQuantity(item, ingredient.quantity, ingredient.unit, item.unit);
          if (converted === null) throw new Error(`Demo unit conversion missing: ${item.name}`);
          theoretical += sold * converted;
        }
      }
      const actual = round(theoretical * (1 + [0, 0.03, -0.02, 0.06][index % 4]));
      const existingReceipts = invoices.filter(invoice => invoice.status === 'received' && String(invoice.date) > date(offset) && String(invoice.date) <= date(offset - 7))
        .flatMap(invoice => invoice.items as Array<{ itemId: string; quantity: number }>).filter(line => line.itemId === item.id).reduce((sum, line) => sum + line.quantity, 0);
      const receipt = Math.max(0, Math.floor(actual * 0.75 - existingReceipts));
      if (receipt) {
        const lines = deliveries.get(item.supplier) || [];
        lines.push({ itemId: item.id, quantity: receipt, cost: Math.round(receipt * item.unitCost * 100) / 100 });
        deliveries.set(item.supplier, lines);
      }
      return round(closing[index] + actual - existingReceipts - receipt);
    });
    for (const [supplier, items] of deliveries) {
      const id = `demo-usage-invoice-${offset}-${invoices.length}`;
      invoices.push({ id, invoiceNumber: `DEMO-USAGE-${offset}-${invoices.length}`, date: date(offset - 2), supplier, items,
        totalAmount: Math.round(items.reduce((sum, line) => sum + line.cost, 0) * 100) / 100, status: 'received' });
    }
    counts.push(makeCount(offset, opening));
    closing = opening;
  }
  return { inventoryCounts: counts.reverse(), invoices };
}
