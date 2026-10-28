# Realtime performance checks

Mutations: 3
Build: `npm run check`; `npm test`
Plan: `.specs/features/realtime-performance/plan.md`

9 checks in 3 slices · 0 one-way doors · 0 open, of which 0 block

## Checks

### S1 - Relevant realtime updates

**C1** - An INSERT or UPDATE with an id replaces or appends exactly one matching in-memory row (AC 1)
Proof: `node --test tests/realtime-cache.test.mjs`

**C2** - A DELETE with an old id removes exactly that in-memory row (AC 2)
Proof: `node --test tests/realtime-cache.test.mjs`

**C3** - An event without the required event row is rejected for full-reload recovery rather than mutating the collection (AC 4)
Proof: `node --test tests/realtime-cache.test.mjs`

**C4** - A dirty selected sheet is retained when its remote sheet row changes (AC 3)
Proof: `node --test tests/realtime-cache.test.mjs`

### S2 - Background work

**C5** - A selected table fetches boss bars once, and a repeated render for that table reuses the settled projection (AC 5, AC 6)
Proof: `node --test tests/boss-bars.test.mjs`

**C6** - A visible recovery poll refreshes presentation only (AC 7)
Proof: `node --test tests/scenes.test.mjs`

**C7** - The recovery timer is 30 seconds and no shorter (AC 7)
Proof: `node --test tests/realtime-cache.test.mjs`

### S3 - Local storage decision

**C8** - The performance implementation never writes the realtime model to `localStorage` (AC 8)
Proof: `node --test tests/realtime-cache.test.mjs`

**C9** - Sign-out continues to clear the in-memory model and no persistent client cache is introduced (AC 9)
Proof: `node --test tests/realtime-cache.test.mjs`

## Coverage

| Set (size) | Member -> proof | Unproven |
| --- | --- | --- |
| realtime event type (3) | INSERT C1 · UPDATE C1 · DELETE C2 | - |
| malformed realtime event state (2) | missing new row C3 · missing old row C3 | - |
| boss projection lifecycle (2) | first table fetch C5 · repeated render C5 | - |
| recovery work (2) | presentation-only C6 · 30 seconds C7 | - |
| client persistence boundary (2) | no localStorage C8 · sign-out memory reset C9 | - |

## Swept

- validation: C3
- failure modes: C3
- idempotency: C1, C2
- authorization: existing - Supabase RLS is unchanged and no new route exists
- concurrency: C4, C5
- data lifecycle: C8, C9
- dependency failure: existing - `refreshPresentation` and `refreshBossBars` retain their current failure handling
- state transitions: C1, C2, C4
- observability: n/a - no new telemetry requirement in this slice

## Handoff

- **Settled mid-build:** user approved the plan with "sim" on 2026-10-27.
- **Dispatched:** Verifier at `d4d4bc3` plus unstaged feature changes; returned PASS after the P1/P2 fixes. The Python proof gate is unavailable because the configured Python launcher cannot start.
- **Boundary:** C1-C9 closed in the working tree; `scripts/verify.ps1` passed with 104 tests.
- **Abandoned:** persistent browser cache - it is explicitly out of scope for privacy and stale-data reasons.
- **Walked:** no visual surface changes; behavior is covered by the Node regression suite.
