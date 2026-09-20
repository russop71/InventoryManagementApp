-- Private connector state: never expose tokens through location_data or client grants.
create table public.clover_connections (
  location_id uuid not null references public.locations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  merchant_id text not null,
  merchant_name text not null default '',
  token_ciphertext text not null,
  status text not null default 'connected',
  last_sync timestamptz,
  last_error text,
  sync_lease text,
  sync_until timestamptz,
  snapshot jsonb,
  primary key (location_id, environment),
  unique (merchant_id, environment)
);
create table public.clover_oauth_states (
  state_hash text primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'production')),
  expires_at timestamptz not null
);
alter table public.clover_connections enable row level security;
alter table public.clover_oauth_states enable row level security;
revoke all on public.clover_connections, public.clover_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.clover_connections, public.clover_oauth_states to service_role;

create function public.clover_save_connection(connection jsonb) returns void
language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from locations where id=(connection->>'location_id')::uuid and account_id=(connection->>'account_id')::uuid) then
    raise exception 'Location mismatch';
  end if;
  insert into clover_connections(location_id, account_id, environment, merchant_id, merchant_name, token_ciphertext)
  values ((connection->>'location_id')::uuid, (connection->>'account_id')::uuid, connection->>'environment', connection->>'merchant_id', connection->>'merchant_name', connection->>'token_ciphertext')
  on conflict (location_id, environment) do update set token_ciphertext=excluded.token_ciphertext,
    merchant_name=excluded.merchant_name, status='connected', last_error=null
  where clover_connections.merchant_id=excluded.merchant_id
    and clover_connections.account_id=excluded.account_id
    and (clover_connections.sync_until is null or clover_connections.sync_until < now());
  if not found then raise exception 'Disconnect the existing merchant or wait for the sync first'; end if;
  delete from clover_oauth_states where expires_at < now();
end; $$;

create function public.clover_claim_sync(target_location uuid, target_account uuid, target_environment text, lease text)
returns setof public.clover_connections language sql set search_path = public as $$
  update clover_connections set sync_lease=lease, sync_until=now()+interval '30 minutes'
  where location_id=target_location and account_id=target_account and environment=target_environment
    and status='connected' and (sync_until is null or sync_until < now())
  returning *;
$$;
create function public.clover_finish_sync(target_location uuid, target_account uuid, target_environment text, lease text, snapshot jsonb)
returns void language plpgsql set search_path = public as $$
begin
  update clover_connections set snapshot=clover_finish_sync.snapshot, last_sync=now(), last_error=null, sync_lease=null, sync_until=null
  where location_id=target_location and account_id=target_account and environment=target_environment and sync_lease=lease;
  if not found then raise exception 'Connection changed during sync'; end if;
end; $$;
create function public.clover_disconnect(target_location uuid, target_account uuid, target_environment text)
returns void language plpgsql set search_path = public as $$
begin
  delete from clover_oauth_states where location_id=target_location and account_id=target_account and environment=target_environment;
  delete from clover_connections where location_id=target_location and account_id=target_account and environment=target_environment;
end; $$;
revoke all on function public.clover_save_connection(jsonb), public.clover_claim_sync(uuid,uuid,text,text), public.clover_finish_sync(uuid,uuid,text,text,jsonb), public.clover_disconnect(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.clover_save_connection(jsonb), public.clover_claim_sync(uuid,uuid,text,text), public.clover_finish_sync(uuid,uuid,text,text,jsonb), public.clover_disconnect(uuid,uuid,text) to service_role;
