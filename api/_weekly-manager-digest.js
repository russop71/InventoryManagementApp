const MANAGER_ROLES = new Set(['Owner', 'Admin', 'Manager', 'BOH Manager', 'FOH Manager']);

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function money(value) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value) || 0);
}

export function weekKey(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function managerRecipients(users = []) {
  return [...new Set(users
    .filter(user => user?.status === 'Active' && MANAGER_ROLES.has(user?.role))
    .map(user => String(user?.email || '').trim().toLowerCase())
    .filter(email => /^\S+@\S+\.\S+$/.test(email)))];
}

export function summarizeLocationAttention(location, since) {
  const inventory = Array.isArray(location?.inventory) ? location.inventory : [];
  const priceChanges = [];
  for (const item of inventory) {
    for (const change of Array.isArray(item?.priceHistory) ? item.priceHistory : []) {
      const changedAt = new Date(change?.date || 0);
      if (Number.isNaN(changedAt.getTime()) || changedAt < since) continue;
      const oldPrice = Number(change?.oldPrice) || 0;
      const newPrice = Number(change?.newPrice) || 0;
      if (oldPrice === newPrice) continue;
      priceChanges.push({
        itemName: String(item?.name || 'Inventory item').slice(0, 160),
        supplier: String(item?.supplier || '').slice(0, 160),
        oldPrice,
        newPrice,
        percent: oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : null,
        date: changedAt.toISOString(),
      });
    }
  }
  priceChanges.sort((left, right) => Math.abs(right.percent || 0) - Math.abs(left.percent || 0));
  const lowStock = inventory.filter(item => !item?.inactive && Number(item?.currentStock) <= Number(item?.reorderPoint ?? item?.parLevel ?? 0));
  const staleCutoff = new Date(since);
  staleCutoff.setUTCDate(staleCutoff.getUTCDate() - 1);
  const overdueCounts = inventory.filter(item => !item?.inactive && (!item?.lastCountedAt || new Date(item.lastCountedAt) < staleCutoff));
  const openInvoices = (Array.isArray(location?.invoices) ? location.invoices : []).filter(invoice => invoice?.status === 'open');
  const pendingOrders = (Array.isArray(location?.orders) ? location.orders : []).filter(order => order?.status === 'pending');
  return { name: String(location?.name || 'Restaurant location'), priceChanges, lowStock, overdueCounts, openInvoices, pendingOrders };
}

export function hasAttention(summary) {
  return summary.priceChanges.length > 0 || summary.lowStock.length > 0 || summary.overdueCounts.length > 0 || summary.openInvoices.length > 0 || summary.pendingOrders.length > 0;
}

export function buildWeeklyManagerDigest({ recipientName, accountName, locations, periodStart, periodEnd }) {
  const firstName = String(recipientName || 'there').trim().split(/\s+/)[0] || 'there';
  const allChanges = locations.flatMap(location => location.priceChanges.map(change => ({ ...change, locationName: location.name })));
  const attentionTotal = locations.reduce((total, location) => total + location.lowStock.length + location.overdueCounts.length + location.openInvoices.length + location.pendingOrders.length, 0);
  const range = `${periodStart.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })}–${periodEnd.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  const subject = allChanges.length
    ? `${allChanges.length} price change${allChanges.length === 1 ? '' : 's'} this week · ${accountName}`
    : `Weekly ZestIQ attention summary · ${accountName}`;
  const locationText = locations.map(location => {
    const changes = location.priceChanges.slice(0, 12).map(change => `• ${change.itemName}: ${money(change.oldPrice)} → ${money(change.newPrice)}${change.percent === null ? '' : ` (${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(1)}%)`}`);
    return [`${location.name}`, ...changes, `• ${location.lowStock.length} low-stock · ${location.overdueCounts.length} overdue-count · ${location.openInvoices.length} open-invoice · ${location.pendingOrders.length} pending-order`].join('\n');
  }).join('\n\n');
  const locationHtml = locations.map(location => `<section style="margin:0 0 18px;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden"><h2 style="margin:0;background:#f8fafc;padding:14px 16px;font-size:18px">${escapeHtml(location.name)}</h2>${location.priceChanges.length ? `<div style="padding:14px 16px"><h3 style="margin:0 0 10px;font-size:14px;color:#64748b;text-transform:uppercase">Price changes</h3>${location.priceChanges.slice(0, 12).map(change => `<div style="padding:8px 0;border-top:1px solid #eef2f7"><strong>${escapeHtml(change.itemName)}</strong><br><span style="color:${change.newPrice > change.oldPrice ? '#b42318' : '#067647'}">${money(change.oldPrice)} → ${money(change.newPrice)}${change.percent === null ? '' : ` · ${change.percent >= 0 ? '+' : ''}${change.percent.toFixed(1)}%`}</span>${change.supplier ? ` <span style="color:#64748b">· ${escapeHtml(change.supplier)}</span>` : ''}</div>`).join('')}</div>` : ''}<div style="padding:14px 16px;background:#fff7d1;font-size:14px"><strong>Needs attention:</strong> ${location.lowStock.length} low stock · ${location.overdueCounts.length} overdue counts · ${location.openInvoices.length} open invoices · ${location.pendingOrders.length} pending orders</div></section>`).join('');
  return {
    subject,
    text: [`Hi ${firstName},`, '', `Here is the ZestIQ weekly manager update for ${accountName} (${range}).`, '', locationText, '', `Review ${attentionTotal} open attention item${attentionTotal === 1 ? '' : 's'}: https://zestiq.ca/app`, '', 'The ZestIQ team'].join('\n'),
    html: `<div style="background:#f4f1e8;padding:28px 12px;font-family:Arial,sans-serif;color:#1f2937;line-height:1.5"><div style="max-width:680px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden"><div style="background:#303a43;padding:22px 24px;text-align:center"><img src="https://zestiq.ca/zestiq-mark-exact.png" width="58" height="58" alt="ZestIQ" style="display:block;margin:0 auto 8px;width:58px;height:58px;object-fit:contain"><div style="color:#f5d62e;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase">Weekly manager update</div></div><div style="padding:28px"><h1 style="font-size:27px;line-height:1.2;margin:0 0 8px">What changed this week</h1><p style="margin:0 0 22px;color:#64748b">${escapeHtml(accountName)} · ${escapeHtml(range)}</p><p>Hi ${escapeHtml(firstName)}, here are the price movements and operational items that need attention.</p>${locationHtml}<p style="margin:24px 0 0;text-align:center"><a href="https://zestiq.ca/app" style="display:inline-block;background:#f5d62e;color:#18212f;text-decoration:none;font-weight:800;padding:14px 22px;border-radius:12px">Open ZestIQ attention centre</a></p></div></div></div>`,
  };
}

export async function sendWeeklyManagerDigest(details, fetchImpl = fetch) {
  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN || process.env.RESEND_KEY;
  if (!apiKey) return { sent: false, reason: 'not_configured' };
  const message = buildWeeklyManagerDigest(details);
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'ZestIQ <welcome@zestiq.ca>', to: details.recipients, ...message }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Email provider request failed (${response.status})`);
  return { sent: true, id: payload?.id || null };
}
