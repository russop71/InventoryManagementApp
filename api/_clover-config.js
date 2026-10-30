import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export function cloverConfiguration(env = process.env) {
  const checks = {
    productionEnabled: env.CLOVER_PRODUCTION_ENABLED === 'true',
    clientId: Boolean(env.CLOVER_CLIENT_ID),
    clientSecret: Boolean(env.CLOVER_CLIENT_SECRET),
    encryptionKey: /^[0-9a-f]{64}$/i.test(env.CLOVER_ENCRYPTION_KEY || ''),
    database: Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY),
    scheduler: Boolean(env.CRON_SECRET),
    appUrl: /^https:\/\/(zestiq\.ca|www\.zestiq\.ca)\/?$/.test(env.APP_URL || ''),
  };
  return { available: Object.values(checks).every(Boolean), checks };
}

export function requireCloverConfiguration() {
  if (!cloverConfiguration().available) throw Object.assign(new Error('Clover automatic sync needs activation by ZestIQ. Sales exports can still be imported.'), { status: 503, code: 'CLOVER_ACTIVATION_REQUIRED' });
}

export function sealTokens(tokens, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.CLOVER_ENCRYPTION_KEY, 'hex'), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}

export function openTokens(value, context) {
  const [iv, tag, encrypted] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.CLOVER_ENCRYPTION_KEY, 'hex'), iv);
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(encrypted), cipher.final()]).toString('utf8'));
}

export const cloverApiOrigin = 'https://api.clover.com';
export function cloverCallbackUrl() { return `${process.env.APP_URL.replace(/\/$/, '')}/api/clover/callback`; }
