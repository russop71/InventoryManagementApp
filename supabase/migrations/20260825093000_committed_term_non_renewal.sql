alter table public.accounts
  add column if not exists commitment_started_at timestamptz,
  add column if not exists commitment_ends_at timestamptz,
  add column if not exists non_renewal_requested_at timestamptz,
  add column if not exists non_renewal_effective_at timestamptz;

comment on column public.accounts.commitment_ends_at is
  'End of the current 12-month subscription commitment; monthly Stripe billing continues through this date.';
