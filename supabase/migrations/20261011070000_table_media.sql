-- Private portraits, table maps and synchronized cutscenes.
create type public.dnd_media_kind as enum ('portrait','map','cutscene');

alter table public.dnd_players add column user_id uuid references auth.users(id) on delete set null;
create unique index dnd_players_table_user_unique on public.dnd_players(table_id,user_id) where user_id is not null;
create index dnd_players_user_idx on public.dnd_players(user_id) where user_id is not null;

create table public.dnd_media_assets(
 id uuid primary key default gen_random_uuid(),
 table_id uuid not null references public.dnd_tables(id) on delete restrict,
 sheet_id uuid references public.dnd_sheets(id) on delete restrict,
 kind public.dnd_media_kind not null,
 bucket_id text not null,
 object_path text not null unique,
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/webp')),
 byte_size bigint not null check(byte_size>0),
 width integer not null check(width>0), height integer not null check(height>0),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(), deleted_at timestamptz,
 check((kind='portrait' and bucket_id='dnd-portraits' and sheet_id is not null and byte_size<=5242880)
    or (kind in ('map','cutscene') and bucket_id='dnd-table-scenes' and sheet_id is null and byte_size<=15728640))
);
create table public.dnd_sheet_portraits(
 sheet_id uuid primary key references public.dnd_sheets(id) on delete restrict,
 asset_id uuid references public.dnd_media_assets(id) on delete restrict,
 revision bigint not null default 0,
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table public.dnd_table_presentations(
 table_id uuid primary key references public.dnd_tables(id) on delete restrict,
 map_asset_id uuid references public.dnd_media_assets(id) on delete restrict,
 map_revision bigint not null default 0,
 cutscene_asset_id uuid references public.dnd_media_assets(id) on delete restrict,
 cutscene_active boolean not null default false,
 cutscene_revision bigint not null default 0,
 cutscene_started_at timestamptz,
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now(),
 check(cutscene_active=(cutscene_asset_id is not null))
);
create index dnd_media_assets_table_idx on public.dnd_media_assets(table_id);
create index dnd_media_assets_sheet_idx on public.dnd_media_assets(sheet_id) where sheet_id is not null;
create index dnd_media_assets_creator_idx on public.dnd_media_assets(created_by);
create index dnd_sheet_portraits_asset_idx on public.dnd_sheet_portraits(asset_id) where asset_id is not null;
create index dnd_sheet_portraits_updater_idx on public.dnd_sheet_portraits(updated_by);
create index dnd_table_presentations_map_idx on public.dnd_table_presentations(map_asset_id) where map_asset_id is not null;
create index dnd_table_presentations_cutscene_idx on public.dnd_table_presentations(cutscene_asset_id) where cutscene_asset_id is not null;
create index dnd_table_presentations_updater_idx on public.dnd_table_presentations(updated_by);

alter table public.dnd_media_assets enable row level security;
alter table public.dnd_sheet_portraits enable row level security;
alter table public.dnd_table_presentations enable row level security;

create or replace function public.dnd_is_table_member(p_table_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.dnd_tables t where t.id=p_table_id and t.owner_id=(select auth.uid()))
 or exists(select 1 from public.dnd_players p where p.table_id=p_table_id and p.active and (p.user_id=(select auth.uid()) or (p.user_id is null and lower(p.email)=lower(coalesce((select auth.jwt()->>'email'),'')))))
$$;
create or replace function public.dnd_is_gm(p_table_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.dnd_tables t where t.id=p_table_id and t.owner_id=(select auth.uid()))
$$;
create or replace function public.dnd_can_edit_sheet(p_sheet_id uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.dnd_sheets s left join public.dnd_players p on p.id=s.player_id where s.id=p_sheet_id and (exists(select 1 from public.dnd_tables t where t.id=s.table_id and t.owner_id=(select auth.uid())) or (not s.secret and p.active and (p.user_id=(select auth.uid()) or (p.user_id is null and lower(p.email)=lower(coalesce((select auth.jwt()->>'email'),'')))))))
$$;

create policy "members read media" on public.dnd_media_assets for select to authenticated using(public.dnd_is_table_member(table_id) and (kind<>'portrait' or exists(select 1 from public.dnd_sheets s where s.id=sheet_id)));
create policy "authorized upload metadata" on public.dnd_media_assets for insert to authenticated with check(created_by=(select auth.uid()) and ((kind='portrait' and public.dnd_can_edit_sheet(sheet_id)) or (kind in ('map','cutscene') and public.dnd_is_gm(table_id))));
create policy "sheet readers read portraits" on public.dnd_sheet_portraits for select to authenticated using(exists(select 1 from public.dnd_sheets s where s.id=sheet_id));
create policy "members read presentations" on public.dnd_table_presentations for select to authenticated using(public.dnd_is_table_member(table_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('dnd-portraits','dnd-portraits',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('dnd-table-scenes','dnd-table-scenes',false,15728640,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "sheet readers read portraits objects" on storage.objects for select to authenticated using(bucket_id='dnd-portraits' and public.dnd_can_edit_sheet((storage.foldername(name))[2]::uuid));
create policy "sheet editors upload portraits" on storage.objects for insert to authenticated with check(bucket_id='dnd-portraits' and public.dnd_can_edit_sheet((storage.foldername(name))[2]::uuid));
create policy "members read scene objects" on storage.objects for select to authenticated using(bucket_id='dnd-table-scenes' and public.dnd_is_table_member((storage.foldername(name))[1]::uuid));
create policy "gms upload scene objects" on storage.objects for insert to authenticated with check(bucket_id='dnd-table-scenes' and public.dnd_is_gm((storage.foldername(name))[1]::uuid));
create policy "uploaders clean media objects" on storage.objects for delete to authenticated using(owner_id=(select auth.uid())::text and bucket_id in ('dnd-portraits','dnd-table-scenes'));

create or replace function public.dnd_claim_player_identity() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.uid() is null or coalesce(auth.jwt()->>'email','')='' then raise exception using errcode='P0001',message='not_authorized'; end if;
 update public.dnd_players set user_id=auth.uid() where active and user_id is null and lower(email)=lower(auth.jwt()->>'email'); get diagnostics n=row_count; return n;
end$$;

create or replace function public.set_sheet_portrait(p_sheet_id uuid,p_asset_id uuid,p_expected_revision bigint) returns public.dnd_sheet_portraits language plpgsql security definer set search_path='' as $$
declare a public.dnd_media_assets; s public.dnd_sheets; r public.dnd_sheet_portraits;
begin
 if not public.dnd_can_edit_sheet(p_sheet_id) then raise exception using errcode='P0001',message='not_authorized'; end if;
 select * into s from public.dnd_sheets where id=p_sheet_id;
 if p_asset_id is not null then select * into a from public.dnd_media_assets where id=p_asset_id and deleted_at is null; if not found then raise exception using errcode='P0001',message='asset_not_found'; end if; if a.kind<>'portrait' or a.table_id<>s.table_id or a.sheet_id<>s.id then raise exception using errcode='P0001',message='asset_scope_mismatch'; end if; end if;
 insert into public.dnd_sheet_portraits(sheet_id,asset_id,revision,updated_by) values(p_sheet_id,p_asset_id,1,auth.uid()) on conflict(sheet_id) do update set asset_id=excluded.asset_id,revision=dnd_sheet_portraits.revision+1,updated_by=auth.uid(),updated_at=now() where dnd_sheet_portraits.revision=p_expected_revision returning * into r;
 if not found then raise exception using errcode='P0001',message='revision_conflict'; end if; return r;
end$$;

create or replace function public.set_table_map(p_table_id uuid,p_asset_id uuid,p_expected_revision bigint) returns public.dnd_table_presentations language plpgsql security definer set search_path='' as $$
declare a public.dnd_media_assets; r public.dnd_table_presentations;
begin
 if not public.dnd_is_gm(p_table_id) then raise exception using errcode='P0001',message='not_authorized'; end if;
 if p_asset_id is not null then select * into a from public.dnd_media_assets where id=p_asset_id and deleted_at is null; if not found then raise exception using errcode='P0001',message='asset_not_found'; end if; if a.kind<>'map' or a.table_id<>p_table_id then raise exception using errcode='P0001',message='asset_scope_mismatch'; end if; end if;
 update public.dnd_table_presentations set map_asset_id=p_asset_id,map_revision=map_revision+1,updated_by=auth.uid(),updated_at=now() where table_id=p_table_id and map_revision=p_expected_revision returning * into r;
 if not found then raise exception using errcode='P0001',message='revision_conflict'; end if; return r;
end$$;

create or replace function public.present_cutscene(p_table_id uuid,p_asset_id uuid) returns public.dnd_table_presentations language plpgsql security definer set search_path='' as $$
declare a public.dnd_media_assets; r public.dnd_table_presentations;
begin
 if not public.dnd_is_gm(p_table_id) then raise exception using errcode='P0001',message='not_authorized'; end if;
 select * into a from public.dnd_media_assets where id=p_asset_id and deleted_at is null; if not found then raise exception using errcode='P0001',message='asset_not_found'; end if; if a.kind<>'cutscene' or a.table_id<>p_table_id then raise exception using errcode='P0001',message='asset_scope_mismatch'; end if;
 update public.dnd_table_presentations set cutscene_asset_id=p_asset_id,cutscene_active=true,cutscene_revision=cutscene_revision+1,cutscene_started_at=now(),updated_by=auth.uid(),updated_at=now() where table_id=p_table_id returning * into r; return r;
end$$;
create or replace function public.dismiss_cutscene(p_table_id uuid) returns public.dnd_table_presentations language plpgsql security definer set search_path='' as $$
declare r public.dnd_table_presentations; begin if not public.dnd_is_gm(p_table_id) then raise exception using errcode='P0001',message='not_authorized'; end if; update public.dnd_table_presentations set cutscene_asset_id=null,cutscene_active=false,cutscene_revision=cutscene_revision+1,cutscene_started_at=null,updated_by=auth.uid(),updated_at=now() where table_id=p_table_id returning * into r; return r; end$$;

create or replace function public.dnd_create_presentation() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.dnd_table_presentations(table_id,updated_by) values(new.id,new.owner_id); return new; end$$;
create trigger dnd_table_presentation after insert on public.dnd_tables for each row execute function public.dnd_create_presentation();
revoke all on function public.dnd_create_presentation() from public,anon,authenticated;
insert into public.dnd_table_presentations(table_id,updated_by) select id,owner_id from public.dnd_tables on conflict do nothing;

revoke all on function public.dnd_claim_player_identity(),public.set_sheet_portrait(uuid,uuid,bigint),public.set_table_map(uuid,uuid,bigint),public.present_cutscene(uuid,uuid),public.dismiss_cutscene(uuid) from public,anon;
grant execute on function public.dnd_claim_player_identity(),public.set_sheet_portrait(uuid,uuid,bigint),public.set_table_map(uuid,uuid,bigint),public.present_cutscene(uuid,uuid),public.dismiss_cutscene(uuid) to authenticated;
grant select,insert on public.dnd_media_assets to authenticated;
grant select on public.dnd_sheet_portraits,public.dnd_table_presentations to authenticated;
alter publication supabase_realtime add table public.dnd_table_presentations;
