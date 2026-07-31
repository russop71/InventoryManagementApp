export async function sendSupplierEmail({ to, subject, text }) {
  const response = await fetch('/api/send-supplier-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, text }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || 'Failed to send supplier email';
    const error = new Error(message);
    const normalizedMessage = String(message).toLowerCase();
    if (normalizedMessage.includes('not configured')) {
      error.code = 'EMAIL_SERVICE_NOT_CONFIGURED';
    }
    throw error;
  }

  return payload;
}
