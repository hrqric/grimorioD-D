-- Revealed bosses expose only this projection. Hidden bosses have no public row.
-- Rollback: drop trigger dnd_sync_boss_bar on public.dnd_sheets; drop the three
-- functions below; drop public.dnd_boss_bars (presentation only; sheets survive).
create table public.dnd_boss_bars(
 sheet_id uuid primary key references public.dnd_sheets(id) on delete cascade,
 table_id uuid not null references public.dnd_tables(id) on delete cascade,
 name text not null check(length(name) between 1 and 150),
 hp numeric not null check(hp>=0 and hp<='1e100'::numeric),
 hp_max numeric not null check(hp_max>0 and hp_max<='1e100'::numeric),
 updated_at timestamptz not null default now(),
 check(hp<=hp_max)
);
create index dnd_boss_bars_table_idx on public.dnd_boss_bars(table_id);
alter table public.dnd_boss_bars enable row level security;
create policy "members read revealed bosses" on public.dnd_boss_bars for select to authenticated
 using(public.dnd_is_table_member(table_id));
revoke all on public.dnd_boss_bars from public,anon,authenticated;
grant select on public.dnd_boss_bars to authenticated;

create or replace function public.dnd_set_boss_visibility(p_sheet_id uuid,p_visible boolean,p_expected_version bigint)
returns void language plpgsql security definer set search_path='' as $$
declare s public.dnd_sheets; current_hp numeric; maximum_hp numeric;
begin
 select * into s from public.dnd_sheets where id=p_sheet_id for update;
 if not found or auth.uid() is null or not public.dnd_is_gm(s.table_id) then
  raise exception using errcode='P0001',message='not_authorized';
 end if;
 if p_visible is null then raise exception using errcode='P0001',message='invalid_visibility'; end if;
 if s.version is distinct from p_expected_version then raise exception using errcode='P0001',message='revision_conflict'; end if;
 if not p_visible then delete from public.dnd_boss_bars where sheet_id=s.id; return; end if;
 if not s.secret or s.kind<>'monstro' or s.archived or s.data->'is_boss' is distinct from 'true'::jsonb then
  raise exception using errcode='P0001',message='not_a_boss';
 end if;
 if jsonb_typeof(s.data->'hp') is distinct from 'number' or jsonb_typeof(s.data->'hp_max') is distinct from 'number' then
  raise exception using errcode='P0001',message='invalid_boss_hp';
 end if;
 current_hp:=(s.data->>'hp')::numeric; maximum_hp:=(s.data->>'hp_max')::numeric;
 if current_hp<0 or current_hp>'1e100'::numeric or maximum_hp<=0 or maximum_hp>'1e100'::numeric then
  raise exception using errcode='P0001',message='invalid_boss_hp';
 end if;
 insert into public.dnd_boss_bars(sheet_id,table_id,name,hp,hp_max)
 values(s.id,s.table_id,s.name,least(current_hp,maximum_hp),maximum_hp)
 on conflict(sheet_id) do update set table_id=excluded.table_id,name=excluded.name,hp=excluded.hp,hp_max=excluded.hp_max,updated_at=now();
end$$;
revoke all on function public.dnd_set_boss_visibility(uuid,boolean,bigint) from public,anon;
grant execute on function public.dnd_set_boss_visibility(uuid,boolean,bigint) to authenticated;

create or replace function public.dnd_sync_boss_bar() returns trigger
language plpgsql security definer set search_path='' as $$
declare current_hp numeric; maximum_hp numeric;
begin
 -- Updating a hidden sheet never reveals it. Only the GM operation inserts rows.
 if new.table_id<>old.table_id then delete from public.dnd_boss_bars where sheet_id=new.id; return new; end if;
 if not exists(select 1 from public.dnd_boss_bars where sheet_id=new.id) then return new; end if;
 if not new.secret or new.kind<>'monstro' or new.archived or new.data->'is_boss' is distinct from 'true'::jsonb
 or jsonb_typeof(new.data->'hp') is distinct from 'number' or jsonb_typeof(new.data->'hp_max') is distinct from 'number' then
  delete from public.dnd_boss_bars where sheet_id=new.id; return new;
 end if;
 current_hp:=(new.data->>'hp')::numeric; maximum_hp:=(new.data->>'hp_max')::numeric;
 if current_hp<0 or current_hp>'1e100'::numeric or maximum_hp<=0 or maximum_hp>'1e100'::numeric then
  delete from public.dnd_boss_bars where sheet_id=new.id; return new;
 end if;
 update public.dnd_boss_bars set name=new.name,hp=least(current_hp,maximum_hp),hp_max=maximum_hp,updated_at=now()
 where sheet_id=new.id;
 return new;
end$$;
revoke all on function public.dnd_sync_boss_bar() from public,anon,authenticated;
create trigger dnd_sync_boss_bar after update on public.dnd_sheets for each row execute function public.dnd_sync_boss_bar();
alter publication supabase_realtime add table public.dnd_boss_bars;
