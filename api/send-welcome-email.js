// Compatibility for cached clients. Registration now sends the welcome email
// server-side; this endpoint must not send a second copy.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  return res.status(200).json({ sent: false, handledByRegistration: true });
}
