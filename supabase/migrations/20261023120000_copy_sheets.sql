-- Rollback: drop function public.dnd_copy_sheet(uuid,text); existing copies are ordinary sheets and remain intact.
create or replace function public.dnd_copy_sheet(p_sheet_id uuid,p_name text)
returns public.dnd_sheets language plpgsql security definer set search_path='' as $$
declare source public.dnd_sheets; copied public.dnd_sheets;
begin
 if auth.uid() is null then raise sqlstate '42501' using message='Somente o mestre pode copiar fichas.'; end if;
 select s.* into source from public.dnd_sheets s where s.id=p_sheet_id for update;
 if not found then raise sqlstate 'P0002' using message='Ficha não encontrada.'; end if;
 if not exists(select 1 from public.dnd_tables t where t.id=source.table_id and t.owner_id=auth.uid()) then
  raise sqlstate '42501' using message='Somente o mestre desta mesa pode copiar fichas.';
 end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 150 then
  raise sqlstate '22023' using message='Informe um nome entre 1 e 150 caracteres.';
 end if;
 insert into public.dnd_sheets(table_id,player_id,name,kind,secret,archived,data)
 values(source.table_id,source.player_id,btrim(p_name),source.kind,source.secret,false,source.data)
 returning * into copied;
 insert into public.dnd_character_classes(sheet_id,class_id,class_level,is_primary,subclass_id)
 select copied.id,class_id,class_level,is_primary,subclass_id from public.dnd_character_classes where sheet_id=source.id;
 return copied;
end;
$$;
revoke all on function public.dnd_copy_sheet(uuid,text) from public,anon;
grant execute on function public.dnd_copy_sheet(uuid,text) to authenticated;
