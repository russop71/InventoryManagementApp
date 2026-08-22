export function launchReadiness(env = process.env) {
  const checks = [
    ['supabaseUrl', Boolean(env.SUPABASE_URL)],
    ['supabaseServiceRole', Boolean(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)],
    ['stripeSecret', Boolean(env.STRIPE_SECRET_KEY)],
    ['stripePremiumPrice', Boolean(env.STRIPE_PRICE_MONTHLY)],
    ['stripeLocationPrice', Boolean(env.STRIPE_PRICE_ADDITIONAL_LOCATION)],
    ['stripeWebhookSecret', Boolean(env.STRIPE_WEBHOOK_SECRET)],
    ['openAi', Boolean(env.OPENAI_API_KEY)],
    ['platformAdmins', Boolean(String(env.ZESTIQ_PLATFORM_ADMIN_EMAILS || '').trim())],
    ['appUrl', Boolean(env.APP_URL)],
    ['demoAccountSecret', Boolean(env.DEMO_ACCOUNT_PASSWORD)],
  ].map(([name, ok]) => ({ name, ok }));
  return { ready: checks.every(check => check.ok), checks };
}
