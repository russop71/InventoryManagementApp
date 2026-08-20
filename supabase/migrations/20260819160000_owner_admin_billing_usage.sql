alter table public.app_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete cascade;

create unique index if not exists app_users_auth_user_id_key
  on public.app_users (auth_user_id)
  where auth_user_id is not null;

create unique index if not exists app_users_email_key
  on public.app_users (lower(email));

alter table public.accounts
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_plan text,
  add column if not exists billing_status text default 'not_configured',
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz;

create unique index if not exists accounts_stripe_customer_id_key
  on public.accounts (stripe_customer_id)
  where stripe_customer_id is not null;

create table if not exists public.app_usage_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  event_name text not null,
  path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_usage_events_account_created_idx
  on public.app_usage_events (account_id, created_at desc);

create index if not exists app_usage_events_user_created_idx
  on public.app_usage_events (user_id, created_at desc);

alter table public.app_usage_events enable row level security;

comment on table public.app_usage_events is
  'Server-recorded account activity used by company owners for team usage reporting.';
