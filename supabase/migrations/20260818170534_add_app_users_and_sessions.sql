create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'Staff',
  status text not null default 'Active',
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(account_id, email)
);

create index if not exists app_users_account_id_idx on public.app_users(account_id);

create table if not exists public.app_sessions (
  token uuid primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists app_sessions_account_id_idx on public.app_sessions(account_id);
create index if not exists app_sessions_user_id_idx on public.app_sessions(user_id);

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.app_sessions from anon, authenticated;

grant select, insert, update, delete on table public.app_users to service_role;
grant select, insert, update, delete on table public.app_sessions to service_role;
