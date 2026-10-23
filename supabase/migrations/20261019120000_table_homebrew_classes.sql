-- Existing classes remain global. Homebrew subclasses inherit their class scope.
alter table public.dnd_classes add column table_id uuid references public.dnd_tables(id) on delete restrict;
alter table public.dnd_classes add column description text not null default '';
alter table public.dnd_subclasses add column description text not null default '';
create index dnd_classes_table_id_idx on public.dnd_classes(table_id) where table_id is not null;
create unique index dnd_homebrew_class_name_unique on public.dnd_classes(table_id,lower(btrim(name))) where table_id is not null;
create unique index dnd_homebrew_subclass_name_unique on public.dnd_subclasses(class_id,lower(btrim(name))) where slug like 'homebrew-%';

drop policy "authenticated read classes" on public.dnd_classes;
create policy "read available classes" on public.dnd_classes for select to authenticated
using(table_id is null or public.dnd_is_table_member(table_id));
drop policy "read subclasses" on public.dnd_subclasses;
create policy "read available subclasses" on public.dnd_subclasses for select to authenticated
using(exists(select 1 from public.dnd_classes c where c.id=class_id));
drop policy "authenticated read class levels" on public.dnd_class_levels;
create policy "read available class levels" on public.dnd_class_levels for select to authenticated
using(exists(select 1 from public.dnd_classes c where c.id=class_id));
drop policy "authenticated read level grants" on public.dnd_level_grants;
create policy "read available level grants" on public.dnd_level_grants for select to authenticated
using(exists(select 1 from public.dnd_class_levels l where l.id=class_level_id));
drop policy "read subclass levels" on public.dnd_subclass_levels;
create policy "read available subclass levels" on public.dnd_subclass_levels for select to authenticated
using(exists(select 1 from public.dnd_subclasses s where s.id=subclass_id));
drop policy "read subclass grants" on public.dnd_subclass_level_grants;
create policy "read available subclass grants" on public.dnd_subclass_level_grants for select to authenticated
using(exists(select 1 from public.dnd_subclass_levels l where l.id=subclass_level_id));

create function public.dnd_create_homebrew_class(
 p_table_id uuid, p_name text, p_description text, p_hit_die smallint,
 p_subclass_level smallint, p_subclasses jsonb
) returns public.dnd_classes language plpgsql security definer set search_path='' as $$
declare v_class public.dnd_classes; v_ruleset uuid; v_sub jsonb; v_name text; v_sub_id uuid;
begin
 if auth.uid() is null or not public.dnd_is_gm(p_table_id) then
  raise exception 'Somente o mestre pode cadastrar classes nesta mesa.';
 end if;
 -- Serialize same-table creates, including differently-cased names and retries.
 perform 1 from public.dnd_tables where id=p_table_id for update;
 p_name:=btrim(p_name); p_description:=btrim(coalesce(p_description,''));
 if p_name is null or length(p_name) not between 1 and 100 or length(p_description)>5000 then
  raise exception 'Informe um nome de até 100 caracteres e descrição de até 5000.';
 end if;
 if p_hit_die is null or p_hit_die not in (6,8,10,12) or p_subclass_level is null or p_subclass_level not between 1 and 20 then
  raise exception 'Dado de vida ou nível de subclasse inválido.';
 end if;
 if exists(select 1 from public.dnd_classes where (table_id is null or table_id=p_table_id) and lower(btrim(name))=lower(p_name)) then
  raise exception 'Já existe uma classe com este nome nesta mesa.';
 end if;
 if p_subclasses is null or jsonb_typeof(p_subclasses)<>'array' then raise exception 'Informe as subclasses.'; end if;
 if jsonb_array_length(p_subclasses) not between 1 and 100 then raise exception 'Cadastre de 1 a 100 subclasses.'; end if;
 select id into v_ruleset from public.dnd_rulesets where active order by created_at,id limit 1;
 if not found then raise exception 'Catálogo de regras indisponível.'; end if;
 insert into public.dnd_classes(ruleset_id,slug,name,hit_die,subclass_level,table_id,description)
 values(v_ruleset,'homebrew-'||gen_random_uuid(),p_name,p_hit_die,p_subclass_level,p_table_id,p_description) returning * into v_class;
 insert into public.dnd_class_levels(class_id,level,proficiency_bonus)
 select v_class.id,n,(2+(n-1)/4)::smallint from generate_series(1,20) n;
 for v_sub in select value from jsonb_array_elements(p_subclasses) loop
  if jsonb_typeof(v_sub)<>'object' or jsonb_typeof(v_sub->'name') is distinct from 'string'
    or (v_sub ? 'description' and jsonb_typeof(v_sub->'description') is distinct from 'string') then
   raise exception 'Formato de subclasse inválido.';
  end if;
  v_name:=btrim(v_sub->>'name');
  if length(v_name) not between 1 and 100 or length(btrim(coalesce(v_sub->>'description','')))>5000 then
   raise exception 'Nome ou descrição de subclasse inválido.';
  end if;
  if exists(select 1 from public.dnd_subclasses where class_id=v_class.id and lower(btrim(name))=lower(v_name)) then
   raise exception 'Não repita nomes de subclasses.';
  end if;
  insert into public.dnd_subclasses(class_id,slug,name,description)
  values(v_class.id,'homebrew-'||gen_random_uuid(),v_name,btrim(coalesce(v_sub->>'description',''))) returning id into v_sub_id;
  insert into public.dnd_subclass_levels(subclass_id,class_level) select v_sub_id,n from generate_series(p_subclass_level,20) n;
 end loop;
 return v_class;
