-- Apply with the service role / SQL editor before enabling CLOVER_PRODUCTION_ENABLED.
create table public.clover_connections (
  location_id uuid primary key references public.locations(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  connected_by uuid references public.app_users(id) on delete set null,
  merchant_id text not null,
  merchant_name text not null,
  status text not null default 'connected' check (status in ('connected', 'reconnect_required', 'disconnected')),
  encrypted_tokens text,
  snapshot jsonb,
  last_sync_at timestamptz,
  last_error text,
  lease_id uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
create unique index clover_unique_active_merchant on public.clover_connections(merchant_id) where status <> 'disconnected';
create table public.clover_oauth_states (
  state_hash text primary key,
  browser_hash text not null,
  account_id uuid not null references public.accounts(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  unique(location_id)
);
alter table public.clover_connections enable row level security;
alter table public.clover_oauth_states enable row level security;
revoke all on public.clover_connections, public.clover_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.clover_connections, public.clover_oauth_states to service_role;

-- Keep locally configured cost categories/ingredient mappings; provider owns sales and menu prices.
create function public.clover_project_snapshot(snapshot jsonb, incoming jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select snapshot || jsonb_build_object(
    'cogsCategories', coalesce(incoming->'cogsCategories', '[]'::jsonb),
    'menuItems', coalesce((select jsonb_agg(item || jsonb_build_object(
      'ingredients', coalesce((select local_item->'ingredients' from jsonb_array_elements(coalesce(incoming->'menuItems','[]'::jsonb)) local_item where local_item->>'id'=item->>'id' limit 1), '[]'::jsonb),
      'cogsCategoryId', (select local_item->'cogsCategoryId' from jsonb_array_elements(coalesce(incoming->'menuItems','[]'::jsonb)) local_item where local_item->>'id'=item->>'id' limit 1)
    )) from jsonb_array_elements(coalesce(snapshot->'menuItems','[]'::jsonb)) item), '[]'::jsonb)
  );
$$;
create function public.protect_clover_snapshot() returns trigger
language plpgsql set search_path = public as $$
declare provider_snapshot jsonb;
begin
  select snapshot into provider_snapshot from public.clover_connections where location_id=new.location_id and status <> 'disconnected';
  if provider_snapshot is not null then
    new.integrations = jsonb_set(coalesce(new.integrations, '{}'::jsonb), '{toast}', public.clover_project_snapshot(provider_snapshot, new.integrations->'toast'));
  end if;
  return new;
end;
$$;
create trigger location_data_protect_clover before insert or update of integrations on public.location_data
for each row execute function public.protect_clover_snapshot();

-- Publishing and releasing the lease is atomic: no partial report or lost concurrent edits.
create function public.publish_clover_sync(p_location_id uuid, p_lease_id uuid, p_sales jsonb, p_menu jsonb, p_from_day text, p_until_day text)
returns boolean language plpgsql set search_path = public as $$
declare connection public.clover_connections; current_toast jsonb; historical jsonb; next_snapshot jsonb;
begin
  select * into connection from public.clover_connections where location_id=p_location_id and lease_id=p_lease_id and lease_until>now() and status='connected' for update;
  if not found then return false; end if;
  select integrations->'toast' into current_toast from public.location_data where location_id=p_location_id for update;
  if current_toast->>'provider' = 'clover' and current_toast->>'restaurantId' = connection.merchant_id then
    select coalesce(jsonb_agg(day), '[]'::jsonb) into historical from jsonb_array_elements(coalesce(current_toast->'salesData','[]'::jsonb)) day where day->>'date'<p_from_day or day->>'date'>=p_until_day;
  else historical = '[]'::jsonb; end if;
  select jsonb_build_object('connected',true,'provider','clover','connectionMode','direct','restaurantId',connection.merchant_id,
    'salesData', (select coalesce(jsonb_agg(day order by day->>'date'),'[]'::jsonb) from jsonb_array_elements(historical || p_sales) day),
    'menuItems',p_menu,'lastSync',now(), 'salesBasis','Item sales after discounts, before refunds; excludes tax and tips. Covers are not provided.') into next_snapshot;
  update public.clover_connections set snapshot=next_snapshot,last_sync_at=now(),last_error=null,lease_id=null,lease_until=null,updated_at=now() where location_id=p_location_id;
  insert into public.location_data(location_id,integrations) values (p_location_id,jsonb_build_object('toast',next_snapshot))
    on conflict(location_id) do update set integrations=jsonb_set(coalesce(location_data.integrations,'{}'::jsonb),'{toast}', public.clover_project_snapshot(next_snapshot,location_data.integrations->'toast')),updated_at=now();
  return true;
end;
$$;
revoke all on function public.clover_project_snapshot(jsonb,jsonb), public.protect_clover_snapshot(), public.publish_clover_sync(uuid,uuid,jsonb,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.clover_project_snapshot(jsonb,jsonb), public.protect_clover_snapshot(), public.publish_clover_sync(uuid,uuid,jsonb,jsonb,text,text) to service_role;

create function public.connect_clover(p_connection jsonb, p_state_hash text) returns boolean
language plpgsql set search_path = public as $$
declare oauth public.clover_oauth_states; location_uuid uuid; current_connection public.clover_connections;
begin
  select id into location_uuid from public.locations where id=(p_connection->>'location_id')::uuid and account_id=(p_connection->>'account_id')::uuid and archived_at is null for update;
  if not found then raise exception 'Location unavailable'; end if;
  delete from public.clover_oauth_states where state_hash=p_state_hash and consumed_at is not null and expires_at>now() returning * into oauth;
  if not found or oauth.location_id::text<>(p_connection->>'location_id') or oauth.account_id::text<>(p_connection->>'account_id') or oauth.user_id::text<>(p_connection->>'connected_by') then
    raise exception 'Authorization expired';
  end if;
  select * into current_connection from public.clover_connections where location_id=location_uuid for update;
  if current_connection.lease_until>now() then raise exception 'Sync in progress'; end if;
  insert into public.clover_connections(location_id,account_id,connected_by,merchant_id,merchant_name,status,encrypted_tokens)
    values(location_uuid,oauth.account_id,oauth.user_id,p_connection->>'merchant_id',p_connection->>'merchant_name','connected',p_connection->>'encrypted_tokens')
    on conflict(location_id) do update set connected_by=excluded.connected_by,merchant_id=excluded.merchant_id,merchant_name=excluded.merchant_name,status='connected',encrypted_tokens=excluded.encrypted_tokens,
      snapshot=case when clover_connections.merchant_id=excluded.merchant_id then clover_connections.snapshot else null end,
      last_sync_at=case when clover_connections.merchant_id=excluded.merchant_id then clover_connections.last_sync_at else null end,
      last_error=null,lease_id=null,lease_until=null,updated_at=now();
  return true;
end;
$$;
revoke all on function public.connect_clover(jsonb,text) from public,anon,authenticated;
grant execute on function public.connect_clover(jsonb,text) to service_role;

create function public.disconnect_clover(p_location_id uuid, p_account_id uuid) returns boolean
language plpgsql set search_path = public as $$
begin
  perform id from public.locations where id=p_location_id and account_id=p_account_id for update;
  if not found then return false; end if;
  delete from public.clover_oauth_states where location_id=p_location_id;
  update public.clover_connections set status='disconnected',encrypted_tokens=null,lease_id=null,lease_until=null,updated_at=now() where location_id=p_location_id and account_id=p_account_id;
  return true;
end;
$$;
revoke all on function public.disconnect_clover(uuid,uuid) from public,anon,authenticated;
grant execute on function public.disconnect_clover(uuid,uuid) to service_role;
