import { convertIngredientQuantity } from '../src/app/utils/unitConversionCore.js';

const MANAGER_ROLES = new Set(['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager']);
const APP = 'https://zestiq.ca/app';
const recordedDate = value => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? `${value}T12:00:00Z` : value);
const list = value => Array.isArray(value) ? value : [];
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const money = value => finite(value) ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value)) : '—';
const quantity = value => finite(value) ? Number(value).toLocaleString('en-CA', { maximumFractionDigits: 2 }) : '—';
const percent = value => finite(value) ? `${Number(value).toFixed(1)}%` : '—';

export function weekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function managerRecipients(users = []) {
  return [...new Set(users.filter(user => user?.status === 'Active' && MANAGER_ROLES.has(user?.role))
    .map(user => String(user?.email || '').trim().toLowerCase()).filter(email => /^\S+@\S+\.\S+$/.test(email)))];
}

export function summarizeLocationAttention(location, since, { until = new Date(), foodCostTarget } = {}) {
  const inventory = list(location?.inventory);
  const invoices = list(location?.invoices);
  const inPeriod = value => {
    if (!value) return false;
    const date = recordedDate(value);
    return !Number.isNaN(date.getTime()) && date >= since && date <= until;
  };
  const priceChanges = inventory.flatMap(item => list(item?.priceHistory).filter(change => inPeriod(change?.date)
    && finite(change.oldPrice) && finite(change.newPrice) && Number(change.oldPrice) !== Number(change.newPrice))
    .map(change => ({ itemName: String(item?.name || 'Inventory item').slice(0, 160), supplier: String(item?.supplier || '').slice(0, 160),
      oldPrice: Number(change.oldPrice), newPrice: Number(change.newPrice), percent: Number(change.oldPrice) > 0 ? ((Number(change.newPrice) - Number(change.oldPrice)) / Number(change.oldPrice)) * 100 : null,
      date: new Date(change.date).toISOString(), unit: item.unit || '' })));
  priceChanges.sort((a, b) => new Date(b.date) - new Date(a.date));
  const lowStock = inventory.filter(item => !item?.inactive && finite(item.currentStock)
    && finite(item.reorderPoint ?? item.parLevel) && Number(item.currentStock) <= Number(item.reorderPoint ?? item.parLevel));
  const staleCutoff = new Date(since);
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 1);
  const overdueCounts = inventory.filter(item => !item?.inactive && (!item?.lastCountedAt || new Date(item.lastCountedAt) < staleCutoff));
  const openInvoices = invoices.filter(invoice => invoice?.status === 'open');
  const pendingOrders = list(location?.orders).filter(order => order?.status === 'pending');
  const recentInvoices = invoices.filter(invoice => inPeriod(invoice?.createdAt || invoice?.date))
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
  const pendingSupplierMap = new Map();
  for (const invoice of openInvoices) {
    const supplier = String(invoice.supplier || 'Supplier not recorded').trim();
    pendingSupplierMap.set(supplier, (pendingSupplierMap.get(supplier) || 0) + 1);
  }
  const pendingSuppliers = [...pendingSupplierMap].map(([supplier, count]) => ({ supplier, count })).sort((a, b) => b.count - a.count);
  const target = finite(foodCostTarget) && Number(foodCostTarget) > 0 && Number(foodCostTarget) <= 100 ? Number(foodCostTarget) : null;
  const inventoryById = new Map(inventory.map(item => [item.id, item]));
  const foodCostExceptions = [];
  let incompleteRecipeCount = 0;
  for (const recipe of list(location?.recipes)) {
    if (!(Number(recipe.price) > 0)) continue;
    let cost = 0;
    let complete = list(recipe.ingredients).length > 0;
    for (const ingredient of list(recipe.ingredients)) {
      const item = inventoryById.get(ingredient.inventoryItemId);
      if (!item || !finite(item.unitCost) || Number(item.unitCost) < 0 || !finite(ingredient.quantity) || Number(ingredient.quantity) < 0) { complete = false; continue; }
      const converted = convertIngredientQuantity(item, Number(ingredient.quantity), ingredient.unit || item.unit, item.unit);
      if (converted === null || !Number.isFinite(converted)) { complete = false; continue; }
      cost += converted * Number(item.unitCost);
    }
    if (!complete) { incompleteRecipeCount++; continue; }
    const foodCostPercent = cost / Number(recipe.price) * 100;
    if (target !== null && foodCostPercent > target) foodCostExceptions.push({ name: recipe.menuItemName || 'Menu item', cost, price: Number(recipe.price), foodCostPercent, target });
  }
  foodCostExceptions.sort((a, b) => b.foodCostPercent - a.foodCostPercent);
  return { name: String(location?.name || 'Restaurant location'), priceChanges, lowStock, overdueCounts, openInvoices, pendingOrders,
    recentInvoices, pendingSuppliers, foodCostExceptions, foodCostTarget: target, incompleteRecipeCount };
}

