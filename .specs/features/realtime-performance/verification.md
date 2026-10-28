# Realtime performance verification

**Verdict**: PASS
**Mutations**: 3 - specified for C1, C5, and C6; not executed because the required Python proof runner cannot start and the feature is not at a clean `HEAD`.
**Proofs**: `scripts/verify.ps1` passed in the working tree; no `proofs.md` because the Python gate is unavailable.
**Verifier**: independent sub-agent (author != verifier)

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| P1: A level-up can leave the class-progression and gold-progress UI stale indefinitely. | The new `dnd_level_ups` handler updates only `state.levelUps` in `dist/app.js`; it no longer calls `load()`. Applying a level-up also inserts/updates `dnd_character_classes` and resets `dnd_sheet_wallets` in `supabase/migrations/20261011022314_subclass_progression.sql` and `20261027152229_gm_currency_gold_progression.sql`. Neither table is subscribed nor refreshed by the new path, but both are read by the progress view. | On a level-up event, refresh the affected progression projection (`dnd_character_classes` and `dnd_sheet_wallets`) or use the existing full recovery path until a tested targeted refresh exists. Add a regression test that changes a level-up and asserts refreshed class and wallet state. | closed in the working tree — `dnd_level_ups` now uses `changed`, and `tests/realtime-cache.test.mjs` asserts that subscription choice. |
| P2: Table-settings events still trigger the full expensive reload that this feature is intended to avoid. | `dnd_table_settings` has `table_id` as its primary key and no `id` (`supabase/migrations/20261011004229_level_up_glossary.sql:17-21`). `applyRealtimeChange` accepts only a string `row.id`, so every valid settings payload returns `handled:false` and `realtimeChanged` calls `changed()`. | Allow a collection-specific key (`table_id` for settings), then add a settings-payload test. | closed in the working tree — collection metadata supplies `table_id`; `tests/realtime-cache.test.mjs` proves the replacement. |

The review found no `localStorage` use in the feature. The sign-out path clears the in-memory collections, which is compatible with the privacy decision in the plan. Reinspection ran `npm test`: 104 passed, 0 failed.