end;
$$;
revoke all on function public.dnd_create_homebrew_class(uuid,text,text,smallint,smallint,jsonb) from public,anon;
grant execute on function public.dnd_create_homebrew_class(uuid,text,text,smallint,smallint,jsonb) to authenticated;

create function public.dnd_add_homebrew_subclass(p_class_id uuid,p_name text,p_description text)
returns public.dnd_subclasses language plpgsql security definer set search_path='' as $$
declare v_class public.dnd_classes; v_sub public.dnd_subclasses;
begin
 select * into v_class from public.dnd_classes where id=p_class_id for update;
 if auth.uid() is null or v_class.table_id is null or not public.dnd_is_gm(v_class.table_id) then
  raise exception 'Somente o mestre pode adicionar subclasses homebrew nesta mesa.';
 end if;
 p_name:=btrim(p_name); p_description:=btrim(coalesce(p_description,''));
 if p_name is null or length(p_name) not between 1 and 100 or length(p_description)>5000 then raise exception 'Nome ou descrição de subclasse inválido.'; end if;
 if exists(select 1 from public.dnd_subclasses where class_id=p_class_id and lower(btrim(name))=lower(p_name)) then raise exception 'Já existe uma subclasse com este nome.'; end if;
 insert into public.dnd_subclasses(class_id,slug,name,description)
 values(p_class_id,'homebrew-'||gen_random_uuid(),p_name,p_description) returning * into v_sub;
 insert into public.dnd_subclass_levels(subclass_id,class_level) select v_sub.id,n from generate_series(v_class.subclass_level,20) n;
 return v_sub;
end;
$$;
revoke all on function public.dnd_add_homebrew_subclass(uuid,text,text) from public,anon;
grant execute on function public.dnd_add_homebrew_subclass(uuid,text,text) to authenticated;

-- Definer is necessary: RPCs bypass RLS, and even hidden homebrews must not be
-- smuggled into another table by changing a sheet's class name directly.
create function public.dnd_guard_homebrew_sheet_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_name text;
begin
 if tg_op='UPDATE' then
  if new.table_id=old.table_id and new.data->>'class' is not distinct from old.data->>'class' then return new; end if;
 end if;
 v_name:=lower(btrim(coalesce(new.data->>'class','')));
 if exists(select 1 from public.dnd_classes where lower(btrim(name))=v_name)
  and not exists(select 1 from public.dnd_classes where lower(btrim(name))=v_name and (table_id is null or table_id=new.table_id)) then
  raise exception 'Esta classe homebrew pertence a outra mesa.';
 end if;
 if exists(select 1 from public.dnd_character_classes cc join public.dnd_classes c on c.id=cc.class_id
    where cc.sheet_id=new.id and c.table_id is not null and c.table_id<>new.table_id)
  or exists(select 1 from public.dnd_level_ups l join public.dnd_classes c on c.id=l.class_id
    where l.sheet_id=new.id and c.table_id is not null and c.table_id<>new.table_id) then
  raise exception 'A progressão da ficha contém uma classe de outra mesa.';
 end if;
 return new;
end;
$$;
revoke all on function public.dnd_guard_homebrew_sheet_scope() from public,anon,authenticated;
create trigger dnd_sheets_homebrew_scope before insert or update on public.dnd_sheets
for each row execute function public.dnd_guard_homebrew_sheet_scope();

create function public.dnd_guard_homebrew_progression_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_table uuid; v_scope uuid;
begin
 select table_id into v_table from public.dnd_sheets where id=new.sheet_id;
 if not found then raise exception 'Ficha inválida.'; end if;
 select table_id into v_scope from public.dnd_classes where id=new.class_id;
 if not found or (v_scope is not null and v_scope<>v_table) then raise exception 'Classe indisponível nesta mesa.'; end if;
 if tg_table_name='dnd_level_ups' then
  if new.table_id is distinct from v_table then raise exception 'Mesa da solicitação difere da ficha.'; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.dnd_guard_homebrew_progression_scope() from public,anon,authenticated;
create trigger dnd_character_classes_homebrew_scope before insert or update on public.dnd_character_classes
for each row execute function public.dnd_guard_homebrew_progression_scope();
create trigger dnd_level_ups_homebrew_scope before insert or update on public.dnd_level_ups
for each row execute function public.dnd_guard_homebrew_progression_scope();

-- Optional realtime support; installations without the publication keep working.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime' and not puballtables) then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dnd_classes') then
   alter publication supabase_realtime add table public.dnd_classes;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dnd_subclasses') then
   alter publication supabase_realtime add table public.dnd_subclasses;
  end if;
 end if;
end $$;
-- Rollback: restore prior read policies, remove these triggers/RPCs, and remove
-- new columns only after homebrew-linked sheets/history are explicitly migrated.
-- Never drop scoped classes automatically: character history uses RESTRICT FKs.
