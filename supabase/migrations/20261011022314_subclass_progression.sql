-- Subclasses belong to a class; progression uses CLASS level, never total level.
alter table public.dnd_classes add column subclass_level smallint not null default 3 check(subclass_level between 1 and 20);
create table public.dnd_subclasses(
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.dnd_classes(id),
 slug text not null,
 name text not null,
 unique(class_id,slug), unique(id,class_id)
);
create table public.dnd_subclass_levels(
 id uuid primary key default gen_random_uuid(),
 subclass_id uuid not null references public.dnd_subclasses(id),
 class_level smallint not null check(class_level between 1 and 20),
 unique(subclass_id,class_level)
);
create table public.dnd_subclass_level_grants(
 id uuid primary key default gen_random_uuid(),
 subclass_level_id uuid not null references public.dnd_subclass_levels(id),
 rule_entry_id uuid not null references public.dnd_rule_entries(id),
 unique(subclass_level_id,rule_entry_id)
);
alter table public.dnd_character_classes add column subclass_id uuid,
 add foreign key(subclass_id,class_id) references public.dnd_subclasses(id,class_id);
alter table public.dnd_level_ups add column subclass_id uuid,
 add foreign key(subclass_id,class_id) references public.dnd_subclasses(id,class_id);
alter table public.dnd_subclasses enable row level security;
alter table public.dnd_subclass_levels enable row level security;
alter table public.dnd_subclass_level_grants enable row level security;
create policy "read subclasses" on public.dnd_subclasses for select to authenticated using(true);
create policy "read subclass levels" on public.dnd_subclass_levels for select to authenticated using(true);
create policy "read subclass grants" on public.dnd_subclass_level_grants for select to authenticated using(true);
revoke all on public.dnd_subclasses,public.dnd_subclass_levels,public.dnd_subclass_level_grants from anon,authenticated;
grant select on public.dnd_subclasses,public.dnd_subclass_levels,public.dnd_subclass_level_grants to authenticated;
create index on public.dnd_subclass_level_grants(rule_entry_id);
create index on public.dnd_character_classes(subclass_id,class_id);
create index on public.dnd_level_ups(subclass_id,class_id);
insert into public.dnd_subclasses(class_id,slug,name)
select c.id,v.slug,v.name from public.dnd_classes c join public.dnd_rulesets r on r.id=c.ruleset_id
join (values ('cleric','life-domain','Domínio da Vida'),('fighter','champion','Campeão'),('rogue','thief','Ladrão'),('wizard','evoker','Evocador')) v(class_slug,slug,name) on c.slug=v.class_slug
where r.slug='srd-5-2-1';
insert into public.dnd_subclass_levels(subclass_id,class_level)
select s.id,n from public.dnd_subclasses s cross join generate_series(3,20) n;
create or replace function public.dnd_request_level_up(
  p_sheet_id uuid,
  p_class_id uuid,
  p_hp_gain smallint,
  p_expected_version bigint,
  p_idempotency_key uuid,
  p_subclass_id uuid
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
  v_subclass uuid;
  v_subclass_name text;
  v_subclass_gains jsonb;
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
  v_subclass := coalesce(v_character_class.subclass_id,p_subclass_id);
  if v_character_class.subclass_id is not null and p_subclass_id is not null and p_subclass_id<>v_character_class.subclass_id then
    raise exception 'A subclasse já foi escolhida e não pode ser trocada neste fluxo.';
  end if;
  if v_from_class+1 >= v_class.subclass_level and v_subclass is null then raise exception 'Escolha uma subclasse para continuar.'; end if;
  if v_subclass is not null then
    if v_from_class+1 < v_class.subclass_level then raise exception 'Nível insuficiente para escolher subclasse.'; end if;
    select name into v_subclass_name from public.dnd_subclasses where id=v_subclass and class_id=p_class_id;
    if not found then raise exception 'A subclasse não pertence à classe escolhida.'; end if;
  end if;
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

  select coalesce(jsonb_agg(jsonb_build_object('type','subclass_feature','entry_id',e.id,'name',e.name,'summary',e.summary)),'[]'::jsonb)
    into v_subclass_gains
    from public.dnd_subclass_levels sl
    join public.dnd_subclass_level_grants g on g.subclass_level_id=sl.id
    join public.dnd_rule_entries e on e.id=g.rule_entry_id
    where sl.subclass_id=v_subclass and sl.class_level<=v_from_class+1
      and (v_character_class.subclass_id is null or sl.class_level>v_from_class);
  v_gains := v_gains || v_subclass_gains;
  if v_subclass is not null then v_gains := v_gains || jsonb_build_array(jsonb_build_object('type','subclass','name',v_subclass_name,'summary','Subclasse selecionada')); end if;
  v_status := case when v_is_gm or v_settings.level_up_policy='player_free' then 'applied'::public.dnd_level_up_status else 'pending'::public.dnd_level_up_status end;

  insert into public.dnd_level_ups(subclass_id,idempotency_key,table_id,sheet_id,class_id,status,from_total_level,to_total_level,from_class_level,to_class_level,hp_gain,expected_sheet_version,gains,before_snapshot,decided_by,decided_at)
  values(v_subclass,p_idempotency_key,v_sheet.table_id,p_sheet_id,p_class_id,v_status,v_from_total,v_from_total+1,v_from_class,v_from_class+1,p_hp_gain,p_expected_version,v_gains,v_sheet.data,case when v_status='applied' then auth.uid() end,case when v_status='applied' then now() end)
  on conflict(idempotency_key) do nothing
  returning * into v_result;
  if not found then
    select * into v_result from public.dnd_level_ups where idempotency_key=p_idempotency_key and requested_by=auth.uid();
    if not found then raise exception 'Chave de idempotência já utilizada.'; end if;
    return v_result;
  end if;

  if v_status='applied' then
    insert into public.dnd_character_classes(sheet_id,class_id,subclass_id,class_level,is_primary)
    values(p_sheet_id,p_class_id,v_subclass,v_from_class+1,not exists(select 1 from public.dnd_character_classes cc where cc.sheet_id=p_sheet_id))
    on conflict(sheet_id,class_id) do update set class_level=excluded.class_level,subclass_id=excluded.subclass_id;
    v_new_data := jsonb_set(jsonb_set(jsonb_set(v_sheet.data,'{level}',to_jsonb(v_from_total+1),true),'{hp_max}',to_jsonb(coalesce((v_sheet.data->>'hp_max')::integer,0)+p_hp_gain),true),'{hp}',to_jsonb(coalesce((v_sheet.data->>'hp')::integer,0)+p_hp_gain),true);
    v_new_data := jsonb_set(v_new_data,'{proficiency}',to_jsonb(case when v_from_total+1<=4 then 2 when v_from_total+1<=8 then 3 when v_from_total+1<=12 then 4 when v_from_total+1<=16 then 5 else 6 end),true);
    v_new_data := jsonb_set(v_new_data,'{subclasses}',coalesce(v_new_data->'subclasses','{}'::jsonb) || jsonb_build_object(p_class_id::text,v_subclass_name),true);
    if exists(select 1 from public.dnd_character_classes where sheet_id=p_sheet_id and class_id=p_class_id and is_primary) then
      v_new_data := jsonb_set(v_new_data,'{subclass}',to_jsonb(coalesce(v_subclass_name,'')),true);
    end if;
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
  if v_request.to_class_level >= (select subclass_level from public.dnd_classes where id=v_request.class_id) and v_request.subclass_id is null then raise exception 'Solicitação antiga sem subclasse. Rejeite e solicite novamente.'; end if;
  insert into public.dnd_character_classes(sheet_id,class_id,subclass_id,class_level,is_primary)
  values(v_request.sheet_id,v_request.class_id,v_request.subclass_id,v_request.to_class_level,not exists(select 1 from public.dnd_character_classes cc where cc.sheet_id=v_request.sheet_id))
  on conflict(sheet_id,class_id) do update set class_level=excluded.class_level,subclass_id=excluded.subclass_id;
  v_new_data := jsonb_set(jsonb_set(jsonb_set(v_sheet.data,'{level}',to_jsonb(v_request.to_total_level),true),'{hp_max}',to_jsonb(coalesce((v_sheet.data->>'hp_max')::integer,0)+v_request.hp_gain),true),'{hp}',to_jsonb(coalesce((v_sheet.data->>'hp')::integer,0)+v_request.hp_gain),true);
  v_new_data := jsonb_set(v_new_data,'{proficiency}',to_jsonb(case when v_request.to_total_level<=4 then 2 when v_request.to_total_level<=8 then 3 when v_request.to_total_level<=12 then 4 when v_request.to_total_level<=16 then 5 else 6 end),true);
  v_new_data := jsonb_set(v_new_data,'{subclasses}',coalesce(v_new_data->'subclasses','{}'::jsonb) || jsonb_build_object(v_request.class_id::text,(select name from public.dnd_subclasses where id=v_request.subclass_id)),true);
  if exists(select 1 from public.dnd_character_classes where sheet_id=v_request.sheet_id and class_id=v_request.class_id and is_primary) then
    v_new_data := jsonb_set(v_new_data,'{subclass}',to_jsonb(coalesce((select name from public.dnd_subclasses where id=v_request.subclass_id),'')),true);
  end if;
  update public.dnd_sheets set data=v_new_data where id=v_request.sheet_id and version=v_request.expected_sheet_version;
  if not found then raise exception 'Conflito ao aplicar o level-up.'; end if;
  update public.dnd_level_ups set status='applied',decided_by=auth.uid(),decided_at=now(),after_snapshot=v_new_data where id=p_level_up_id returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.dnd_request_level_up(p_sheet_id uuid,p_class_id uuid,p_hp_gain smallint,p_expected_version bigint,p_idempotency_key uuid)
returns public.dnd_level_ups language sql security invoker set search_path='' as $$
 select public.dnd_request_level_up(p_sheet_id,p_class_id,p_hp_gain,p_expected_version,p_idempotency_key,null::uuid);
$$;
revoke all on function public.dnd_request_level_up(uuid,uuid,smallint,bigint,uuid,uuid) from public,anon;
grant execute on function public.dnd_request_level_up(uuid,uuid,smallint,bigint,uuid,uuid) to authenticated;
