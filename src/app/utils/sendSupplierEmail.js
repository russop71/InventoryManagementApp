export async function sendSupplierEmail({ to, subject, text }) {
  const response = await fetch('/api/send-supplier-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, text }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to send supplier email');
  }

  return payload;
}
