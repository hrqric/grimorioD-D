-- Mestre controla PC/PP/PO; PO recebido libera o level-up da mesa.
-- Rollback: desative gold_xp_enabled antes de remover triggers/functions/tables.

alter table public.dnd_table_settings
add column gold_xp_enabled boolean not null default false;

grant update(gold_xp_enabled,updated_at) on public.dnd_table_settings to authenticated;

create table public.dnd_sheet_wallets (
 sheet_id uuid primary key references public.dnd_sheets(id) on delete cascade,
 table_id uuid not null references public.dnd_tables(id) on delete cascade,
 cp bigint not null default 0 check(cp>=0),
 sp bigint not null default 0 check(sp>=0),
 gp bigint not null default 0 check(gp>=0),
 gold_progress integer not null default 0 check(gold_progress>=0),
 revision bigint not null default 0 check(revision>=0),
 updated_at timestamptz not null default now()
);

create table public.dnd_currency_batches (
 id uuid primary key default gen_random_uuid(),
 table_id uuid not null references public.dnd_tables(id) on delete cascade,
 idempotency_key uuid not null,
 total_cp bigint not null check(total_cp>=0),
 total_sp bigint not null check(total_sp>=0),
 total_gp bigint not null check(total_gp>=0),
 reason text not null default '' check(char_length(reason)<=300),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 unique(table_id,idempotency_key),
 check(total_cp>0 or total_sp>0 or total_gp>0)
);

create table public.dnd_currency_allocations (
 id uuid primary key default gen_random_uuid(),
 batch_id uuid not null references public.dnd_currency_batches(id) on delete cascade,
 table_id uuid not null references public.dnd_tables(id) on delete cascade,
 sheet_id uuid not null references public.dnd_sheets(id) on delete cascade,
 cp_amount bigint not null default 0 check(cp_amount>=0),
 sp_amount bigint not null default 0 check(sp_amount>=0),
 gp_amount bigint not null default 0 check(gp_amount>=0),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 unique(batch_id,sheet_id),
 check(cp_amount>0 or sp_amount>0 or gp_amount>0)
);

create index dnd_sheet_wallets_table_idx on public.dnd_sheet_wallets(table_id);
create index dnd_currency_batches_table_created_idx on public.dnd_currency_batches(table_id,created_at desc);
create index dnd_currency_allocations_sheet_created_idx on public.dnd_currency_allocations(sheet_id,created_at desc);
create index dnd_currency_allocations_table_created_idx on public.dnd_currency_allocations(table_id,created_at desc);

alter table public.dnd_sheet_wallets enable row level security;
alter table public.dnd_currency_batches enable row level security;
alter table public.dnd_currency_allocations enable row level security;

create policy "sheet readers read wallets" on public.dnd_sheet_wallets for select to authenticated
using(exists(select 1 from public.dnd_sheets s where s.id=sheet_id));
create policy "masters read currency batches" on public.dnd_currency_batches for select to authenticated
using(public.dnd_is_gm(table_id));
create policy "sheet readers read currency allocations" on public.dnd_currency_allocations for select to authenticated
using(exists(select 1 from public.dnd_sheets s where s.id=sheet_id));

revoke all on public.dnd_sheet_wallets,public.dnd_currency_batches,public.dnd_currency_allocations from public,anon,authenticated;
grant select on public.dnd_sheet_wallets,public.dnd_currency_batches,public.dnd_currency_allocations to authenticated;

create or replace function public.dnd_gold_threshold(p_level integer)
returns integer language sql immutable security invoker set search_path='' as $$
 select case
  when p_level between 1 and 3 then 10
  when p_level=4 then 25 when p_level=5 then 35 when p_level=6 then 40
  when p_level=7 then 55 when p_level in (8,9) then 70
  when p_level=10 then 100 when p_level=11 then 110
  when p_level between 12 and 14 then 120
  when p_level between 15 and 19 then 150
  else 0 end
$$;
revoke all on function public.dnd_gold_threshold(integer) from public,anon,authenticated;

