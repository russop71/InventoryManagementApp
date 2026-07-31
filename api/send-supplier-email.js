export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey =
    process.env.RESEND_API_KEY ||
    process.env.RESEND_API_TOKEN ||
    process.env.RESEND_KEY ||
    '';
  const fromEmail =
    process.env.WELCOME_FROM_EMAIL ||
    process.env.RESEND_FROM_EMAIL ||
    'Zest IQ <onboarding@resend.dev>';

  if (!apiKey) {
    return res.status(500).json({
      error: 'Email service is not configured. Set RESEND_API_KEY (or RESEND_API_TOKEN / RESEND_KEY).',
    });
  }

  const to = String(req.body?.to || '').trim();
  const subject = String(req.body?.subject || '').trim() || 'Supplier order request';
  const text = String(req.body?.text || '').trim();

  if (!to || !text) {
    return res.status(400).json({ error: 'to and text are required' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        text,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.message || payload?.error || 'Email provider request failed';
      return res.status(502).json({ error: message });
    }

    return res.status(200).json({ sent: true, id: payload?.id || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    return res.status(500).json({ error: message });
  }
}
