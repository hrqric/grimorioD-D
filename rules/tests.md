# Testes

Carregue esta regra ao criar, corrigir ou revisar testes.

## Testes JavaScript

- Use o runner nativo `node:test`, como nos arquivos existentes em `tests/`.
- Nomeie testes pelo comportamento observável e pelo resultado esperado.
- Isole rede, relógio, DOM e Supabase com fakes/fixtures determinísticos.
- Toda correção de bug inclui teste que falharia sem a correção.
- Teste comportamento e contratos; evite acoplamento à implementação interna.
- Rode testes com `scripts/test.ps1`; filtros podem ser passados ao runner.

## Testes SQL

- Execute `tests/*.sql` somente em ambiente de validação autorizado.
- Preserve transações e rollback para não deixar usuários ou dados temporários.
- Cubra mestre, jogador autorizado e intruso quando alterar RLS ou RPCs.
- Nunca use o banco de produção para preparar fixtures destrutivas.

## Gate

O agente não se autoaprova: `scripts/verify.ps1` deve terminar com código 0. Validações que exigem duas contas reais devem ser registradas como pendência manual.

