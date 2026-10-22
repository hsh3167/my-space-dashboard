-- Run as the Supabase project administrator in the SQL editor.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.asset_owner (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users(id) on delete cascade
);
revoke all on private.asset_owner from public, anon, authenticated;
alter table private.asset_owner enable row level security;

create function public.asset_access_allowed() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.asset_owner where user_id = auth.uid()); $$;
revoke all on function public.asset_access_allowed() from public, anon;
grant execute on function public.asset_access_allowed() to authenticated;

create table public.asset_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 60 and label !~ '[0-9][0-9 -]{5,}[0-9]'),
  kind text not null check (kind in ('bank','savings','brokerage','retirement','other')),
  balance numeric(18,2) not null default 0 check (balance between 0 and 999999999999999),
  debt numeric(18,2) not null default 0 check (debt between 0 and 999999999999999),
  valuation_date date,
  created_at timestamptz not null default now(),
  unique (owner_id, id), unique (owner_id, label, kind)
);
create table public.asset_holdings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  name text not null check (length(name) between 1 and 120 and name !~ '[0-9][0-9 -]{7,}[0-9]'),
  symbol text not null default '' check (length(symbol) <= 24 and symbol ~ '^[A-Za-z0-9._-]*$'),
  quantity numeric(24,8) not null check (quantity between 0 and 999999999999),
  market_value numeric(18,2) not null check (market_value between 0 and 999999999999999),
  cost_basis numeric(18,2) not null check (cost_basis between 0 and 999999999999999),
  unique (owner_id, account_id, name, symbol),
  foreign key (owner_id, account_id) references public.asset_accounts(owner_id,id) on delete cascade
);
create table public.asset_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_assets numeric(20,2) not null check (total_assets >= 0),
  total_liabilities numeric(20,2) not null check (total_liabilities >= 0),
  unique (owner_id, snapshot_date)
);
create table public.asset_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (length(label) between 1 and 80 and label !~ '[0-9][0-9 -]{7,}[0-9]'),
  due_date date not null,
  amount numeric(18,2) not null check (amount between 0 and 999999999999999),
  status text not null default 'scheduled' check (status in ('scheduled','paid')),
  created_at timestamptz not null default now()
);
create table public.asset_imports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  valuation_date date not null,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  row_count integer not null check (row_count between 1 and 5000),
  created_at timestamptz not null default now(),
  unique (owner_id, account_id, valuation_date, fingerprint),
  foreign key (owner_id, account_id) references public.asset_accounts(owner_id,id) on delete cascade
);

do $$
declare t text;
begin
  foreach t in array array['asset_accounts','asset_holdings','asset_snapshots','asset_payments','asset_imports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy owner_only on public.%I for all to authenticated using ((select public.asset_access_allowed()) and owner_id = (select auth.uid())) with check ((select public.asset_access_allowed()) and owner_id = (select auth.uid()))', t);
    execute format('create index on public.%I (owner_id)', t);
  end loop;
end $$;

create function public.record_asset_snapshot() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not public.asset_access_allowed() then raise insufficient_privilege; end if;
  insert into public.asset_snapshots(owner_id,snapshot_date,total_assets,total_liabilities)
  select auth.uid(), (now() at time zone 'Asia/Seoul')::date, coalesce(sum(balance),0), coalesce(sum(debt),0)
  from public.asset_accounts where owner_id = auth.uid()
  on conflict (owner_id,snapshot_date) do update
  set total_assets = excluded.total_assets, total_liabilities = excluded.total_liabilities;
end $$;
revoke all on function public.record_asset_snapshot() from public, anon;
grant execute on function public.record_asset_snapshot() to authenticated;

create function public.save_asset_account(p_label text, p_kind text, p_balance numeric, p_debt numeric) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare account_id uuid;
begin
  if not public.asset_access_allowed() then raise insufficient_privilege; end if;
  -- Serializes aggregate snapshots across all mutation RPCs for this owner.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  insert into public.asset_accounts(label,kind,balance,debt) values (p_label,p_kind,p_balance,p_debt) returning id into account_id;
  perform public.record_asset_snapshot();
  return account_id;
end $$;
revoke all on function public.save_asset_account(text,text,numeric,numeric) from public, anon;
grant execute on function public.save_asset_account(text,text,numeric,numeric) to authenticated;
commit;
