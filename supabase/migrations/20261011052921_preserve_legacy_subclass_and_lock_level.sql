-- Preserve known legacy subclasses; do not rewrite or level up existing sheets.
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
  v_legacy_subclass uuid;
  v_legacy_name text;
  v_match_count integer;
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
    case when lower(btrim(coalesce(v_sheet.data->>'class','')))=lower(v_class.name) then v_from_total else 0 end);

  if v_from_total<1 or v_from_class<1 then raise exception 'A progressão começa no nível 1. Revise o cadastro da classe.'; end if;
  if exists(select 1 from public.dnd_character_classes where sheet_id=p_sheet_id)
    and (select sum(class_level) from public.dnd_character_classes where sheet_id=p_sheet_id)<>v_from_total then
    raise exception 'Nível da ficha diverge do histórico de classes. O mestre precisa revisar antes de continuar.';
  end if;
  -- Legacy text is authoritative only for the primary class and an unambiguous catalog match.
  if v_character_class.subclass_id is null and
    (v_character_class.is_primary or (v_character_class.id is null and not exists(select 1 from public.dnd_character_classes where sheet_id=p_sheet_id))) then
    v_legacy_name := nullif(btrim(v_sheet.data->>'subclass'),'');
    if v_legacy_name is not null then
      select count(*) into v_match_count from public.dnd_subclasses where class_id=p_class_id and lower(btrim(name))=lower(v_legacy_name);
      if v_match_count<>1 or v_from_class<v_class.subclass_level then
        raise exception 'A subclasse preenchida não pôde ser vinculada com segurança. Peça ao mestre para revisar o cadastro.';
      end if;
      select id into v_legacy_subclass from public.dnd_subclasses where class_id=p_class_id and lower(btrim(name))=lower(v_legacy_name);
      if p_subclass_id is not null and p_subclass_id<>v_legacy_subclass then
        raise exception 'A subclasse já registrada na ficha deve ser mantida.';
      end if;
    end if;
  end if;
  v_subclass := coalesce(v_character_class.subclass_id,v_legacy_subclass,p_subclass_id);
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
      and ((v_character_class.subclass_id is null and v_legacy_subclass is null) or sl.class_level>v_from_class);
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


-- Clients create at level 1 and cannot change the level through direct sheet writes.
-- SECURITY INVOKER preserves the RPC's elevated role but not a caller-supplied setting.
create or replace function public.dnd_guard_sheet_level()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_new integer; v_old integer; v_owner name;
begin
 v_new := coalesce((new.data->>'level')::integer,1);
 if v_new<1 or v_new>20 then raise exception 'O nível deve estar entre 1 e 20.'; end if;
 select pg_catalog.pg_get_userbyid(p.proowner) into v_owner from pg_catalog.pg_proc p
 where p.oid='public.dnd_request_level_up(uuid,uuid,smallint,bigint,uuid,uuid)'::regprocedure;
 if tg_op='INSERT' then
   if current_user<>v_owner and v_new<>1 then raise exception 'Novas fichas começam no nível 1.'; end if;
   new.data:=jsonb_set(new.data,'{level}',to_jsonb(v_new));
   return new;
 end if;
 v_old:=coalesce((old.data->>'level')::integer,1);
 if (new.data->>'level') is distinct from (old.data->>'level') then
   if current_user<>v_owner then raise exception 'O nível só pode ser alterado pelo fluxo de level-up.'; end if;
   if v_new<>v_old+1 or not exists(
     select 1 from public.dnd_level_ups l where l.sheet_id=old.id
       and l.expected_sheet_version=old.version and l.from_total_level=v_old
       and l.to_total_level=v_new and l.status in ('pending','applied')
   ) or v_new is distinct from (select sum(class_level)::integer from public.dnd_character_classes where sheet_id=old.id) then
     raise exception 'Alteração de nível sem progressão válida.';
   end if;
 end if;
 return new;
end;
$$;
revoke all on function public.dnd_guard_sheet_level() from public,anon,authenticated;
create trigger dnd_level_guard before insert or update on public.dnd_sheets
for each row execute function public.dnd_guard_sheet_level();