export function hasAttention(summary) {
  return ['priceChanges', 'lowStock', 'overdueCounts', 'openInvoices', 'pendingOrders', 'recentInvoices', 'foodCostExceptions'].some(key => list(summary[key]).length > 0);
}

function summaryTable(headers, rows, emptyMessage) {
  if (!rows.length) return `<p style="margin:0;padding:10px 0;color:#64748b;font-size:13px">${escapeHtml(emptyMessage)}</p>`;
  return `<table role="table" style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;line-height:1.5"><thead><tr>${headers.map((header, index) => `<th scope="col" style="background:#eef1f4;color:#475569;text-align:${index ? 'right' : 'left'};font-size:10px;text-transform:uppercase;padding:10px 7px;width:${index ? 25 : 50}%">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => `<td style="border-bottom:1px solid #e5e7eb;padding:11px 7px;vertical-align:top;overflow-wrap:anywhere;text-align:${index ? 'right' : 'left'}">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function card(title, count, headers, rows, { note = '', empty = 'No items to report.', href, more = 0 } = {}) {
  return `<table role="presentation" width="100%" style="margin:0 0 14px;border:1px solid #e2e8f0;background:#fff;border-radius:6px"><tr><td style="padding:18px 16px"><h3 style="margin:0 0 14px;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:#c65c00">${escapeHtml(title)}${count === null ? '' : `: ${count}`}</h3>${note ? `<p style="margin:0 0 14px;font-size:13px;color:#64748b">${escapeHtml(note)}</p>` : ''}${summaryTable(headers, rows, empty)}${href ? `<p style="text-align:right;font-size:12px;margin:14px 0 0"><a href="${href}" style="color:#c65c00">View in ZestIQ${more > 0 ? ` (${more} more)` : ''}</a></p>` : ''}</td></tr></table>`;
}

export function buildWeeklyManagerDigest({ recipientName, accountName, locations, periodStart, periodEnd }) {
  const firstName = String(recipientName || 'there').trim().split(/\s+/)[0] || 'there';
  const range = `${periodStart.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' })}–${periodEnd.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Toronto' })}`;
  const allChanges = locations.flatMap(location => list(location.priceChanges));
  const subject = allChanges.length ? `${allChanges.length} price change${allChanges.length === 1 ? '' : 's'} this week · ${accountName}` : `Your weekly ZestIQ activity · ${accountName}`;
  const textSections = [];
  const locationHtml = locations.map(location => {
    const changes = list(location.priceChanges), foodCosts = list(location.foodCostExceptions), invoices = list(location.recentInvoices);
    const suppliers = location.pendingSuppliers || [...list(location.openInvoices).reduce((map, invoice) => map.set(invoice.supplier || 'Supplier not recorded', (map.get(invoice.supplier || 'Supplier not recorded') || 0) + 1), new Map())].map(([supplier, count]) => ({ supplier, count }));
    const low = list(location.lowStock), overdue = list(location.overdueCounts), pending = list(location.pendingOrders);
    const foodNote = location.foodCostTarget == null ? 'Set an account food-cost target to report menu items above target.' : `Calculated from current ingredient costs against your account target of ${percent(location.foodCostTarget)}.`;
    textSections.push([location.name, `Price changes: ${changes.length}`,
      ...changes.slice(0, 5).map(change => `${change.itemName}: ${money(change.oldPrice)} → ${money(change.newPrice)} (${change.percent === null ? '—' : `${change.percent >= 0 ? '+' : ''}${Number(change.percent).toFixed(1)}%`})`),
      `Menu items above food-cost target: ${location.foodCostTarget == null ? 'Target not set' : foodCosts.length}`, foodNote,
      ...foodCosts.slice(0, 5).map(item => `${item.name}: ${percent(item.foodCostPercent)} / target ${percent(item.target)}`),
      `Suppliers with pending invoices: ${suppliers.length}`, ...suppliers.slice(0, 5).map(item => `${item.supplier}: ${item.count} open invoices`),
      `Invoices recorded this week: ${invoices.length}`, ...invoices.slice(0, 5).map(invoice => `${invoice.date || 'Date not recorded'} · ${invoice.supplier || 'Supplier not recorded'} · ${invoice.invoiceNumber || 'No invoice number'} · ${invoice.status || 'Status not recorded'}`),
      `${low.length} low-stock · ${overdue.length} overdue-count · ${list(location.openInvoices).length} open-invoice · ${pending.length} pending-order`,
      'View full details in ZestIQ: https://zestiq.ca/app'].join('\n'));
    const dateLabel = invoice => {
      const date = recordedDate(invoice.date || invoice.createdAt);
      return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'America/Toronto' });
    };
    return `<h2 style="font-family:Georgia,serif;font-size:22px;color:#303A43;margin:25px 0 12px">${escapeHtml(location.name)}</h2>`
      + card('Price changes', changes.length, ['Purchase item', 'Previous price', 'Current price'], changes.slice(0, 5).map(change => [change.itemName + (change.unit ? ` (${change.unit})` : ''), money(change.oldPrice), money(change.newPrice)]), { empty: 'No recorded price changes this week.', href: `${APP}/inventory`, more: changes.length - 5 })
      + card('Menu items above food-cost target', location.foodCostTarget == null ? null : foodCosts.length, ['Menu item', 'Current FC', 'Target FC'], foodCosts.slice(0, 5).map(item => [item.name, percent(item.foodCostPercent), percent(item.target)]), { note: foodNote + (location.incompleteRecipeCount ? ` ${location.incompleteRecipeCount} menu item(s) need complete ingredient costs before they can be checked.` : ''), empty: location.foodCostTarget == null ? 'No comparison available yet.' : 'No fully costed menu items are above your target.', href: `${APP}/recipes`, more: foodCosts.length - 5 })
      + card('Suppliers with pending invoices', suppliers.length, ['Supplier', 'Open invoices'], suppliers.slice(0, 5).map(item => [item.supplier, String(item.count)]), { empty: 'No pending invoices.', href: `${APP}/invoices`, more: suppliers.length - 5 })
      + card('Invoices recorded this week', invoices.length, ['Date / supplier', 'Invoice', 'Status'], invoices.slice(0, 5).map(invoice => [`${dateLabel(invoice)} · ${invoice.supplier || 'Supplier not recorded'}`, invoice.invoiceNumber || '—', invoice.status || '—']), { empty: 'No invoices recorded this week.', href: `${APP}/invoices`, more: invoices.length - 5 })
      + card('Low stock', low.length, ['Inventory item', 'On hand', 'Reorder at'], low.slice(0, 5).map(item => [item.name || 'Inventory item', `${quantity(item.currentStock)} ${item.unit || ''}`, `${quantity(item.reorderPoint ?? item.parLevel)} ${item.unit || ''}`]), { empty: 'No recorded stock items are at or below their reorder level.', href: `${APP}/inventory`, more: low.length - 5 })
      + card('Other items needing attention', overdue.length + pending.length, ['Task', 'Count'], [['Overdue or unrecorded inventory counts', String(overdue.length)], ['Pending orders', String(pending.length)]], { href: `${APP}` });
  }).join('');
  return {
    subject,
    text: [`Hi ${firstName},`, '', `Your weekly ZestIQ activity for ${accountName} (${range}).`, 'Weekly activity plus current operational exceptions for your permitted locations.', '', textSections.join('\n\n'), '', 'The ZestIQ team'].join('\n'),
    html: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>Weekly ZestIQ activity</title></head><body style="margin:0;background:#eef1f4;font-family:Arial,sans-serif;color:#303A43"><div style="display:none;max-height:0;overflow:hidden">Your weekly account activity, price changes, menu costs and invoices.</div><table role="presentation" width="100%" style="background:#eef1f4;border-collapse:collapse"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" style="max-width:680px;border-collapse:collapse"><tr><td style="padding:22px;background:#303A43;text-align:center"><img src="https://zestiq.ca/zestiq-orange-icon.png" width="48" height="48" alt="ZestIQ" style="display:block;margin:0 auto 10px"><div style="color:#F58220;font-weight:bold;font-size:13px;letter-spacing:.08em">WEEKLY ACTIVITY</div><h1 style="font-family:Georgia,serif;color:#fff;margin:10px 0;font-size:26px">${escapeHtml(accountName)}</h1><p style="color:#cbd5e1;margin:0;font-size:13px">${escapeHtml(range)}</p></td></tr><tr><td style="padding:4px 8px 20px"><p style="font-size:14px;line-height:1.6;margin:20px 8px">Hi ${escapeHtml(firstName)}, here’s this week’s activity and the items that need attention across your permitted locations.</p>${locationHtml}<p style="text-align:center;margin:24px 0"><a href="${APP}" style="display:inline-block;background:#F58220;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:6px">Open ZestIQ attention centre</a></p><p style="font-size:11px;line-height:1.6;color:#64748b;text-align:center">Weekly activity uses recorded account data. Food costs and operational exceptions reflect the current account snapshot. Tables show up to five rows; sign in to review full details.</p><p style="text-align:center;font-size:12px"><a href="${APP}/account" style="color:#c65c00">Account settings</a> · <a href="${APP}/help" style="color:#c65c00">Help</a></p></td></tr></table></td></tr></table></body></html>`,
  };
}

export async function sendWeeklyManagerDigest(details, fetchImpl = fetch) {
  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN || process.env.RESEND_KEY;
  if (!apiKey) return { sent: false, reason: 'not_configured' };
  const message = buildWeeklyManagerDigest(details);
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'ZestIQ <welcome@zestiq.ca>', to: details.recipients, ...message }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Email provider request failed (${response.status})`);
  return { sent: true, id: payload?.id || null };
}
