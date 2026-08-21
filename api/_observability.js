function safeMessage(error) {
  return String(error?.message || 'Unknown server error').replace(/[\r\n]+/g, ' ').slice(0, 500);
}

export async function reportServerError(error, context = {}) {
  const webhook = process.env.ZESTIQ_ALERT_WEBHOOK_URL;
  if (!webhook) return false;
  try {
    const parsed = new URL(webhook);
    if (parsed.protocol !== 'https:') return false;
    await fetch(parsed, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'zestiq-api',
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
        message: safeMessage(error),
        context: {
          route: String(context.route || '').slice(0, 250),
          method: String(context.method || '').slice(0, 20),
          requestId: String(context.requestId || '').slice(0, 150),
        },
        occurredAt: new Date().toISOString(),
      }),
    });
    return true;
  } catch {
    return false;
  }
}
