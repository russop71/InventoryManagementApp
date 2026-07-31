function normalizePosImportPayload(payload = {}) {
  const deriveTopItemsFromMarketmanRows = (rows = []) => {
    const topItems = [];

    rows.forEach(row => {
      const itemName = row['Menu item name'] || row['Menu item'] || row.name || row.itemName || row['Item'] || '';
      const quantity = Number(row['Qty sold'] ?? row.qtySold ?? row.quantity ?? row.Qty ?? 0);
      const revenue = Number(row['Total sales'] ?? row.totalSales ?? row.revenue ?? row.amount ?? 0);

      if (!itemName || !Number.isFinite(quantity) || quantity <= 0) {
        return;
      }

      topItems.push({
        itemName,
        quantity,
        revenue,
      });
    });

    return topItems;
  };

  const rawSalesData = Array.isArray(payload.salesData)
    ? payload.salesData
    : Array.isArray(payload.history)
      ? payload.history
      : [];

  const normalizedSalesData = rawSalesData.map(day => ({
    date: day.date || day.period || day.timestamp || '',
    covers: Number(day.covers || 0),
    revenue: Number(day.revenue || 0),
    topItems: Array.isArray(day.topItems)
      ? day.topItems.map(item => ({
          itemName: item.itemName || item.name || 'Unknown item',
          quantity: Number(item.quantity || 0),
          revenue: Number(item.revenue || 0),
        })).filter(item => Number(item.quantity) > 0)
      : [],
  }));

  const marketmanRows = Array.isArray(payload.marketmanReport)
    ? payload.marketmanReport
    : Array.isArray(payload.rows)
      ? payload.rows
      : [];

  if (marketmanRows.length > 0) {
    const topItems = deriveTopItemsFromMarketmanRows(marketmanRows);
    if (topItems.length > 0) {
      normalizedSalesData.unshift({
        date: payload.date || payload.period || payload.timestamp || new Date().toISOString().split('T')[0],
        covers: Number(payload.covers || 0),
        revenue: Number(payload.revenue || 0),
        topItems,
      });
    }
  }

  if (payload.html) {
    const parseHtmlRows = () => {
      const normalizedHtml = String(payload.html || '');
      const rowMatches = normalizedHtml.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis);
      const rows = [];

      for (const match of rowMatches) {
        const rowHtml = match[1] || '';
        const cellMatches = rowHtml.matchAll(/<(th|td)[^>]*>(.*?)<\/\1>/gis);
        const values = [];

        for (const cellMatch of cellMatches) {
          const rawValue = cellMatch[2] || '';
          const value = rawValue.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          values.push(value);
        }

        if (values.length > 0) {
          rows.push(values);
        }
      }

      return rows.slice(1).map(values => ({
        'Menu item name': values[0] || '',
        'Qty sold': values[1] || '',
        'Total sales': values[2] || '',
        Category: values[3] || '',
      }));
    };

    const htmlRows = parseHtmlRows();
    const htmlTopItems = deriveTopItemsFromMarketmanRows(htmlRows);

    if (htmlTopItems.length > 0) {
      normalizedSalesData.unshift({
        date: payload.date || payload.period || payload.timestamp || new Date().toISOString().split('T')[0],
        covers: Number(payload.covers || 0),
        revenue: Number(payload.revenue || 0),
        topItems: htmlTopItems,
      });
    }
  }

  const menuItems = Array.isArray(payload.menuItems)
    ? payload.menuItems.map(item => ({
        id: item.id || item.name || `menu-${Math.random().toString(36).slice(2, 8)}`,
        name: item.name || item.itemName || 'Unnamed item',
        category: item.category || 'Unknown',
        price: Number(item.price || 0),
        ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      }))
    : [];

  if (menuItems.length === 0) {
    const derivedNames = new Set();
    normalizedSalesData.forEach(day => {
      (day.topItems || []).forEach(item => {
        if (item.itemName) derivedNames.add(item.itemName);
      });
    });

    Array.from(derivedNames).forEach((name, index) => {
      menuItems.push({
        id: `derived-${index + 1}`,
        name,
        category: 'Unknown',
        price: 0,
        ingredients: [],
      });
    });
  }

  return {
    salesData: normalizedSalesData,
    menuItems,
  };
}

export { normalizePosImportPayload };
