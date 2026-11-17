-- Private, per-owner cloud storage for the five personal website slots and added links.
begin;
create table if not exists public.dashboard_personal_sites (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  sites jsonb not null default '[]'::jsonb check (jsonb_typeof(sites)='array' and jsonb_array_length(sites)<=100),
  updated_at timestamptz not null default now()
);
alter table public.dashboard_personal_sites enable row level security;
alter table public.dashboard_personal_sites force row level security;
revoke all on public.dashboard_personal_sites from public, anon;
grant select,insert,update,delete on public.dashboard_personal_sites to authenticated;
create policy dashboard_personal_sites_owner_only on public.dashboard_personal_sites for all to authenticated
using ((select public.asset_access_allowed()) and owner_id=(select auth.uid()))
with check ((select public.asset_access_allowed()) and owner_id=(select auth.uid()));
commit;
