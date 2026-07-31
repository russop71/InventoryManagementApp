export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.WELCOME_FROM_EMAIL || 'Zest IQ <hello@zestiq.ca>';

  if (!apiKey) {
    return res.status(500).json({ error: 'Email service is not configured' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim() || 'there';

  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  const text = [
    `Hi ${name},`,
    '',
    'Thanks for joining Zest IQ. We are excited to help you run a tighter, smarter kitchen.',
    '',
    'What you can do with Zest IQ:',
    '- Track inventory in real time across locations',
    '- Build recipes and monitor food cost by dish',
    '- Use AI Orders to forecast and generate supplier orders',
    '- Scan invoices to update costs and stock faster',
    '- Get low-stock alerts before service is impacted',
    '- Review COGS trends and usage performance in your dashboard',
    '',
    'If you need help getting set up, reply to this email and our team will help you get moving quickly.',
    '',
    'Welcome aboard,',
    'The Zest IQ Team',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px; margin: 0 auto;">
      <h2 style="margin: 0 0 12px;">Welcome to Zest IQ, ${name}.</h2>
      <p style="margin: 0 0 12px;">Thanks for joining. We are excited to help you run a tighter, smarter kitchen.</p>
      <p style="margin: 0 0 8px;"><strong>What you can do with Zest IQ:</strong></p>
      <ul style="margin: 0 0 16px; padding-left: 20px;">
        <li>Track inventory in real time across locations</li>
        <li>Build recipes and monitor food cost by dish</li>
        <li>Use AI Orders to forecast and generate supplier orders</li>
        <li>Scan invoices to update costs and stock faster</li>
        <li>Get low-stock alerts before service is impacted</li>
        <li>Review COGS trends and usage performance in your dashboard</li>
      </ul>
      <p style="margin: 0 0 12px;">If you need help getting set up, reply to this email and our team will help you get moving quickly.</p>
      <p style="margin: 0;">Welcome aboard,<br/>The Zest IQ Team</p>
    </div>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: 'Thanks for joining Zest IQ',
        text,
        html,
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