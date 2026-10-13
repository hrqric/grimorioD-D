# Cutscene History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in cutscene history, local replay, and GIF uploads up to 30 MB.

**Architecture:** Store history entries in a dedicated RLS-protected table referencing existing private media assets. Keep live presentation independent from history, and add a local gallery mode inside the existing map view.

**Tech Stack:** JavaScript ESM, native DOM/CSS, Node test runner, Supabase Postgres/RLS/Storage/Realtime.

**Spec:** `docs/superpowers/specs/2026-10-13-cutscene-history-design.md`

## Global Constraints

- Do not add dependencies or alter applied migrations.
- Do not commit; the user explicitly declined commits.
- Maps and cutscenes accept JPEG, PNG, WebP and GIF up to 30 MB; portraits remain unchanged.
- History contains cutscenes only, titles are optional, and replay is local to one client.

## Review Focus

- Duplicate save attempts return the existing entry instead of creating duplicates.
- A removed history entry cannot be read by members but does not delete or stop its media.
- Intruders cannot read history; players cannot create, rename, or remove entries.
- A scene from another table or a non-cutscene asset is rejected.
- Failed history refresh or mutation preserves the current live map/cutscene UI.

---

### Task 1: GIF media contract

**Files:** Modify `dist/media.js`; test `tests/media.test.mjs`.
**Interfaces:** `validateMedia(file, kind) -> extension`; `MEDIA.map.max` and `MEDIA.cutscene.max` become 30 MB; `mediaExtension('image/gif') -> 'gif'`.

- [ ] Add failing tests for GIF cutscenes/maps, 30 MB boundaries, and unchanged portrait rejection/limit.
- [ ] Run `node --test tests/media.test.mjs` and confirm the new assertions fail.
- [ ] Implement the minimal MIME and per-kind size changes.
- [ ] Run the media tests and confirm they pass.

### Task 2: Persistent history and authorization

**Files:** Create `supabase/migrations/20261013120000_cutscene_history.sql`; modify `tests/media-permissions.sql`.
**Interfaces:** Table `dnd_scene_history`; RPCs `save_cutscene_history(uuid,uuid)`, `rename_cutscene_history(uuid,text)`, `remove_cutscene_history(uuid)`.

- [ ] Extend the rollback SQL test with master, member and intruder cases, duplicate save, wrong scope/kind, optional title, rename and soft removal.
- [ ] Write the migration with constraints, indexes, RLS, grants, secure RPC authorization and Realtime registration.
- [ ] Review every policy and function against the SQL cases; do not run them without an authorized Supabase validation environment.

### Task 3: History gallery and local replay

**Files:** Modify `dist/app.js`, `dist/style.css`; create `dist/scenes.js`; test `tests/scenes-history.test.mjs` and `tests/scenes.test.mjs`.
**Interfaces:** `sceneHistoryForTable(entries, tableId)` projects visible chronological entries; app state gains `sceneHistory` and `mediaMode`; live presentation remains in `presentations`.

- [ ] Add failing projection tests for chronological filtering, removed entries and optional titles.
- [ ] Add failing UI tests for the `Histórico` button, empty gallery, master controls, player read-only view and local-only fullscreen replay.
- [ ] Run both scene test files and confirm failures come from missing history behavior.
- [ ] Implement load and Realtime refresh without replacing dirty sheet state or live presentation state.
- [ ] Implement one-click `Salvar no histórico`, optional title editing, soft removal and visible mutation errors.
- [ ] Implement responsive gallery cards and a local overlay whose close action never calls presentation RPCs.
- [ ] Run both scene test files and confirm they pass.

### Task 4: Integrated verification

**Files:** Review all files above plus `docs/superpowers/specs/2026-10-13-cutscene-history-design.md`.

- [ ] Run `git diff --check` and correct whitespace errors only in task files.
- [ ] Run `scripts/verify.ps1` and require exit code zero.
- [ ] Record SQL authorization tests as pending manual validation if no authorized Supabase test environment is available.
- [ ] Confirm the final diff preserves unrelated local changes and contains no commit.
