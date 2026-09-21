begin;

alter table public.locations add column if not exists archived_at timestamptz;

-- Only the server can call this. The account lock serializes create/archive/restore
-- so concurrent requests cannot remove the last active location or exceed capacity.
create or replace function public.manage_account_location(
  p_account_id uuid, p_action text, p_location_id uuid default null,
  p_name text default null, p_slug text default null, p_paid_additional integer default 0
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  allowed_count integer;
  active_count integer;
  target public.locations%rowtype;
begin
  select 1 + coalesce(additional_location_quantity, 0) into allowed_count
    from public.accounts where id = p_account_id for update;
  if not found then raise sqlstate 'PT404' using message = 'Account not found'; end if;
  allowed_count := least(allowed_count, 1 + greatest(coalesce(p_paid_additional, 0), 0));
  select count(*) into active_count from public.locations
    where account_id = p_account_id and archived_at is null;

  if p_action = 'create' then
    if p_name is null or length(trim(p_name)) not between 2 and 120 or coalesce(p_slug, '') = '' then
      raise sqlstate 'PT400' using message = 'Location name must be between 2 and 120 characters';
    end if;
    select * into target from public.locations where account_id = p_account_id and slug = p_slug;
    if found then
      if target.archived_at is not null then
        raise sqlstate 'PT409' using message = 'This location is archived. Restore it from Archived locations to keep its records.';
      end if;
      raise sqlstate 'PT409' using message = 'A location with that name already exists';
    end if;
    if active_count >= allowed_count then
      raise sqlstate 'PT402' using message = 'Your active location allowance is full. Review your subscription before adding another location.';
    end if;
    insert into public.locations(account_id, slug, name, timezone)
      values(p_account_id, p_slug, trim(p_name), 'America/Toronto') returning * into target;
    insert into public.location_data(location_id) values(target.id);
    return target.id;
  end if;

  select * into target from public.locations where id = p_location_id and account_id = p_account_id for update;
  if not found then raise sqlstate 'PT404' using message = 'Location not found'; end if;
  if p_action = 'archive' then
    if target.archived_at is not null then return target.id; end if;
    if active_count <= 1 then
      raise sqlstate 'PT409' using message = 'Keep at least one active location. The last active location cannot be archived.';
    end if;
    update public.locations set archived_at = now() where id = target.id;
  elsif p_action = 'restore' then
    if target.archived_at is null then return target.id; end if;
    if active_count >= allowed_count then
      raise sqlstate 'PT402' using message = 'Your active location allowance is full. Review your subscription before restoring this location.';
    end if;
    update public.locations set archived_at = null where id = target.id;
  else
    raise sqlstate 'PT400' using message = 'Invalid location action';
  end if;
  return target.id;
end;
$$;

revoke all on function public.manage_account_location(uuid, text, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.manage_account_location(uuid, text, uuid, text, text, integer) to service_role;
notify pgrst, 'reload schema';
commit;
