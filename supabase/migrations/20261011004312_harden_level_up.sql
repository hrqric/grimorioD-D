-- Follow-up from Supabase database advisors: optimize policy auth calls and
-- cover foreign keys used by the progression workflow.

drop policy if exists "members read table settings" on public.dnd_table_settings;
create policy "members read table settings" on public.dnd_table_settings for select to authenticated
using (
  exists (select 1 from public.dnd_tables t where t.id=table_id and t.owner_id=(select auth.uid()))
  or exists (
    select 1 from public.dnd_players p
    where p.table_id=table_id and p.active
      and lower(p.email)=lower(coalesce((select auth.jwt())->>'email',''))
  )
);

drop policy if exists "sheet members read character classes" on public.dnd_character_classes;
create policy "sheet members read character classes" on public.dnd_character_classes for select to authenticated
using (exists (
  select 1 from public.dnd_sheets s
  join public.dnd_tables t on t.id=s.table_id
  left join public.dnd_players p on p.id=s.player_id
  where s.id=sheet_id
    and (t.owner_id=(select auth.uid()) or (not s.secret and p.active and lower(p.email)=lower(coalesce((select auth.jwt())->>'email',''))))
));

drop policy if exists "sheet members read level ups" on public.dnd_level_ups;
create policy "sheet members read level ups" on public.dnd_level_ups for select to authenticated
using (exists (
  select 1 from public.dnd_sheets s
  join public.dnd_tables t on t.id=s.table_id
  left join public.dnd_players p on p.id=s.player_id
  where s.id=sheet_id
    and (t.owner_id=(select auth.uid()) or (not s.secret and p.active and lower(p.email)=lower(coalesce((select auth.jwt())->>'email',''))))
));

create index if not exists dnd_character_classes_class_id_idx on public.dnd_character_classes(class_id);
create index if not exists dnd_level_grants_class_level_id_idx on public.dnd_level_grants(class_level_id);
create index if not exists dnd_level_grants_rule_entry_id_idx on public.dnd_level_grants(rule_entry_id);
create index if not exists dnd_level_ups_class_id_idx on public.dnd_level_ups(class_id);
create index if not exists dnd_level_ups_requested_by_idx on public.dnd_level_ups(requested_by);
create index if not exists dnd_level_ups_decided_by_idx on public.dnd_level_ups(decided_by);