-- Valores legados incertos permanecem no JSON original; somente inteiros seguros
-- são importados para a carteira normalizada.
insert into public.dnd_sheet_wallets(sheet_id,table_id,cp,sp,gp)
select id,table_id,
 case when coalesce(data->>'cp','')~'^[0-9]{1,18}$' then (data->>'cp')::bigint else 0 end,
 case when coalesce(data->>'sp','')~'^[0-9]{1,18}$' then (data->>'sp')::bigint else 0 end,
 case when coalesce(data->>'gp','')~'^[0-9]{1,18}$' then (data->>'gp')::bigint else 0 end
from public.dnd_sheets on conflict(sheet_id) do nothing;

create or replace function public.dnd_create_sheet_wallet()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.dnd_sheet_wallets(sheet_id,table_id,cp,sp,gp)
 values(new.id,new.table_id,
  case when coalesce(new.data->>'cp','')~'^[0-9]{1,18}$' then (new.data->>'cp')::bigint else 0 end,
  case when coalesce(new.data->>'sp','')~'^[0-9]{1,18}$' then (new.data->>'sp')::bigint else 0 end,
  case when coalesce(new.data->>'gp','')~'^[0-9]{1,18}$' then (new.data->>'gp')::bigint else 0 end)
 on conflict(sheet_id) do nothing;
 return new;
end$$;
revoke all on function public.dnd_create_sheet_wallet() from public,anon,authenticated;
create trigger dnd_sheet_create_wallet after insert on public.dnd_sheets
for each row execute function public.dnd_create_sheet_wallet();

create or replace function public.dnd_guard_sheet_currency()
returns trigger language plpgsql security invoker set search_path='' as $$
declare enabled boolean;
begin
 select coalesce(s.gold_xp_enabled,false) into enabled
 from public.dnd_table_settings s where s.table_id=new.table_id;
 if not enabled then return new; end if;
 if tg_op='INSERT' then
  new.data:=jsonb_set(jsonb_set(jsonb_set(new.data,'{cp}','0'::jsonb,true),'{sp}','0'::jsonb,true),'{gp}','0'::jsonb,true);
 elsif new.data->'cp' is distinct from old.data->'cp'
    or new.data->'sp' is distinct from old.data->'sp'
    or new.data->'gp' is distinct from old.data->'gp' then
  raise sqlstate '42501' using message='As moedas desta mesa são controladas pelo mestre.';
 end if;
 return new;
end$$;
revoke all on function public.dnd_guard_sheet_currency() from public,anon,authenticated;
create trigger dnd_sheet_currency_guard before insert or update on public.dnd_sheets
for each row execute function public.dnd_guard_sheet_currency();

