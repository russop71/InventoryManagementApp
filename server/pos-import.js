const FIELD_NAMES = {
  item: ['Menu item name', 'Menu item', 'Menu Item', 'Item', 'Item Name', 'Product', 'Product Name', 'Description', 'name', 'itemName'],
  quantity: ['Qty sold', 'Qty Sold', 'Quantity Sold', 'Items Sold', 'Net Quantity', 'Units Sold', 'Qty', 'quantity', 'qtySold'],
  revenue: ['Total sales', 'Total Sales', 'Gross Sales', 'Net Sales', 'Sales', 'Amount', 'revenue', 'totalSales', 'amount'],
  category: ['Category', 'Menu Category', 'Sales Category', 'Department', 'category'],
  price: ['Price', 'Unit Price', 'Menu Price', 'Average Price', 'price'],
  date: ['Date', 'Business Date', 'Order Date', 'Sale Date', 'Transaction Date', 'date', 'period', 'timestamp'],
  covers: ['Covers', 'Guests', 'Guest Count', 'Customers', 'covers'],
};

function firstValue(row, names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row[name] !== null && String(row[name]).trim() !== '') return row[name];
  }
  const normalizedNames = new Set(names.map(name => name.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const matchingKey = Object.keys(row || {}).find(key => normalizedNames.has(key.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return matchingKey ? row[matchingKey] : undefined;
}

function numberValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().split('T')[0];
}

function htmlRows(html) {
  const rows = [];
  for (const match of String(html || '').matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)) {
    const values = [];
    for (const cell of String(match[1] || '').matchAll(/<(th|td)[^>]*>(.*?)<\/\1>/gis)) {
      values.push(String(cell[2] || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim());
    }
    if (values.length) rows.push(values);
  }
  const [headers = [], ...body] = rows;
  return body.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function normalizeRows(rows, payload) {
  const fallbackDate = dateValue(payload.date || payload.period || payload.timestamp, new Date().toISOString().split('T')[0]);
  const days = new Map();
  const menuMap = new Map();

  for (const row of rows) {
    const itemName = String(firstValue(row, FIELD_NAMES.item) || '').trim();
    const quantity = numberValue(firstValue(row, FIELD_NAMES.quantity));
    if (!itemName || quantity <= 0) continue;
    const revenue = numberValue(firstValue(row, FIELD_NAMES.revenue));
    const price = numberValue(firstValue(row, FIELD_NAMES.price)) || (quantity > 0 ? revenue / quantity : 0);
    const category = String(firstValue(row, FIELD_NAMES.category) || 'Unknown').trim() || 'Unknown';
    const date = dateValue(firstValue(row, FIELD_NAMES.date), fallbackDate);
    const covers = numberValue(firstValue(row, FIELD_NAMES.covers));
    const day = days.get(date) || { date, covers: 0, revenue: 0, topItems: new Map() };
    const prior = day.topItems.get(itemName) || { itemName, quantity: 0, revenue: 0 };
    prior.quantity += quantity; prior.revenue += revenue;
    day.topItems.set(itemName, prior); day.revenue += revenue; day.covers += covers;
    days.set(date, day);
    if (!menuMap.has(itemName)) menuMap.set(itemName, { id: `derived-${menuMap.size + 1}`, name: itemName, category, price, ingredients: [] });
  }

  return {
    salesData: [...days.values()].map(day => ({
      date: day.date,
      covers: day.covers,
      revenue: day.revenue,
      topItems: [...day.topItems.values()].sort((left, right) => right.revenue - left.revenue),
    })).sort((left, right) => left.date.localeCompare(right.date)),
    menuItems: [...menuMap.values()],
  };
}

function normalizePosImportPayload(payload = {}) {
  const rawSalesData = Array.isArray(payload.salesData) ? payload.salesData : Array.isArray(payload.history) ? payload.history : [];
  const normalizedSalesData = rawSalesData.map(day => ({
    date: dateValue(day.date || day.period || day.timestamp, ''),
    covers: numberValue(day.covers),
    revenue: numberValue(day.revenue),
    topItems: Array.isArray(day.topItems) ? day.topItems.map(item => ({
      itemName: String(item.itemName || item.name || 'Unknown item'),
      quantity: numberValue(item.quantity),
      revenue: numberValue(item.revenue),
    })).filter(item => item.quantity > 0) : [],
  })).filter(day => day.date && (day.revenue !== 0 || day.topItems.length > 0));

  const rows = Array.isArray(payload.rows)
    ? payload.rows
    : Array.isArray(payload.marketmanReport)
      ? payload.marketmanReport
      : payload.html
        ? htmlRows(payload.html)
        : [];
  const rowData = normalizeRows(rows, payload);
  const combinedSales = [...normalizedSalesData, ...rowData.salesData];

  const menuItems = Array.isArray(payload.menuItems) ? payload.menuItems.map((item, index) => ({
    id: item.id || item.name || `menu-${index + 1}`,
    name: item.name || item.itemName || 'Unnamed item',
    category: item.category || 'Unknown',
    price: numberValue(item.price),
    ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
  })) : rowData.menuItems;

  if (!menuItems.length) {
    const names = new Set();
    combinedSales.forEach(day => day.topItems.forEach(item => item.itemName && names.add(item.itemName)));
    [...names].forEach((name, index) => menuItems.push({ id: `derived-${index + 1}`, name, category: 'Unknown', price: 0, ingredients: [] }));
  }

  return { salesData: combinedSales, menuItems };
}

export { normalizePosImportPayload };
