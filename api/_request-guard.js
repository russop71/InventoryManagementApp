const buckets = new Map();

export function requestIdentity(req) {
  const forwarded = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req?.socket?.remoteAddress || 'unknown');
}

export function checkRateLimit(key, { limit, windowMs }, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + windowMs };
    buckets.set(key, next);
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: next.resetAt };
  }
  current.count += 1;
  return { allowed: current.count <= limit, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

export function enforceRateLimit(req, res, scope, options) {
  const result = checkRateLimit(`${scope}:${requestIdentity(req)}`, options);
  res.setHeader('X-RateLimit-Limit', String(options.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) {
    const error = Object.assign(new Error('Too many requests. Please wait and try again.'), { status: 429, code: 'RATE_LIMITED' });
    throw error;
  }
  return result;
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
