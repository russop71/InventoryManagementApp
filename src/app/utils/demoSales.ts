/** Shared deterministic sales fixture for POS reports and demo stock reconciliation. */
export function buildDemoSales(items: Array<{ name: string; price: number }>, anchor = new Date()) {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - (29 - index));
    const day = date.getUTCDay();
    const factor = day === 5 || day === 6 ? 1.35 : day === 0 ? 1.18 : 0.94;
    const topItems = items.map((item, itemIndex) => {
      const mix = Math.max(0.58, 1.32 - itemIndex * 0.045);
      const quantity = Math.max(1, Math.round((16 + ((index * 11 + itemIndex * 7) % 34)) * factor * mix));
      return { itemName: item.name, quantity, revenue: quantity * Math.max(item.price, 1) };
    }).sort((a, b) => b.revenue - a.revenue);
    const revenue = topItems.reduce((sum, item) => sum + item.revenue, 0);
    return { date: date.toISOString().slice(0, 10), covers: Math.max(1, Math.round(revenue / 42)), revenue, topItems };
  });
}
