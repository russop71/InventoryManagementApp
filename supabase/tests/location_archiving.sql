-- Uses only a transaction-local fixture; no existing account data is changed.
begin;
do $$
declare
  account uuid;
  first_location uuid;
  second_location uuid;
  replacement uuid;
  denied boolean;
begin
  insert into public.accounts(slug, name, additional_location_quantity)
    values ('location-test-' || gen_random_uuid(), 'Location transaction test', 1) returning id into account;
  first_location := public.manage_account_location(account, 'create', null, 'First', 'first', 0);
  denied := false;
  begin
    perform public.manage_account_location(account, 'create', null, 'Unpaid', 'unpaid', 0);
  exception when sqlstate 'PT402' then denied := true;
  end;
  if not denied then raise exception 'Unpaid extra location was allowed'; end if;
  second_location := public.manage_account_location(account, 'create', null, 'Second', 'second', 1);
  update public.location_data set inventory = '[{"id":"preserved-stock"}]'::jsonb where location_id = second_location;
  perform public.manage_account_location(account, 'archive', second_location);
  if not exists(select 1 from public.location_data where location_id = second_location and inventory->0->>'id' = 'preserved-stock') then
    raise exception 'Archiving lost historical data';
  end if;
  denied := false;
  begin
    perform public.manage_account_location(account, 'archive', first_location);
  exception when sqlstate 'PT409' then denied := true;
  end;
  if not denied then raise exception 'Last active location could be archived'; end if;
  denied := false;
  begin
    perform public.manage_account_location(account, 'create', null, 'Second', 'second', 1);
  exception when sqlstate 'PT409' then denied := true;
  end;
  if not denied then raise exception 'Archived slug could be duplicated'; end if;
  replacement := public.manage_account_location(account, 'create', null, 'Replacement', 'replacement', 1);
  denied := false;
  begin
    perform public.manage_account_location(account, 'restore', second_location, null, null, 1);
  exception when sqlstate 'PT402' then denied := true;
  end;
  if not denied then raise exception 'Restore exceeded paid capacity'; end if;
  perform public.manage_account_location(account, 'archive', replacement);
  perform public.manage_account_location(account, 'restore', second_location, null, null, 1);
  if not exists(select 1 from public.locations where id = second_location and archived_at is null) then raise exception 'Restore failed'; end if;
  denied := false;
  begin
    perform public.manage_account_location(account, 'archive', gen_random_uuid());
  exception when sqlstate 'PT404' then denied := true;
  end;
  if not denied then raise exception 'Invalid location was accepted'; end if;
  if has_function_privilege('authenticated', 'public.manage_account_location(uuid,text,uuid,text,text,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.manage_account_location(uuid,text,uuid,text,text,integer)', 'EXECUTE') then
    raise exception 'Location function exposed to browser clients';
  end if;
end;
$$;
rollback;
select 'PASS: unpaid create, last-location guard, duplicate prevention, capacity, restore, record preservation and permissions' as result;
