-- Protect catalog identity and GM review without changing existing sheet data.
create or replace function public.dnd_guard_class_identity()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
 v_old text := coalesce(old.data->>'class','');
 v_new text := coalesce(new.data->>'class','');
 v_gm boolean;
 v_primary text;
 v_subclass text;
 v_subclasses jsonb;
begin
 select exists(select 1 from public.dnd_tables t where t.id=old.table_id and t.owner_id=auth.uid()) into v_gm;
 select c.name,s.name into v_primary,v_subclass from public.dnd_character_classes cc
 join public.dnd_classes c on c.id=cc.class_id
 left join public.dnd_subclasses s on s.id=cc.subclass_id
 where cc.sheet_id=old.id and cc.is_primary;
 if new.data->'class_review' is distinct from old.data->'class_review' then
   if not v_gm then raise exception 'Somente o mestre pode avaliar a classe.'; end if;
   if coalesce(new.data->'class_review'->>'decision','') not in ('keep','map')
      or (new.data->'class_review'->>'name') is distinct from v_new then
     raise exception 'Avaliação de classe inválida.';
   end if;
   if new.data->'class_review'->>'decision'='keep' and v_new<>v_old then
     raise exception 'Manter a classe não pode alterar seu nome.';
   end if;
   if new.data->'class_review'->>'decision'='map' and not exists(select 1 from public.dnd_classes where name=v_new) then
     raise exception 'Selecione uma classe cadastrada.';
   end if;
   new.data := jsonb_set(new.data,'{class_review}',(new.data->'class_review')||jsonb_build_object('reviewed_by',auth.uid(),'reviewed_at',now(),'original_name',v_old));
 end if;
 if v_new<>v_old then
   if exists(select 1 from public.dnd_level_ups where sheet_id=old.id and status='pending') then
     raise exception 'Decida a solicitação pendente antes de alterar a classe.';
   end if;
   if v_primary is not null and v_new<>v_primary then raise exception 'A classe está vinculada ao histórico de progressão.'; end if;
   if btrim(v_old)<>'' and not exists(select 1 from public.dnd_classes where lower(name)=lower(btrim(v_old))) and not v_gm then
     raise exception 'Classe desconhecida: aguarde a avaliação do mestre.';
   end if;
   if not exists(select 1 from public.dnd_classes where name=v_new) then raise exception 'Selecione uma classe cadastrada.'; end if;
 end if;
 -- The level-up RPC writes normalized subclass links before updating the sheet.
 if new.data->>'subclass' is distinct from old.data->>'subclass' then
   if coalesce(new.data->>'subclass','')<>coalesce(v_subclass,'') then
     raise exception 'A subclasse só pode ser definida pelo fluxo de level-up.';
   end if;
 end if;
 if new.data->'subclasses' is distinct from old.data->'subclasses' then
   select coalesce(jsonb_object_agg(cc.class_id::text,s.name),'{}'::jsonb) into v_subclasses
   from public.dnd_character_classes cc left join public.dnd_subclasses s on s.id=cc.subclass_id where cc.sheet_id=old.id;
   if new.data->'subclasses' is distinct from v_subclasses then raise exception 'Subclasses devem corresponder à progressão registrada.'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.dnd_guard_class_identity() from public,anon,authenticated;
create trigger dnd_sheets_class_identity before update on public.dnd_sheets
for each row execute function public.dnd_guard_class_identity();

-- RPC requests cannot silently turn an unknown class into a new multiclass.
create or replace function public.dnd_guard_progression_class()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_name text;
begin
 select data->>'class' into v_name from public.dnd_sheets where id=new.sheet_id;
 if not exists(select 1 from public.dnd_classes where lower(name)=lower(btrim(v_name))) then
   raise exception 'Classe sem catálogo: o mestre deve avaliar e cadastrar a progressão antes do level-up.';
 end if;
 if exists(select 1 from public.dnd_character_classes where sheet_id=new.sheet_id) then
   if not exists(select 1 from public.dnd_character_classes where sheet_id=new.sheet_id and class_id=new.class_id) then
     raise exception 'Selecione uma classe já vinculada ao personagem.';
   end if;
 elsif not exists(select 1 from public.dnd_classes where id=new.class_id and lower(name)=lower(btrim(v_name))) then
   raise exception 'A classe do level-up deve corresponder à ficha.';
 end if;
 return new;
end;
$$;
revoke all on function public.dnd_guard_progression_class() from public,anon,authenticated;
create trigger dnd_level_ups_class_identity before insert on public.dnd_level_ups
for each row execute function public.dnd_guard_progression_class();
