// Only use with a token already validated by Supabase's user endpoint.
export function jwtAssuranceLevel(token = '') {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()).aal || 'aal1';
  } catch { return 'aal1'; }
}

export function hasVerifiedAuthenticator(user) {
  return Array.isArray(user?.factors) && user.factors.some(factor => factor.factor_type === 'totp' && factor.status === 'verified');
}

export function requireEnrolledMfa(user, token) {
  if (hasVerifiedAuthenticator(user) && jwtAssuranceLevel(token) !== 'aal2') {
    throw Object.assign(new Error('Two-step verification is required for this account'), { status: 401, code: 'MFA_REQUIRED' });
  }
}
