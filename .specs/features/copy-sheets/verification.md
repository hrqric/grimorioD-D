# Copiar fichas — verificação independente

**Verdict**: PASS
**Profile**: light
**Diff range**: alterações locais da feature sobre ed9c4860177a252338eacd56e5c53d74571a5401; sem commit por instrução do projeto.
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Claim | Proof run | Evidence | Result |
|---|---|---|---|---|
| C1 | Cópia independente preserva dados, nível e vínculos | `node scripts/test-copy-db.mjs` exit 0, copy_preserves | tests/copy-sheets.sql:19 `c.id=s.id or c.table_id<>t or c.player_id<>pid or c.data<>s.data`; linha 20 exige classe/subclasse e nível 5; linha 21 preserva origem | PASS |
| C2 | Não mestres recusados | mesmo comando, copy_denied | tests/copy-sheets.sql:25 captura insufficient_privilege para jogador/outro usuário; linhas 28 e 31 cobrem sessão vazia e papel anon | PASS |
| C3 | Nome inválido e origem ausente recusados | mesmo comando, copy_invalid | tests/copy-sheets.sql:36 exige invalid_parameter_value; linha 38 exige no_data_found | PASS |
| C4 | Falha de vínculo reverte cópia | mesmo comando, copy_atomic | tests/copy-sheets.sql:52 exige falha injetada; linha 54 exige contagem inalterada | PASS |
| C5 | UI exclusiva e erro visível | `node --test tests/copy-sheets.test.mjs` exit 0, quatro testes individualmente executados | tests/copy-sheets.test.mjs:10 rejeita jogador; linha 18 exige propagação de erro; linhas 22–24 exigem guarda gm e modal-error | PASS |
| C6 | Guard de nível permanece | SQL copy_level_guard no mesmo comando exit 0 | tests/copy-sheets.sql:39 exige recusa de insert direto nível 5 | PASS |

## Inspection

- supabase/migrations/20261023120000_copy_sheets.sql:9 verifica owner_id=auth.uid(), com search_path vazio e sem grants públicos/anônimos.
- supabase/migrations/20261023120000_copy_sheets.sql:15 copia somente a ficha; linha 18 copia somente vínculos de classes. Não insere mídia, caderno ou histórico.
- Snapshot da origem é bloqueado com FOR UPDATE; falhas propagam sem captura na função, mantendo atomicidade.
- dist/app.js:60 restringe a operação à mesa atual e ao mestre; modal existente bloqueia segundo envio e mostra falha.

## Swept existing

Preservados modal, carregamento de classes, regra gm baseada nas mesas acessíveis do proprietário e trigger dnd_guard_sheet_level. Nenhum trigger ou política existente alterado pela feature.

## Limits

Perfil light: nenhuma mutação de comportamento aplicada pelo verifier; não há recomputação exaustiva de conjuntos.
Interface comprovada por inspeção/teste de fonte e helper, sem fluxo real no navegador.
SQL executado em PGlite temporário com fixture de bootstrap e migrações anteriores à mídia, seguido da nova função; não é prova do schema remoto completo.
Mídia/caderno não têm fixtures nesta prova: exclusão confirmada por inspeção das únicas duas escritas da função. Histórico é verificado vazio na cópia, sem histórico semeado na origem.
Não foi exercitada concorrência real entre sessões nem transporte HTTP/PostgREST; códigos SQL e grants foram exercitados diretamente.

## Gate

`scripts/verify.ps1`: exit 0, 67 testes passaram, 0 falhas, sintaxe aprovada.
`node --test tests/copy-sheets.test.mjs`: exit 0, quatro provas novas passaram.
`node scripts/test-copy-db.mjs` com PGLITE_MODULE temporário: exit 0, cinco casos SQL passaram e rollback concluído.
