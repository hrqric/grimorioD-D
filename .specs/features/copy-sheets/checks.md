# Copiar fichas — checks
Profile: light
Plan: `.specs/features/copy-sheets/plan.md`

## Checks
### S1 — cópia autorizada
**C1** - Mestre cria uma cópia independente preservando dados, nível e vínculos; origem intacta.
Proof: `node scripts/test-copy-db.mjs` (caso SQL copy_preserves)
**C2** - Jogador, outro mestre e anônimo criam zero cópias pela RPC.
Proof: `node scripts/test-copy-db.mjs` (caso SQL copy_denied)
**C3** - Nome vazio, maior que 150 e origem inexistente são recusados.
Proof: `node scripts/test-copy-db.mjs` (caso SQL copy_invalid)
**C4** - Falha na cópia dos vínculos reverte a nova ficha inteira.
Proof: `node scripts/test-copy-db.mjs` (caso SQL copy_atomic)
**C5** - Jogador não recebe botão e chamada cliente indevida não envia RPC; erro da RPC chega ao modal.
Proof: `node --test tests/copy-sheets.test.mjs`
**C6** - Inserções diretas de nível maior que 1 continuam recusadas.
Proof: `node scripts/test-copy-db.mjs` (caso SQL copy_level_guard)

## Coverage
| Set (size) | Member -> proof | Unproven |
|---|---|---|
| RPC dnd_copy_sheet statuses (4) | 200 C1; 403 C2; 400 C3; 404 C3 | - |
| Auth roles (4) | mestre C1; jogador C2; outro mestre C2; anônimo C2 | - |
| Entities (5) | ficha C1; mesa C1; classe C1; histórico C1; caderno/mídia C1 | - |
| Door (1) | RPC transacional C1 C2 C4 | - |

## Swept
- validation: C3
- failure modes: C4 C5
- idempotency: n/a - cada confirmação explícita cria uma cópia; modal bloqueia envio duplo em andamento
- authorization: C2 C5
- concurrency: C4; bloqueio da origem durante snapshot
- data lifecycle: C1
- dependency failure: C4 C5
- state transitions: C1 C6
- observability: C5

## Handoff
Uma fatia, um builder; app.js ~140 KB + migrações relevantes ~45 KB + testes ~15 KB = 200 KB / 4 = ~50k tokens, abaixo de 150k.
Plano e migração local aprovados pelo usuário em 23/10/2026; sem commit/deploy/aplicação em produção. Verifier será despachado pelo orquestrador sobre diff local.
