-- Supabase migration: only the registered asset owner can access project metadata.
begin;
create table if not exists public.project_hub_projects (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,90}$'),
  name text not null check (length(btrim(name)) between 1 and 80),
  category text not null check (category in ('robotics','mechanical','simulation','web','other')),
  summary text not null default '' check (length(summary) <= 400),
  notes text not null default '' check (length(notes) <= 3000),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links)='array' and jsonb_array_length(links) <= 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(owner_id,id)
);
alter table public.project_hub_projects enable row level security;
alter table public.project_hub_projects force row level security;
revoke all on public.project_hub_projects from public, anon;
grant select,insert,update,delete on public.project_hub_projects to authenticated;
create policy owner_only on public.project_hub_projects for all to authenticated
using ((select public.asset_access_allowed()) and owner_id=(select auth.uid()))
with check ((select public.asset_access_allowed()) and owner_id=(select auth.uid()));
create index project_hub_projects_owner_updated on public.project_hub_projects(owner_id,updated_at desc);
commit;
