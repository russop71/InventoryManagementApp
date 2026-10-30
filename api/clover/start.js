// Compatibility for cached clients that still offer the unreleased connector.
// Do not enable the isolated Clover sandbox integration in production here.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(503).json({
    code: 'CLOVER_ACTIVATION_REQUIRED',
    error: 'Clover automatic sync is not activated. Import a Clover CSV or JSON sales export from Integrations, or request direct activation.',
  });
}
