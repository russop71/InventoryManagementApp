-- Customer data is accessed only through ZestIQ's authenticated server API.
-- RLS is already enabled on these tables; revoking direct API-role grants adds
-- a second layer of protection against accidental future policy exposure.
revoke all privileges on table public.accounts from anon, authenticated;
revoke all privileges on table public.app_sessions from anon, authenticated;
revoke all privileges on table public.app_usage_events from anon, authenticated;
revoke all privileges on table public.app_users from anon, authenticated;
revoke all privileges on table public.location_data from anon, authenticated;
revoke all privileges on table public.locations from anon, authenticated;
revoke all privileges on table public.subscription_agreements from anon, authenticated;
