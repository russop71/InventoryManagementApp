import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { cloverApiOrigin } from './_clover-config.js';

const requestSlots = new Map();

export async function cloverRequest(path, { token, body, signal } = {}) {
  // Paths and provider host are controlled by this module, never by callback input.
  if (!path.startsWith('/oauth/v2/') && !path.startsWith('/v3/merchants/')) throw new Error('Invalid Clover request');
  let response;
  try {
    if (token) {
      const bucket = createHash('sha256').update(token).digest('hex');
      const slot = Math.max(Date.now(), requestSlots.get(bucket) || 0);
      requestSlots.set(bucket, slot + 125); // At most eight merchant requests per second.
      if (requestSlots.size > 1000) for (const [key, until] of requestSlots) if (until < Date.now()) requestSlots.delete(key);
      if (slot > Date.now()) await delay(slot - Date.now(), undefined, { signal });
    }
    response = await fetch(`${cloverApiOrigin}${path}`, {
      method: body ? 'POST' : 'GET',
      signal: signal || AbortSignal.timeout(12_000),
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ZestIQ/1.0', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw Object.assign(new Error('Clover did not respond. Please try again.'), { status: 502, code: 'CLOVER_UNAVAILABLE' }); }
  if (!response.ok) {
    // Never relay provider responses: they can contain codes or credentials.
    const expired = [400, 401].includes(response.status) && path.startsWith('/oauth/');
    const reconnect = expired || response.status === 401;
    throw Object.assign(new Error(reconnect ? 'Reconnect Clover to renew access.' : response.status === 403 ? 'Clover has not granted the required read permissions.' : 'Clover could not complete the request. Try again later.'), { status: response.status === 429 ? 429 : 502, code: reconnect ? 'CLOVER_RECONNECT_REQUIRED' : 'CLOVER_UNAVAILABLE' });
  }
  return response.json();
}

export function validatedTokenPair(value) {
  if (!value?.access_token || !value?.refresh_token || !Number.isFinite(value.access_token_expiration) || !Number.isFinite(value.refresh_token_expiration)) {
    throw Object.assign(new Error('Clover did not return expiring access credentials. Check the app OAuth settings.'), { status: 502, code: 'CLOVER_TOKEN_INVALID' });
  }
  return { access_token: value.access_token, refresh_token: value.refresh_token, access_token_expiration: value.access_token_expiration, refresh_token_expiration: value.refresh_token_expiration };
}

export async function cloverList(path, token, { maxPages = 100, signal } = {}) {
  const all = [], ids = new Set();
  for (let offset = 0; offset < maxPages * 100; offset += 100) {
    const url = new URL(path, cloverApiOrigin);
    url.searchParams.set('limit', '100'); url.searchParams.set('offset', String(offset));
    const payload = await cloverRequest(url.pathname + url.search, { token, signal });
    if (!Array.isArray(payload.elements)) throw Object.assign(new Error('Clover returned an incomplete sales response.'), { status: 502 });
    for (const item of payload.elements) {
      if (!item.id || ids.has(item.id)) throw Object.assign(new Error('Clover returned overlapping pages. Please retry the sync.'), { status: 502 });
      ids.add(item.id); all.push(item);
    }
    if (payload.elements.length < 100) return all;
  }
  throw Object.assign(new Error('This Clover sync exceeds the supported batch size. No partial data was saved. Contact ZestIQ support.'), { status: 422, code: 'CLOVER_BATCH_TOO_LARGE' });
}

export function calendarDay(timestamp, timezone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp));
}

// Resolve midnight using the location's timezone, including daylight-saving changes.
export function zonedMidnight(day, timezone) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let value = target;
  const format = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(format.formatToParts(value).map(part => [part.type, part.value]));
    const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    if (local === target) return value;
    value += target - local;
  }
  throw Object.assign(new Error('The restaurant timezone could not be resolved.'), { status: 422, code: 'CLOVER_TIMEZONE_INVALID' });
}

// Reporting data is item sales after discounts, before refunds, excluding tax/tips.
// Clover covers are not supplied by this API; do not invent guest counts.
export function summarizeCloverOrders(orders, menuItems, timezone, fromDay, untilDay) {
  const days = new Map();
  for (let date = new Date(`${fromDay}T12:00:00Z`); calendarDay(date, 'UTC') < untilDay; date.setUTCDate(date.getUTCDate() + 1)) {
    const day = calendarDay(date, 'UTC'); days.set(day, { date: day, covers: 0, revenue: 0, topItems: [] });
  }
  const menu = new Map(menuItems.map(item => [item.id, item]));
  for (const order of orders) {
    if (order.deletedTime || order.testMode || order.state !== 'locked' || !['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CREDITED'].includes(String(order.paymentState || '').toUpperCase())) continue;
    const day = days.get(calendarDay(order.createdTime, timezone));
    if (!day) continue;
    if (!Array.isArray(order.lines)) throw new Error('Order lines have not been retrieved');
    for (const line of order.lines) {
      if (line.isDeleted || line.deleted || line.isRevenue === false) continue;
      const item = menu.get(line.item?.id);
      if (item?.isRevenue === false) continue;
      const quantity = item?.priceType === 'PER_UNIT' ? Number(line.unitQty) / 1000 : 1;
      const unitPrice = Number(line.priceWithModifiersAndItemAndOrderDiscounts);
      // Fail closed rather than silently drop discounts when reporting fields are absent.
      if (!Number.isFinite(quantity) || quantity <= 0 || line.priceWithModifiersAndItemAndOrderDiscounts == null || !Number.isFinite(unitPrice)) {
        throw Object.assign(new Error('Clover did not include complete item pricing. No sales were changed. Contact ZestIQ support.'), { status: 422, code: 'CLOVER_PRICING_INCOMPLETE' });
      }
      const revenue = Math.round(unitPrice * quantity) / 100;
      const name = String(line.name || item?.name || 'Unnamed item');
      const existing = day.topItems.find(entry => entry.itemName === name);
      if (existing) { existing.quantity += quantity; existing.revenue += revenue; }
      else day.topItems.push({ itemName: name, quantity, revenue });
      day.revenue += revenue;
    }
  }
  return [...days.values()].map(day => ({ ...day, revenue: Math.round(day.revenue * 100) / 100, topItems: day.topItems.map(item => ({ ...item, revenue: Math.round(item.revenue * 100) / 100 })) }));
}
