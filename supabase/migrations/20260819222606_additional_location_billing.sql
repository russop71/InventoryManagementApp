alter table public.accounts
  add column if not exists additional_location_quantity integer not null default 0;

alter table public.accounts
  drop constraint if exists accounts_additional_location_quantity_check;

alter table public.accounts
  add constraint accounts_additional_location_quantity_check
  check (additional_location_quantity between 0 and 99);

comment on column public.accounts.additional_location_quantity is
  'Number of paid locations beyond the one location included with ZestIQ Premium.';
