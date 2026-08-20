alter table public.accounts
  add column if not exists onboarding_state jsonb not null default '{"status":"not_started","currentStep":"restaurant","completedSteps":[],"skippedSteps":[],"startedAt":null,"completedAt":null,"updatedAt":null}'::jsonb;

comment on column public.accounts.onboarding_state is
  'Tenant-level first-run progress for the guided ZestIQ setup experience.';

alter table public.location_data
  add column if not exists inventory_counts jsonb not null default '[]'::jsonb;

comment on column public.location_data.inventory_counts is
  'Location-scoped inventory count drafts and finalized count history.';

-- Do not interrupt accounts that existed before guided onboarding launched.
update public.accounts
set onboarding_state = jsonb_build_object(
  'status', 'dismissed',
  'currentStep', 'restaurant',
  'completedSteps', '[]'::jsonb,
  'skippedSteps', '[]'::jsonb,
  'startedAt', null,
  'completedAt', null,
  'updatedAt', now()
)
where onboarding_state ->> 'status' = 'not_started'
  and created_at < now() - interval '1 minute';
