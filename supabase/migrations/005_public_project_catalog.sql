-- Public, read-only project catalog. Full project notes and owner records remain private.
-- Explicit per-project publishing prevents accidentally exposing internal projects.
alter table public.project_hub_projects
  add column if not exists is_public boolean not null default false;

create table if not exists public.project_hub_public (
  id text primary key,
  name text not null,
  category text not null,
  summary text not null default '',
  links jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.project_hub_public enable row level security;
alter table public.project_hub_public force row level security;
revoke all on public.project_hub_public from public, anon, authenticated;
grant select on public.project_hub_public to anon, authenticated;

create policy "project_catalog_anyone_can_read"
  on public.project_hub_public for select to anon, authenticated using (true);

-- Trigger copies only explicitly public fields, never owner_id or private notes.
-- Keep privileged writer in a schema unavailable through the public REST API.
create or replace function private.sync_public_project_catalog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sanitized_links jsonb;
begin
  if tg_op = 'DELETE' then
    delete from public.project_hub_public where id = old.id;
    return old;
  end if;

  if new.is_public then
    select coalesce(jsonb_agg(jsonb_build_object(
      'type', link->>'type',
      'label', link->>'label',
      'url', link->>'url'
    )), '[]'::jsonb)
    into sanitized_links
    from jsonb_array_elements(new.links) as link
    where jsonb_typeof(link) = 'object'
      and (link->>'url') ~ '^https://[a-zA-Z0-9.-]+/'
      and (link->>'url') !~* '^https://(localhost|127[.]|10[.]|192[.]168[.]|172[.](1[6-9]|2[0-9]|3[01])[.])';

    insert into public.project_hub_public (id,name,category,summary,links,created_at,updated_at)
      values (new.id,new.name,new.category,new.summary,sanitized_links,new.created_at,new.updated_at)
    on conflict (id) do update set
      name = excluded.name,
      category = excluded.category,
      summary = excluded.summary,
      links = excluded.links,
      updated_at = excluded.updated_at;
  else
    delete from public.project_hub_public where id = new.id;
  end if;
  return new;
end
$$;
revoke all on function private.sync_public_project_catalog() from public, anon, authenticated;

create trigger sync_public_project_catalog
  after insert or update or delete on public.project_hub_projects
  for each row execute function private.sync_public_project_catalog();

-- Current approved projects: omit the internal company/localhost bookmark.
update public.project_hub_projects set is_public = true
where id in (
  'amr-sim','cruze','f1','lifting','myspace','robot-arm',
  'project-1794929106616-1h7qd',
  'project-1794929938135-ccvxh'
);
