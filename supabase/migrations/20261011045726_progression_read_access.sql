-- dnd_sheets already enforces GM/assigned-player access with RLS.
-- Do not INNER JOIN dnd_tables: that table is deliberately GM-only.
drop policy if exists "sheet members read character classes" on public.dnd_character_classes;
create policy "sheet members read character classes" on public.dnd_character_classes for select to authenticated
using (exists(select 1 from public.dnd_sheets s where s.id=dnd_character_classes.sheet_id));
drop policy if exists "sheet members read level ups" on public.dnd_level_ups;
create policy "sheet members read level ups" on public.dnd_level_ups for select to authenticated
using (exists(select 1 from public.dnd_sheets s where s.id=dnd_level_ups.sheet_id));
