function csvToRows(text) {
  const rows = [];
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) return rows;

  const headers = parseCsvLine(lines[0]).map(header => header.trim().toLowerCase());
  for (let index = 1; index < lines.length; index += 1) {
    const values = parseCsvLine(lines[index]);
    const entry = {};
    headers.forEach((header, headerIndex) => {
      entry[header] = values[headerIndex] ?? '';
    });
    rows.push(entry);
  }

  return rows;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeValue(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parseInventoryCountCsv(text) {
  const optionalNumber = value => String(value ?? '').trim() === '' ? null : Number(value);
  return csvToRows(text)
    .map(row => ({
      name: row.name || row.item || row['item name'] || row['inventory item'] || '',
      currentStock: optionalNumber(row.currentstock || row.onhand || row.count || row.quantity),
      parLevel: optionalNumber(row.parlevel || row.par || row.minonhand),
      unitCost: optionalNumber(row.unitcost || row.cost || row.price),
      supplier: row.supplier || row.vendor || '',
      category: row.category || row.group || '',
    }))
    .filter(entry => entry.name);
}

export function buildInventoryUpdates(inventory, rows) {
  const normalizedInventory = inventory.map(item => ({
    ...item,
    normalizedName: normalizeValue(item.name),
  }));

  return rows
    .map(row => {
      const match = normalizedInventory.find(item => normalizeValue(row.name) === item.normalizedName);
      if (!match) return null;

      return {
        id: match.id,
        updates: {
          ...(Number.isFinite(row.currentStock) && row.currentStock >= 0 ? { currentStock: row.currentStock } : {}),
          ...(Number.isFinite(row.parLevel) && row.parLevel >= 0 ? { parLevel: row.parLevel } : {}),
          ...(Number.isFinite(row.unitCost) && row.unitCost >= 0 ? { unitCost: row.unitCost } : {}),
          ...(row.supplier ? { supplier: row.supplier } : {}),
          ...(row.category ? { category: row.category } : {}),
          lastUpdated: new Date().toISOString(),
        },
      };
    })
    .filter(Boolean);
}
