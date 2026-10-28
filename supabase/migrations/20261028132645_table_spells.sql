-- Table-scoped spells. Rollback requires dropping the two RPCs and this table;
-- doing so deletes homebrew spell data and should only follow an explicit backup.
create table public.dnd_table_spells (
 id uuid primary key default gen_random_uuid(),
 table_id uuid not null references public.dnd_tables(id) on delete cascade,
 author_id uuid not null references auth.users(id),
 name text not null check (length(btrim(name)) between 1 and 100),
 spell_level smallint not null check (spell_level between 0 and 9),
 classes uuid[] not null check (cardinality(classes) between 1 and 100),
 description text not null check (length(btrim(description)) between 1 and 10000),
 casting_time text not null default '' check (length(casting_time)<=200),
 spell_range text not null default '' check (length(spell_range)<=200),
 components text not null default '' check (length(components)<=500),
 duration text not null default '' check (length(duration)<=200),
 school text not null default '' check (length(school)<=100),
 status text not null check (status in ('pending','approved','rejected')),
 decided_by uuid references auth.users(id), decided_at timestamptz,
 created_at timestamptz not null default now(),
 check ((status='pending' and decided_by is null and decided_at is null) or
        (status in ('approved','rejected') and decided_by is not null and decided_at is not null))
);
create index dnd_table_spells_table_status_idx on public.dnd_table_spells(table_id,status,created_at desc);
alter table public.dnd_table_spells enable row level security;
revoke all on public.dnd_table_spells from public,anon,authenticated;
grant select on public.dnd_table_spells to authenticated;
create policy "members read table spells" on public.dnd_table_spells for select to authenticated
 using (public.dnd_is_table_member(table_id) and
   (status='approved' or author_id=(select auth.uid()) or public.dnd_is_gm(table_id)));

create function public.dnd_create_table_spell(p_table_id uuid,p_payload jsonb)
returns public.dnd_table_spells language plpgsql security definer set search_path='' as $$
declare r public.dnd_table_spells; v_classes uuid[]; v_gm boolean; item jsonb; key text;
begin
 if auth.uid() is null or not public.dnd_is_table_member(p_table_id) then
  raise exception 'Você não participa desta mesa.';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Dados da magia inválidos.'; end if;
 if jsonb_typeof(p_payload->'name') is distinct from 'string' or
    jsonb_typeof(p_payload->'description') is distinct from 'string' or
    jsonb_typeof(p_payload->'spell_level') is distinct from 'number' or
    coalesce(p_payload->>'spell_level','') !~ '^[0-9]$' or
    jsonb_typeof(p_payload->'classes') is distinct from 'array' then
  raise exception 'Informe nome, descrição, círculo e classes válidos.';
 end if;
 if jsonb_array_length(p_payload->'classes') not between 1 and 100 then raise exception 'Selecione ao menos uma classe.'; end if;
 foreach key in array array['casting_time','spell_range','components','duration','school'] loop
  if p_payload ? key and jsonb_typeof(p_payload->key) is distinct from 'string' then raise exception 'Campo de magia inválido.'; end if;
 end loop;
 for item in select value from jsonb_array_elements(p_payload->'classes') loop
  if jsonb_typeof(item) is distinct from 'string' or (item#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Classe inválida.'; end if;
 end loop;
 select array_agg(distinct (value#>>'{}')::uuid) into v_classes from jsonb_array_elements(p_payload->'classes');
 if exists(select 1 from unnest(v_classes) x(id) where not exists
   (select 1 from public.dnd_classes c where c.id=x.id and (c.table_id is null or c.table_id=p_table_id))) then
  raise exception 'Classe indisponível nesta mesa.';
 end if;
 v_gm:=public.dnd_is_gm(p_table_id);
 insert into public.dnd_table_spells(table_id,author_id,name,spell_level,classes,description,casting_time,spell_range,components,duration,school,status,decided_by,decided_at)
 values(p_table_id,auth.uid(),btrim(p_payload->>'name'),(p_payload->>'spell_level')::smallint,v_classes,btrim(p_payload->>'description'),
 btrim(coalesce(p_payload->>'casting_time','')),btrim(coalesce(p_payload->>'spell_range','')),
 btrim(coalesce(p_payload->>'components','')),btrim(coalesce(p_payload->>'duration','')),btrim(coalesce(p_payload->>'school','')),
 case when v_gm then 'approved' else 'pending' end,case when v_gm then auth.uid() else null end,case when v_gm then now() else null end)
 returning * into r;
 return r;
end $$;
revoke all on function public.dnd_create_table_spell(uuid,jsonb) from public,anon;
grant execute on function public.dnd_create_table_spell(uuid,jsonb) to authenticated;

create function public.dnd_review_table_spell(p_spell_id uuid,p_approve boolean)
returns public.dnd_table_spells language plpgsql security definer set search_path='' as $$
declare r public.dnd_table_spells;
begin
 if auth.uid() is null or p_approve is null then raise exception 'Decisão inválida.'; end if;
 select * into r from public.dnd_table_spells where id=p_spell_id for update;
 if not found or not public.dnd_is_gm(r.table_id) then raise exception 'Somente o mestre pode revisar esta magia.'; end if;
 if r.status<>'pending' then raise exception 'Esta magia já foi revisada.'; end if;
 update public.dnd_table_spells set status=case when p_approve then 'approved' else 'rejected' end,
  decided_by=auth.uid(),decided_at=now() where id=p_spell_id returning * into r;
 return r;
end $$;
revoke all on function public.dnd_review_table_spell(uuid,boolean) from public,anon;
grant execute on function public.dnd_review_table_spell(uuid,boolean) to authenticated;
