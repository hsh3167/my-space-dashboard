begin;
create function public.import_asset_holdings(p_account_id uuid, p_as_of date, p_positions jsonb, p_cash numeric default 0)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  account_row public.asset_accounts%rowtype;
  item jsonb;
  canonical jsonb;
  content_hash text;
  row_total integer;
begin
  if not public.asset_access_allowed() then raise insufficient_privilege; end if;
  if p_positions is null or jsonb_typeof(p_positions) <> 'array' then raise sqlstate '22023' using message = 'positions must be an array'; end if;
  row_total := jsonb_array_length(p_positions);
  if row_total < 1 or row_total > 5000 or p_cash is null or p_cash < 0 or p_cash > 999999999999999
    or p_as_of is null or p_as_of < date '2000-01-01' or p_as_of > (now() at time zone 'Asia/Seoul')::date then
    raise sqlstate '22023' using message = 'invalid import parameters';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  select * into account_row from public.asset_accounts where id = p_account_id and owner_id = auth.uid() for update;
  if not found then raise insufficient_privilege; end if;
  if account_row.kind not in ('brokerage','retirement') or p_as_of < account_row.valuation_date then
    raise sqlstate '22023' using message = 'invalid account kind or stale valuation';
  end if;
  for item in select value from jsonb_array_elements(p_positions) loop
    if jsonb_typeof(item) <> 'object' then raise sqlstate '22023' using message = 'invalid position'; end if;
    if (select array_agg(key order by key) from jsonb_object_keys(item) key)
      is distinct from array['cost_basis','market_value','name','quantity','symbol'] then
      raise sqlstate '22023' using message = 'only whitelisted fields are accepted';
    end if;
    if jsonb_typeof(item->'name') <> 'string' or jsonb_typeof(item->'symbol') <> 'string'
      or jsonb_typeof(item->'quantity') <> 'number' or jsonb_typeof(item->'market_value') <> 'number'
      or jsonb_typeof(item->'cost_basis') <> 'number' then
      raise sqlstate '22023' using message = 'invalid field types';
    end if;
    if length(btrim(item->>'name')) not between 1 and 120
      or item->>'name' ~ '[0-9][0-9 -]{7,}[0-9]|[[:cntrl:]]|@|계좌번호|주민번호|주민등록'
      or btrim(item->>'name') ~ '^[=+@-]'
      or length(item->>'symbol') > 24 or item->>'symbol' !~ '^[A-Za-z0-9._-]*$'
      or item->>'symbol' ~ '[0-9][0-9 -]{5,}[0-9]'
      or (item->>'quantity')::numeric not between 0 and 999999999999
      or (item->>'market_value')::numeric not between 0 and 999999999999999
      or (item->>'cost_basis')::numeric not between 0 and 999999999999999 then
      raise sqlstate '22023' using message = 'invalid or sensitive position';
    end if;
  end loop;
  select jsonb_agg(jsonb_build_object('name',btrim(x.name),'symbol',btrim(x.symbol),
      'quantity',x.quantity::numeric(24,8),'market_value',x.market_value::numeric(18,2),'cost_basis',x.cost_basis::numeric(18,2))
    order by btrim(x.name) collate "C",btrim(x.symbol) collate "C")
  into canonical from jsonb_to_recordset(p_positions) as x(name text,symbol text,quantity numeric,market_value numeric,cost_basis numeric);
  if exists(select 1 from jsonb_to_recordset(canonical) x(name text,symbol text) group by name,symbol having count(*) > 1) then
    raise sqlstate '22023' using message = 'duplicate positions within file';
  end if;
  content_hash := encode(sha256(convert_to(jsonb_build_object('positions',canonical,'cash',round(p_cash,2))::text,'UTF8')),'hex');
  -- The unique constraint is the authoritative duplicate check; no raw file hash/name is saved.
  insert into public.asset_imports(account_id,valuation_date,fingerprint,row_count)
  values (p_account_id,p_as_of,content_hash,row_total);
  delete from public.asset_holdings where account_id = p_account_id and owner_id = auth.uid();
  insert into public.asset_holdings(account_id,name,symbol,quantity,market_value,cost_basis)
  select p_account_id,x.name,x.symbol,x.quantity,x.market_value,x.cost_basis
    from jsonb_to_recordset(canonical) as x(name text,symbol text,quantity numeric,market_value numeric,cost_basis numeric);
  update public.asset_accounts set balance = round(p_cash,2) + (select sum(x.market_value) from jsonb_to_recordset(canonical) x(market_value numeric)),
    valuation_date = p_as_of where id = p_account_id and owner_id = auth.uid();
  perform public.record_asset_snapshot();
  return jsonb_build_object('imported',row_total,'account_id',p_account_id,'valuation_date',p_as_of);
end $$;
revoke all on function public.import_asset_holdings(uuid,date,jsonb,numeric) from public, anon;
grant execute on function public.import_asset_holdings(uuid,date,jsonb,numeric) to authenticated;
commit;
