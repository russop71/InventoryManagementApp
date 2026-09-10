create table if not exists public.app_user_locations (
  user_id uuid not null references public.app_users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

create index if not exists app_user_locations_account_id_idx
  on public.app_user_locations (account_id);

create index if not exists app_user_locations_location_id_idx
  on public.app_user_locations (location_id);

alter table public.app_user_locations enable row level security;

revoke all on table public.app_user_locations from anon, authenticated;
grant select, insert, update, delete on table public.app_user_locations to service_role;

comment on table public.app_user_locations is
  'Server-enforced restaurant location assignments for non-owner operational users.';

insert into public.app_user_locations (user_id, location_id, account_id)
select users.id, first_location.id, users.account_id
from public.app_users users
join lateral (
  select locations.id
  from public.locations locations
  where locations.account_id = users.account_id
  order by locations.created_at asc
  limit 1
) first_location on true
where users.role not in ('Owner', 'Admin')
on conflict (user_id, location_id) do nothing;