create or replace function public.dnd_distribute_currency(
 p_table_id uuid,p_total_cp bigint,p_total_sp bigint,p_total_gp bigint,
 p_allocations jsonb,p_idempotency_key uuid,p_reason text default ''
) returns setof public.dnd_currency_allocations
language plpgsql security definer set search_path='' as $$
declare batch uuid; item jsonb; count_items integer; sum_cp numeric:=0;sum_sp numeric:=0;sum_gp numeric:=0;
begin
 if auth.uid() is null or not public.dnd_is_gm(p_table_id) then
  raise sqlstate '42501' using message='Somente o mestre pode distribuir moedas.';
 end if;
 if not exists(select 1 from public.dnd_table_settings s where s.table_id=p_table_id and s.gold_xp_enabled) then
  raise sqlstate '22023' using message='Ative moedas do mestre e progressão por ouro nesta mesa.';
 end if;
 select b.id into batch from public.dnd_currency_batches b
 where b.table_id=p_table_id and b.idempotency_key=p_idempotency_key;
 if found then return query select a.* from public.dnd_currency_allocations a where a.batch_id=batch order by a.created_at,a.id;return;end if;
 if p_total_cp is null or p_total_sp is null or p_total_gp is null or p_idempotency_key is null
  or p_total_cp<0 or p_total_sp<0 or p_total_gp<0 or (p_total_cp=0 and p_total_sp=0 and p_total_gp=0) then
  raise sqlstate '22023' using message='Informe um tesouro com moedas inteiras e não negativas.';
 end if;
 if p_allocations is null or jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations) not between 1 and 100 then
  raise sqlstate '22023' using message='Selecione de 1 a 100 personagens.';
 end if;
 count_items:=jsonb_array_length(p_allocations);
 for item in select value from jsonb_array_elements(p_allocations) loop
  if jsonb_typeof(item)<>'object'
   or coalesce(item->>'sheet_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
   or jsonb_typeof(item->'cp')<>'number' or jsonb_typeof(item->'sp')<>'number' or jsonb_typeof(item->'gp')<>'number'
   or coalesce(item->>'cp','')!~'^[0-9]{1,18}$' or coalesce(item->>'sp','')!~'^[0-9]{1,18}$' or coalesce(item->>'gp','')!~'^[0-9]{1,18}$'
   or ((item->>'cp')::numeric+(item->>'sp')::numeric+(item->>'gp')::numeric)=0 then
   raise sqlstate '22023' using message='Cada parcela deve usar moedas inteiras, não negativas e ter algum valor.';
  end if;
  sum_cp:=sum_cp+(item->>'cp')::numeric;sum_sp:=sum_sp+(item->>'sp')::numeric;sum_gp:=sum_gp+(item->>'gp')::numeric;
 end loop;
 if (select count(distinct value->>'sheet_id') from jsonb_array_elements(p_allocations))<>count_items then
  raise sqlstate '22023' using message='Não repita personagens na mesma distribuição.';
 end if;
 if sum_cp<>p_total_cp or sum_sp<>p_total_sp or sum_gp<>p_total_gp then
  raise sqlstate '22023' using message='A soma das parcelas deve ser igual ao tesouro informado.';
 end if;
 if (select count(*) from public.dnd_sheets s where s.id in(select (value->>'sheet_id')::uuid from jsonb_array_elements(p_allocations))
     and s.table_id=p_table_id and not s.secret and not s.archived and s.kind='personagem')<>count_items then
  raise sqlstate '22023' using message='Todas as fichas devem ser personagens ativos desta mesa.';
 end if;
 perform 1 from public.dnd_sheets s where s.id in(select (value->>'sheet_id')::uuid from jsonb_array_elements(p_allocations)) order by s.id for update;
 insert into public.dnd_currency_batches(table_id,idempotency_key,total_cp,total_sp,total_gp,reason)
 values(p_table_id,p_idempotency_key,p_total_cp,p_total_sp,p_total_gp,left(btrim(coalesce(p_reason,'')),300))
 on conflict(table_id,idempotency_key) do nothing returning id into batch;
 if batch is null then
  select b.id into batch from public.dnd_currency_batches b where b.table_id=p_table_id and b.idempotency_key=p_idempotency_key;
  return query select a.* from public.dnd_currency_allocations a where a.batch_id=batch order by a.created_at,a.id;return;
 end if;
 insert into public.dnd_currency_allocations(batch_id,table_id,sheet_id,cp_amount,sp_amount,gp_amount,created_by)
 select batch,p_table_id,(value->>'sheet_id')::uuid,(value->>'cp')::bigint,(value->>'sp')::bigint,(value->>'gp')::bigint,auth.uid()
 from jsonb_array_elements(p_allocations);
 update public.dnd_sheet_wallets w set
  cp=w.cp+a.cp_amount,sp=w.sp+a.sp_amount,gp=w.gp+a.gp_amount,
  gold_progress=least(public.dnd_gold_threshold(coalesce((s.data->>'level')::integer,1)),w.gold_progress::bigint+a.gp_amount),
  revision=w.revision+1,updated_at=now()
 from public.dnd_currency_allocations a join public.dnd_sheets s on s.id=a.sheet_id
 where a.batch_id=batch and w.sheet_id=a.sheet_id;
 return query select a.* from public.dnd_currency_allocations a where a.batch_id=batch order by a.created_at,a.id;
end$$;
revoke all on function public.dnd_distribute_currency(uuid,bigint,bigint,bigint,jsonb,uuid,text) from public,anon;
grant execute on function public.dnd_distribute_currency(uuid,bigint,bigint,bigint,jsonb,uuid,text) to authenticated;

create or replace function public.dnd_require_gold_for_level_up()
returns trigger language plpgsql security definer set search_path='' as $$
declare enabled boolean;progress integer;goal integer;
begin
 if exists(select 1 from public.dnd_level_ups l where l.idempotency_key=new.idempotency_key and l.requested_by=auth.uid()) then return new;end if;
 select s.gold_xp_enabled into enabled from public.dnd_table_settings s where s.table_id=new.table_id;
 if not coalesce(enabled,false) then return new;end if;
 goal:=public.dnd_gold_threshold(new.from_total_level);
 select w.gold_progress into progress from public.dnd_sheet_wallets w where w.sheet_id=new.sheet_id for update;
 if goal>0 and coalesce(progress,0)<goal then
  raise sqlstate '22023' using message=format('Ainda faltam %s PO para liberar este level-up.',goal-coalesce(progress,0));
 end if;
 return new;
end$$;
revoke all on function public.dnd_require_gold_for_level_up() from public,anon,authenticated;
create trigger dnd_level_up_requires_gold before insert on public.dnd_level_ups
for each row execute function public.dnd_require_gold_for_level_up();

create or replace function public.dnd_reset_gold_after_level_up()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce((new.data->>'level')::integer,1)>coalesce((old.data->>'level')::integer,1)
  and exists(select 1 from public.dnd_table_settings s where s.table_id=new.table_id and s.gold_xp_enabled) then
  update public.dnd_sheet_wallets set gold_progress=0,revision=revision+1,updated_at=now() where sheet_id=new.id;
 end if;
 return new;
end$$;
revoke all on function public.dnd_reset_gold_after_level_up() from public,anon,authenticated;
create trigger dnd_reset_gold_progress after update on public.dnd_sheets
for each row execute function public.dnd_reset_gold_after_level_up();

-- A cópia preserva a carteira efetiva sem liberar edição dos campos legados.
create or replace function public.dnd_copy_sheet(p_sheet_id uuid,p_name text)
returns public.dnd_sheets language plpgsql security definer set search_path='' as $$
declare source public.dnd_sheets;copied public.dnd_sheets;
begin
 if auth.uid() is null then raise sqlstate '42501' using message='Somente o mestre pode copiar fichas.';end if;
 select s.* into source from public.dnd_sheets s where s.id=p_sheet_id for update;
 if not found then raise sqlstate 'P0002' using message='Ficha não encontrada.';end if;
 if not public.dnd_is_gm(source.table_id) then raise sqlstate '42501' using message='Somente o mestre desta mesa pode copiar fichas.';end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 150 then raise sqlstate '22023' using message='Informe um nome entre 1 e 150 caracteres.';end if;
 insert into public.dnd_sheets(table_id,player_id,name,kind,secret,archived,data)
 values(source.table_id,source.player_id,btrim(p_name),source.kind,source.secret,false,source.data) returning * into copied;
 insert into public.dnd_character_classes(sheet_id,class_id,class_level,is_primary,subclass_id)
 select copied.id,class_id,class_level,is_primary,subclass_id from public.dnd_character_classes where sheet_id=source.id;
 update public.dnd_sheet_wallets target set cp=src.cp,sp=src.sp,gp=src.gp,gold_progress=src.gold_progress
 from public.dnd_sheet_wallets src where target.sheet_id=copied.id and src.sheet_id=source.id;
 return copied;
end$$;
revoke all on function public.dnd_copy_sheet(uuid,text) from public,anon;
grant execute on function public.dnd_copy_sheet(uuid,text) to authenticated;

do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
  and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dnd_currency_allocations') then
  alter publication supabase_realtime add table public.dnd_currency_allocations;
 end if;
end$$;
