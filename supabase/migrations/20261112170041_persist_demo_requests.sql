-- Demo inquiries are private platform records, accessible only through the server.
create table public.demo_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null,
  last_name text not null default '',
  email text not null,
  phone text not null default '',
  restaurant text not null,
  role text not null default '',
  pos text not null default '',
  venues text not null default '',
  goal text not null default '',
  notification_to text not null,
  notification_status text not null default 'pending'
    check (notification_status in ('pending', 'accepted', 'failed')),
  notification_provider_id text,
  notification_attempted_at timestamptz,
  notification_error text
);
create index demo_requests_created_at_idx on public.demo_requests (created_at desc);
alter table public.demo_requests enable row level security;
revoke all on table public.demo_requests from public, anon, authenticated;
grant select, insert, update on table public.demo_requests to service_role;
comment on column public.demo_requests.notification_status is
  'accepted means the email provider accepted the notification, not confirmed inbox delivery. pending includes interrupted attempts.';
