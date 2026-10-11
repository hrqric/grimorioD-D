-- Grimorio: glossary and transactional level-up workflow.
-- This migration intentionally keeps dnd_sheets.data compatible with the
-- existing client while introducing normalized progression records.

create extension if not exists pgcrypto;

do $$ begin
  create type public.dnd_level_up_policy as enum ('player_free', 'player_request', 'gm_only');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.dnd_level_up_status as enum ('pending', 'applied', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

create table if not exists public.dnd_table_settings (
  table_id uuid primary key references public.dnd_tables(id) on delete cascade,
  level_up_policy public.dnd_level_up_policy not null default 'player_request',
  updated_at timestamptz not null default now()
);

insert into public.dnd_table_settings(table_id)
select id from public.dnd_tables
on conflict (table_id) do nothing;

create or replace function public.dnd_create_table_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.dnd_table_settings(table_id) values (new.id)
  on conflict (table_id) do nothing;
  return new;
end;
$$;

drop trigger if exists dnd_tables_create_settings on public.dnd_tables;
create trigger dnd_tables_create_settings
after insert on public.dnd_tables
for each row execute function public.dnd_create_table_settings();
revoke all on function public.dnd_create_table_settings() from public, anon, authenticated;

create table if not exists public.dnd_rulesets (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  version text not null,
  language text not null default 'pt-BR',
  license text not null,
  source_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dnd_rule_entries (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references public.dnd_rulesets(id) on delete cascade,
  kind text not null check (kind in ('feature','spell','item','condition','feat','deity','attribute','rule')),
  slug text not null,
  name text not null,
  summary text not null,
  content text not null,
  source_name text,
  source_page text,
  source_url text,
  license text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(ruleset_id, kind, slug)
);

create index if not exists dnd_rule_entries_search_idx
on public.dnd_rule_entries using gin(to_tsvector('simple', name || ' ' || summary || ' ' || content));

create table if not exists public.dnd_classes (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references public.dnd_rulesets(id) on delete cascade,
  slug text not null,
  name text not null,
  hit_die smallint not null check (hit_die in (6,8,10,12)),
  created_at timestamptz not null default now(),
  unique(ruleset_id, slug)
);

create table if not exists public.dnd_class_levels (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.dnd_classes(id) on delete cascade,
  level smallint not null check (level between 1 and 20),
  proficiency_bonus smallint not null check (proficiency_bonus between 2 and 6),
  unique(class_id, level)
);

create table if not exists public.dnd_level_grants (
  id uuid primary key default gen_random_uuid(),
  class_level_id uuid not null references public.dnd_class_levels(id) on delete cascade,
  rule_entry_id uuid references public.dnd_rule_entries(id) on delete restrict,
  grant_type text not null default 'feature',
  quantity integer,
  choice_group text,
  config jsonb not null default '{}'::jsonb
);

create table if not exists public.dnd_character_classes (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.dnd_sheets(id) on delete cascade,
  class_id uuid not null references public.dnd_classes(id) on delete restrict,
  class_level smallint not null default 0 check (class_level between 0 and 20),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique(sheet_id, class_id)
);

create table if not exists public.dnd_level_ups (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  table_id uuid not null references public.dnd_tables(id) on delete cascade,
  sheet_id uuid not null references public.dnd_sheets(id) on delete cascade,
  class_id uuid not null references public.dnd_classes(id) on delete restrict,
  requested_by uuid not null default auth.uid() references auth.users(id),
  decided_by uuid references auth.users(id),
  status public.dnd_level_up_status not null,
  from_total_level smallint not null,
  to_total_level smallint not null,
  from_class_level smallint not null,
  to_class_level smallint not null,
  hp_gain smallint not null check (hp_gain >= 0),
  expected_sheet_version bigint not null,
  gains jsonb not null default '[]'::jsonb,
  before_snapshot jsonb,
  after_snapshot jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists dnd_level_ups_sheet_idx on public.dnd_level_ups(sheet_id, created_at desc);
create index if not exists dnd_level_ups_table_status_idx on public.dnd_level_ups(table_id, status, created_at desc);

alter table public.dnd_table_settings enable row level security;
alter table public.dnd_rulesets enable row level security;
alter table public.dnd_rule_entries enable row level security;
alter table public.dnd_classes enable row level security;
alter table public.dnd_class_levels enable row level security;
alter table public.dnd_level_grants enable row level security;
alter table public.dnd_character_classes enable row level security;
alter table public.dnd_level_ups enable row level security;

create policy "authenticated read rulesets" on public.dnd_rulesets for select to authenticated using (true);
create policy "authenticated read rule entries" on public.dnd_rule_entries for select to authenticated using (true);
create policy "authenticated read classes" on public.dnd_classes for select to authenticated using (true);
create policy "authenticated read class levels" on public.dnd_class_levels for select to authenticated using (true);
create policy "authenticated read level grants" on public.dnd_level_grants for select to authenticated using (true);

create policy "members read table settings" on public.dnd_table_settings for select to authenticated
using (
  exists (select 1 from public.dnd_tables t where t.id = table_id and t.owner_id = (select auth.uid()))
  or exists (select 1 from public.dnd_players p where p.table_id = table_id and p.active and lower(p.email)=lower(coalesce((select auth.jwt()->>'email'),'')))
);
create policy "masters update table settings" on public.dnd_table_settings for update to authenticated
using (exists (select 1 from public.dnd_tables t where t.id = table_id and t.owner_id = (select auth.uid())))
with check (exists (select 1 from public.dnd_tables t where t.id = table_id and t.owner_id = (select auth.uid())));

create policy "sheet members read character classes" on public.dnd_character_classes for select to authenticated
using (exists (
  select 1 from public.dnd_sheets s
  join public.dnd_tables t on t.id=s.table_id
  left join public.dnd_players p on p.id=s.player_id
  where s.id=sheet_id and (t.owner_id=(select auth.uid()) or (not s.secret and p.active and lower(p.email)=lower(coalesce((select auth.jwt()->>'email'),''))))
));

create policy "sheet members read level ups" on public.dnd_level_ups for select to authenticated
using (exists (
  select 1 from public.dnd_sheets s
  join public.dnd_tables t on t.id=s.table_id
  left join public.dnd_players p on p.id=s.player_id
  where s.id=sheet_id and (t.owner_id=(select auth.uid()) or (not s.secret and p.active and lower(p.email)=lower(coalesce((select auth.jwt()->>'email'),''))))
));

grant select on public.dnd_rulesets, public.dnd_rule_entries, public.dnd_classes,
  public.dnd_class_levels, public.dnd_level_grants to authenticated;
grant select on public.dnd_table_settings, public.dnd_character_classes, public.dnd_level_ups to authenticated;
grant update(level_up_policy, updated_at) on public.dnd_table_settings to authenticated;

insert into public.dnd_rulesets(slug, name, version, license, source_url)
values ('srd-5-2-1', 'System Reference Document', '5.2.1', 'CC-BY-4.0', 'https://www.dndbeyond.com/srd')
on conflict (slug) do update set version=excluded.version, source_url=excluded.source_url;

insert into public.dnd_classes(ruleset_id, slug, name, hit_die)
select r.id, v.slug, v.name, v.hit_die
from public.dnd_rulesets r
cross join (values
  ('cleric','Clérigo',8), ('fighter','Guerreiro',10), ('rogue','Ladino',8), ('wizard','Mago',6)
) as v(slug,name,hit_die)
where r.slug='srd-5-2-1'
on conflict (ruleset_id,slug) do update set name=excluded.name, hit_die=excluded.hit_die;

insert into public.dnd_class_levels(class_id, level, proficiency_bonus)
select c.id, level, case when level <= 4 then 2 when level <= 8 then 3 when level <= 12 then 4 when level <= 16 then 5 else 6 end
from public.dnd_classes c cross join generate_series(1,20) level
on conflict (class_id,level) do update set proficiency_bonus=excluded.proficiency_bonus;

insert into public.dnd_rule_entries(ruleset_id,kind,slug,name,summary,content,source_name,source_url,license,metadata)
select r.id, v.kind, v.slug, v.name, v.summary, v.content, 'SRD 5.2.1', r.source_url, 'CC-BY-4.0', v.metadata
from public.dnd_rulesets r
cross join (values
 ('rule','level-up','Subida de nível','A progressão aumenta o nível total do personagem e concede os benefícios da classe escolhida.','Ao subir de nível, escolha a classe que recebe o novo nível, determine o ganho de pontos de vida e aplique os benefícios indicados para aquele nível.','{"tags":["progressão","nível"]}'::jsonb),
 ('attribute','proficiency-bonus','Bônus de Proficiência','O bônus aumenta conforme o nível total do personagem.','O Grimório recalcula este bônus automaticamente nos patamares 5, 9, 13 e 17.','{"tags":["atributo","proficiência"]}'::jsonb),
 ('rule','hit-points-level-up','Pontos de Vida no Level-up','Cada novo nível aumenta os pontos de vida máximos.','Informe o ganho de PV definido pela classe e pelas regras adotadas na mesa antes de confirmar a progressão.','{"tags":["pv","progressão"]}'::jsonb)
) as v(kind,slug,name,summary,content,metadata)
where r.slug='srd-5-2-1'
on conflict (ruleset_id,kind,slug) do update set summary=excluded.summary, content=excluded.content, metadata=excluded.metadata;

create or replace function public.dnd_request_level_up(
  p_sheet_id uuid,
  p_class_id uuid,
  p_hp_gain smallint,
  p_expected_version bigint,
  p_idempotency_key uuid
) returns public.dnd_level_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sheet public.dnd_sheets%rowtype;
  v_settings public.dnd_table_settings%rowtype;
  v_class public.dnd_classes%rowtype;
  v_character_class public.dnd_character_classes%rowtype;
  v_is_gm boolean;
  v_can_edit boolean;
  v_status public.dnd_level_up_status;
  v_from_total smallint;
  v_from_class smallint;
  v_gains jsonb;
  v_new_data jsonb;
  v_result public.dnd_level_ups%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  if p_hp_gain < 0 then raise exception 'O ganho de PV não pode ser negativo.'; end if;

  select * into v_sheet from public.dnd_sheets where id=p_sheet_id for update;
  if not found then raise exception 'Ficha não encontrada.'; end if;
  select exists(select 1 from public.dnd_tables t where t.id=v_sheet.table_id and t.owner_id=auth.uid()) into v_is_gm;
  select v_is_gm or exists(
    select 1 from public.dnd_players p
    where p.id=v_sheet.player_id and p.table_id=v_sheet.table_id and p.active
      and not v_sheet.secret and lower(p.email)=lower(coalesce(auth.jwt()->>'email',''))
  ) into v_can_edit;
  if not v_can_edit then raise exception 'Ficha não encontrada ou sem acesso.'; end if;
  if v_sheet.version <> p_expected_version then raise exception 'A ficha mudou. Recarregue antes de subir de nível.'; end if;

  select * into v_settings from public.dnd_table_settings where table_id=v_sheet.table_id;
  select * into v_class from public.dnd_classes where id=p_class_id;
  if not found then raise exception 'Classe inválida.'; end if;
  if v_settings.level_up_policy='gm_only' and not v_is_gm then raise exception 'Somente o mestre pode iniciar o level-up nesta mesa.'; end if;

  select * into v_character_class from public.dnd_character_classes
  where sheet_id=p_sheet_id and class_id=p_class_id;
  v_from_total := coalesce((v_sheet.data->>'level')::smallint,1);
  v_from_class := coalesce(v_character_class.class_level,
    case when lower(coalesce(v_sheet.data->>'class',''))=lower(v_class.name) then v_from_total else 0 end);
  if v_from_total >= 20 then raise exception 'O personagem já está no nível máximo.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('type',g.grant_type,'name',e.name,'summary',e.summary,'quantity',g.quantity) order by e.name),'[]'::jsonb)
  into v_gains
  from public.dnd_class_levels cl
  left join public.dnd_level_grants g on g.class_level_id=cl.id
  left join public.dnd_rule_entries e on e.id=g.rule_entry_id
  where cl.class_id=p_class_id and cl.level=v_from_class+1 and g.id is not null;
  v_gains := jsonb_build_array(
    jsonb_build_object('type','level','name','Nível total','summary',format('Nível %s → %s',v_from_total,v_from_total+1)),
    jsonb_build_object('type','hit_points','name','Pontos de Vida','summary',format('+%s PV máximos',p_hp_gain)),
    jsonb_build_object('type','proficiency','name','Bônus de Proficiência','summary',format('+%s',case when v_from_total+1<=4 then 2 when v_from_total+1<=8 then 3 when v_from_total+1<=12 then 4 when v_from_total+1<=16 then 5 else 6 end))
  ) || v_gains;

  v_status := case when v_is_gm or v_settings.level_up_policy='player_free' then 'applied'::public.dnd_level_up_status else 'pending'::public.dnd_level_up_status end;

  insert into public.dnd_level_ups(idempotency_key,table_id,sheet_id,class_id,status,from_total_level,to_total_level,from_class_level,to_class_level,hp_gain,expected_sheet_version,gains,before_snapshot,decided_by,decided_at)
  values(p_idempotency_key,v_sheet.table_id,p_sheet_id,p_class_id,v_status,v_from_total,v_from_total+1,v_from_class,v_from_class+1,p_hp_gain,p_expected_version,v_gains,v_sheet.data,case when v_status='applied' then auth.uid() end,case when v_status='applied' then now() end)
  on conflict(idempotency_key) do nothing
  returning * into v_result;
  if not found then
    select * into v_result from public.dnd_level_ups where idempotency_key=p_idempotency_key and requested_by=auth.uid();
    if not found then raise exception 'Chave de idempotência já utilizada.'; end if;
    return v_result;
  end if;

  if v_status='applied' then
    insert into public.dnd_character_classes(sheet_id,class_id,class_level,is_primary)
    values(p_sheet_id,p_class_id,v_from_class+1,not exists(select 1 from public.dnd_character_classes cc where cc.sheet_id=p_sheet_id))
    on conflict(sheet_id,class_id) do update set class_level=excluded.class_level;
    v_new_data := jsonb_set(jsonb_set(jsonb_set(v_sheet.data,'{level}',to_jsonb(v_from_total+1),true),'{hp_max}',to_jsonb(coalesce((v_sheet.data->>'hp_max')::integer,0)+p_hp_gain),true),'{hp}',to_jsonb(coalesce((v_sheet.data->>'hp')::integer,0)+p_hp_gain),true);
    v_new_data := jsonb_set(v_new_data,'{proficiency}',to_jsonb(case when v_from_total+1<=4 then 2 when v_from_total+1<=8 then 3 when v_from_total+1<=12 then 4 when v_from_total+1<=16 then 5 else 6 end),true);
    update public.dnd_sheets set data=v_new_data where id=p_sheet_id and version=p_expected_version returning data into v_new_data;
    if not found then raise exception 'Conflito ao aplicar o level-up.'; end if;
    update public.dnd_level_ups set after_snapshot=v_new_data where id=v_result.id returning * into v_result;
  end if;
  return v_result;
end;
$$;

create or replace function public.dnd_decide_level_up(p_level_up_id uuid, p_approve boolean)
returns public.dnd_level_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.dnd_level_ups%rowtype;
  v_sheet public.dnd_sheets%rowtype;
  v_new_data jsonb;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.'; end if;
  select * into v_request from public.dnd_level_ups where id=p_level_up_id for update;
  if not found or v_request.status<>'pending' then raise exception 'Solicitação não encontrada ou já decidida.'; end if;
  if not exists(select 1 from public.dnd_tables t where t.id=v_request.table_id and t.owner_id=auth.uid()) then raise exception 'Somente o mestre pode decidir esta solicitação.'; end if;
  if not p_approve then
    update public.dnd_level_ups set status='rejected',decided_by=auth.uid(),decided_at=now() where id=p_level_up_id returning * into v_request;
    return v_request;
  end if;
  select * into v_sheet from public.dnd_sheets where id=v_request.sheet_id for update;
  if v_sheet.version<>v_request.expected_sheet_version then raise exception 'A ficha mudou desde a solicitação. Rejeite-a e crie uma nova.'; end if;
  insert into public.dnd_character_classes(sheet_id,class_id,class_level,is_primary)
  values(v_request.sheet_id,v_request.class_id,v_request.to_class_level,not exists(select 1 from public.dnd_character_classes cc where cc.sheet_id=v_request.sheet_id))
  on conflict(sheet_id,class_id) do update set class_level=excluded.class_level;
  v_new_data := jsonb_set(jsonb_set(jsonb_set(v_sheet.data,'{level}',to_jsonb(v_request.to_total_level),true),'{hp_max}',to_jsonb(coalesce((v_sheet.data->>'hp_max')::integer,0)+v_request.hp_gain),true),'{hp}',to_jsonb(coalesce((v_sheet.data->>'hp')::integer,0)+v_request.hp_gain),true);
  v_new_data := jsonb_set(v_new_data,'{proficiency}',to_jsonb(case when v_request.to_total_level<=4 then 2 when v_request.to_total_level<=8 then 3 when v_request.to_total_level<=12 then 4 when v_request.to_total_level<=16 then 5 else 6 end),true);
  update public.dnd_sheets set data=v_new_data where id=v_request.sheet_id and version=v_request.expected_sheet_version;
  if not found then raise exception 'Conflito ao aplicar o level-up.'; end if;
  update public.dnd_level_ups set status='applied',decided_by=auth.uid(),decided_at=now(),after_snapshot=v_new_data where id=p_level_up_id returning * into v_request;
  return v_request;
end;
$$;

revoke all on function public.dnd_request_level_up(uuid,uuid,smallint,bigint,uuid) from public, anon;
revoke all on function public.dnd_decide_level_up(uuid,boolean) from public, anon;
grant execute on function public.dnd_request_level_up(uuid,uuid,smallint,bigint,uuid) to authenticated;
grant execute on function public.dnd_decide_level_up(uuid,boolean) to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dnd_level_ups') then
      alter publication supabase_realtime add table public.dnd_level_ups;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dnd_table_settings') then
      alter publication supabase_realtime add table public.dnd_table_settings;
    end if;
  end if;
end $$;
