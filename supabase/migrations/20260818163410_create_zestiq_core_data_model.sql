create extension if not exists pgcrypto;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  slug text not null,
  name text not null,
  timezone text not null default 'America/Toronto',
  latitude numeric(9,6),
  longitude numeric(9,6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, slug)
);

create table public.location_data (
  location_id uuid primary key references public.locations(id) on delete cascade,
  inventory jsonb not null default '[]'::jsonb,
  recipes jsonb not null default '[]'::jsonb,
  storage_areas jsonb not null default '[]'::jsonb,
  orders jsonb not null default '[]'::jsonb,
  invoices jsonb not null default '[]'::jsonb,
  suppliers jsonb not null default '[]'::jsonb,
  prepped_recipes jsonb not null default '[]'::jsonb,
  integrations jsonb not null default '{}'::jsonb,
  forecasts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index locations_account_id_idx on public.locations(account_id);

alter table public.accounts enable row level security;
alter table public.locations enable row level security;
alter table public.location_data enable row level security;

revoke all on table public.accounts from anon, authenticated;
revoke all on table public.locations from anon, authenticated;
revoke all on table public.location_data from anon, authenticated;

grant select, insert, update, delete on table public.accounts to service_role;
grant select, insert, update, delete on table public.locations to service_role;
grant select, insert, update, delete on table public.location_data to service_role;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
grant execute on function public.touch_updated_at() to service_role;

create trigger accounts_touch_updated_at
before update on public.accounts
for each row execute function public.touch_updated_at();

create trigger locations_touch_updated_at
before update on public.locations
for each row execute function public.touch_updated_at();

create trigger location_data_touch_updated_at
before update on public.location_data
for each row execute function public.touch_updated_at();
