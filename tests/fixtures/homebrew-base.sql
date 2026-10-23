-- Isolated local fixture for the three core tables whose original bootstrap
-- predates the repository migrations. Never run against a connected project.
create role anon;
create role authenticated;
create schema auth;
create table auth.users(id uuid primary key,email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
grant usage on schema auth,public to anon,authenticated;
grant execute on all functions in schema auth to anon,authenticated;
grant select on auth.users to authenticated;
create table public.dnd_tables(
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid() references auth.users(id),
 name text not null,max_players integer not null default 6,created_at timestamptz default now()
);
create table public.dnd_players(
 id uuid primary key default gen_random_uuid(),table_id uuid not null references public.dnd_tables(id),
 name text not null,email text not null,active boolean not null default true,
 user_id uuid references auth.users(id),created_at timestamptz default now()
);
create table public.dnd_sheets(
 id uuid primary key default gen_random_uuid(),table_id uuid not null references public.dnd_tables(id),
 player_id uuid references public.dnd_players(id),name text not null,kind text default 'personagem',
 secret boolean not null default false,archived boolean not null default false,
 data jsonb not null default '{}',version bigint not null default 1,updated_at timestamptz default now()
);
create function public.fixture_version() returns trigger language plpgsql as $$
begin new.version:=old.version+1;new.updated_at:=now();return new;end $$;
create trigger z_fixture_version before update on public.dnd_sheets for each row execute function public.fixture_version();
alter table public.dnd_tables enable row level security;
alter table public.dnd_players enable row level security;
alter table public.dnd_sheets enable row level security;
grant select,insert,update,delete on public.dnd_tables,public.dnd_players,public.dnd_sheets to authenticated;
create policy owner_tables on public.dnd_tables for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy read_players on public.dnd_players for select to authenticated using(
 user_id=auth.uid() or lower(email)=lower(auth.jwt()->>'email')
 or exists(select 1 from public.dnd_tables t where t.id=table_id and t.owner_id=auth.uid())
);
create policy owner_players on public.dnd_players for all to authenticated using(
 exists(select 1 from public.dnd_tables t where t.id=table_id and t.owner_id=auth.uid())
);
create policy access_sheets on public.dnd_sheets for all to authenticated using(
 exists(select 1 from public.dnd_tables t where t.id=table_id and t.owner_id=auth.uid())
 or (not secret and exists(select 1 from public.dnd_players p where p.id=player_id and p.active and lower(p.email)=lower(auth.jwt()->>'email')))
);
