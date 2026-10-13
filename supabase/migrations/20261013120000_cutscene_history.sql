-- Opt-in cutscene history and GIF support for table scenes.
alter table public.dnd_media_assets
  drop constraint dnd_media_assets_mime_type_check,
  drop constraint dnd_media_assets_check;

alter table public.dnd_media_assets
  add constraint dnd_media_assets_mime_type_check
    check (mime_type in ('image/jpeg','image/png','image/webp','image/gif')),
  add constraint dnd_media_assets_kind_size_check
    check ((kind='portrait' and bucket_id='dnd-portraits' and sheet_id is not null and mime_type<>'image/gif' and byte_size<=5242880)
      or (kind in ('map','cutscene') and bucket_id='dnd-table-scenes' and sheet_id is null and byte_size<=31457280));

update storage.buckets
set file_size_limit=31457280,
    allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif']
where id='dnd-table-scenes';

create table public.dnd_scene_history(
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.dnd_tables(id) on delete restrict,
  asset_id uuid not null references public.dnd_media_assets(id) on delete restrict,
  title text,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  unique(table_id,asset_id),
  check(title is null or title=btrim(title)),
  check(removed_at is null or removed_at>=created_at)
);

create index dnd_scene_history_visible_idx
  on public.dnd_scene_history(table_id,created_at desc)
  where removed_at is null;
create index dnd_scene_history_asset_idx on public.dnd_scene_history(asset_id);
create index dnd_scene_history_creator_idx on public.dnd_scene_history(created_by);

alter table public.dnd_scene_history enable row level security;

create policy "members read active scene history"
on public.dnd_scene_history for select to authenticated
using(removed_at is null and public.dnd_is_table_member(table_id));

create or replace function public.save_cutscene_history(p_table_id uuid,p_asset_id uuid)
returns public.dnd_scene_history
language plpgsql security definer set search_path=''
as $$
declare a public.dnd_media_assets; h public.dnd_scene_history;
begin
  if not public.dnd_is_gm(p_table_id) then
    raise exception using errcode='P0001',message='not_authorized';
  end if;
  select * into a from public.dnd_media_assets
  where id=p_asset_id and deleted_at is null for share;
  if not found then
    raise exception using errcode='P0001',message='asset_not_found';
  end if;
  if a.kind<>'cutscene' or a.table_id<>p_table_id then
    raise exception using errcode='P0001',message='asset_scope_mismatch';
  end if;
  insert into public.dnd_scene_history(table_id,asset_id,created_by)
  values(p_table_id,p_asset_id,auth.uid())
  on conflict(table_id,asset_id) do update
  set removed_at=null,updated_at=now(),created_by=auth.uid()
  returning * into h;
  return h;
end$$;

create or replace function public.rename_cutscene_history(p_history_id uuid,p_title text)
returns public.dnd_scene_history
language plpgsql security definer set search_path=''
as $$
declare h public.dnd_scene_history; normalized_title text:=nullif(btrim(p_title),'');
begin
  select * into h from public.dnd_scene_history
  where id=p_history_id and removed_at is null for update;
  if not found then
    raise exception using errcode='P0001',message='history_not_found';
  end if;
  if not public.dnd_is_gm(h.table_id) then
    raise exception using errcode='P0001',message='not_authorized';
  end if;
  update public.dnd_scene_history
  set title=normalized_title,updated_at=now()
  where id=p_history_id returning * into h;
  return h;
end$$;

create or replace function public.remove_cutscene_history(p_history_id uuid)
returns public.dnd_scene_history
language plpgsql security definer set search_path=''
as $$
declare h public.dnd_scene_history;
begin
  select * into h from public.dnd_scene_history
  where id=p_history_id and removed_at is null for update;
  if not found then
    raise exception using errcode='P0001',message='history_not_found';
  end if;
  if not public.dnd_is_gm(h.table_id) then
    raise exception using errcode='P0001',message='not_authorized';
  end if;
  update public.dnd_scene_history
  set removed_at=now(),updated_at=now()
  where id=p_history_id returning * into h;
  return h;
end$$;

revoke all on function public.save_cutscene_history(uuid,uuid),public.rename_cutscene_history(uuid,text),public.remove_cutscene_history(uuid) from public,anon;
grant execute on function public.save_cutscene_history(uuid,uuid),public.rename_cutscene_history(uuid,text),public.remove_cutscene_history(uuid) to authenticated;
grant select on public.dnd_scene_history to authenticated;

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dnd_scene_history') then
    alter publication supabase_realtime add table public.dnd_scene_history;
  end if;
end$$;
