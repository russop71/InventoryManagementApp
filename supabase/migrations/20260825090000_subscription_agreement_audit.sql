create table if not exists public.subscription_agreements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  agreement_version text not null,
  accepted_at timestamptz not null,
  customer_accepted boolean not null default false,
  acceptance_channel text not null default 'stripe_checkout',
  customer_email text,
  stripe_checkout_session_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

create index if not exists subscription_agreements_account_accepted_idx
  on public.subscription_agreements (account_id, accepted_at desc);

alter table public.subscription_agreements enable row level security;

comment on table public.subscription_agreements is
  'Server-recorded subscription agreement acceptance from Stripe Checkout. Retains agreement version, timestamp and customer acceptance status.';
