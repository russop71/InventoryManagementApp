begin;
insert into public.accounts(id,slug,name) values('11111111-1111-4111-8111-111111111111','clover-sql-one','SQL One'),('22222222-2222-4222-8222-222222222222','clover-sql-two','SQL Two');
insert into public.app_users(id,account_id,email,name) values('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','clover-test@example.com','SQL Owner');
insert into public.locations(id,account_id,slug,name) values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','main','Main'),('55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222','other','Other');
insert into public.clover_oauth_states values('state','browser','11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333', now()+interval '10 minutes',now());
select public.connect_clover('{"location_id":"44444444-4444-4444-8444-444444444444","account_id":"11111111-1111-4111-8111-111111111111","connected_by":"33333333-3333-4333-8333-333333333333","merchant_id":"MERCHANT123","merchant_name":"Test Kitchen","encrypted_tokens":"encrypted"}', 'state');
do $$begin
  if exists(select 1 from public.clover_oauth_states where state_hash='state') then raise exception 'OAuth state was not consumed'; end if;
  begin
    perform public.connect_clover('{"location_id":"44444444-4444-4444-8444-444444444444"}', 'state');
    raise exception 'replay accepted';
  exception when raise_exception then
    if sqlerrm='replay accepted' then raise; end if;
  end;
end$$;
update public.clover_connections set lease_id='66666666-6666-4666-8666-666666666666',lease_until=now()+interval '4 minutes';
do $$begin
  if public.publish_clover_sync('44444444-4444-4444-8444-444444444444','77777777-7777-4777-8777-777777777777','[]','[]','2026-10-01','2026-10-08') then raise exception 'wrong lease accepted'; end if;
end$$;
select public.publish_clover_sync('44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666','[{"date":"2026-10-01","revenue":100,"covers":0,"topItems":[]}]','[{"id":"item1","name":"Pasta","price":20,"ingredients":[]}]','2026-10-01','2026-10-08');
update public.location_data set integrations='{"labor":{"untouched":true},"toast":{"provider":"fake","salesData":[],"menuItems":[{"id":"item1","price":1,"ingredients":[{"inventoryItemId":"flour","quantity":0.2}],"cogsCategoryId":"food"}],"cogsCategories":[{"id":"food"}]}}';
do $$declare data jsonb; begin
  select integrations into data from public.location_data where location_id='44444444-4444-4444-8444-444444444444';
  if data->'toast'->>'provider'<>'clover' or data->'toast'->'salesData'->0->>'revenue'<>'100' then raise exception 'stale client overwrote sales'; end if;
  if data->'toast'->'menuItems'->0->>'price'<>'20' then raise exception 'stale menu price accepted'; end if;
  if data->'toast'->'menuItems'->0->'ingredients'->0->>'inventoryItemId'<>'flour' then raise exception 'ingredient mapping lost'; end if;
  if data->'labor'->>'untouched'<>'true' then raise exception 'unrelated integration lost'; end if;
  if exists(select 1 from public.location_data where location_id='55555555-5555-4555-8555-555555555555') then raise exception 'other location modified'; end if;
end$$;
select public.disconnect_clover('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111');
update public.location_data set integrations=jsonb_set(integrations,'{toast}', '{"provider":"generic","salesData":[]}');
do $$begin
  if exists(select 1 from public.clover_connections where encrypted_tokens is not null or lease_id is not null or status<>'disconnected') then raise exception 'disconnect retained live credentials'; end if;
  if exists(select 1 from public.location_data where integrations->'toast'->>'provider'<>'generic') then raise exception 'disconnect did not release the sales feed'; end if;
  if has_table_privilege('authenticated','public.clover_connections','select') or has_table_privilege('anon','public.clover_oauth_states','select') then raise exception 'private credentials exposed'; end if;
  if has_function_privilege('authenticated','public.connect_clover(jsonb,text)','execute') then raise exception 'browser can connect merchants directly'; end if;
end$$;
rollback;
