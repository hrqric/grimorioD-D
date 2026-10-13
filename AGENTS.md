# AGENTS.md

> Índice para agentes. Carregue regras e documentação somente quando a tarefa exigir.

## BOUNDARIES

**SEMPRE FAÇA**
- Leia somente os arquivos necessários à tarefa; use a Quick reference.
- Mantenha docs, regras e specs entre 30–70 linhas; nunca ultrapasse 100.
- Antes de concluir, rode `scripts/verify.ps1` e exija saída 0.
- Preserve mudanças locais que não pertençam à tarefa.

**PERGUNTE QUANDO**
- For commitar (padrão: não commitar sem aprovação explícita).
- For apagar/renomear documentação, mudar contrato público ou migração.
- Uma dependência ou decisão arquitetural nova for necessária; registre um ADR.

**NUNCA FAÇA**
- Ler todo o repositório ou toda a documentação “por garantia”.
- Editar migração já aplicada, segredos, `.env` ou artefatos sem relação com a tarefa.
- Expor chave secreta do Supabase; o navegador usa somente chave publicável.
- Limpar specs ou artefatos de trabalho antes da aprovação humana do PR.

## Projeto
- **Propósito:** aplicação web em português para mesas e fichas de D&D 2024.
- **Stack:** JavaScript ESM sem framework, HTML/CSS estáticos, Node.js para testes.
- **Dados:** Supabase (Auth, Postgres/RLS, Storage e Realtime).
- **Deploy:** Vercel, servindo `dist/` sem etapa de compilação.

## PM tool / board
- Não configurado. A skill `pm-handoff` deve perguntar quando for usada.
- Nunca registre assignee pessoal neste arquivo.

## Comandos

| Objetivo | Rode |
|---|---|
| Testes JS | `scripts/test.ps1` |
| Sintaxe/checagem | `scripts/check.ps1` |
| Gate final | `scripts/verify.ps1` |

Testes SQL em `tests/*.sql` exigem ambiente Supabase apropriado e rollback; não os rode automaticamente em produção.

## Quick reference

| Tarefa | Carregue | Skill quando aplicável |
|---|---|---|
| Feature, correção ou refactor | `rules/implementation.md` | `agentic-delivery` escolhe entre `tlc-discover`, `tlc-spec-lean` e `tlc-spec-driven` conforme tamanho e modelo |
| Testes | `rules/tests.md` | `harness-engineering` |
| Supabase, schema, RLS ou migração | `rules/database-entities.md` | skill `supabase` |
| Trabalho autônomo iterativo | apenas a regra da tarefa | `loop-engineering` |
| Roteamento ponta a ponta | este arquivo | `agentic-delivery` |
| API atual de biblioteca | documentação oficial/context7 | — |

Antes de acionar uma skill TLC, siga o roteamento atual de `agentic-delivery`: `tlc-discover` para projeto novo ou feature gigante; em features menores, `tlc-spec-lean` para modelos topo de linha e `tlc-spec-driven` para modelos mais antigos. Confirme que a skill escolhida está instalada; se faltar, não improvise o fluxo. Se futuramente existir `docs/CONSTITUTION.md`, leia-a antes de iniciar qualquer spec.

## Convenções essenciais
- `dist/` contém a aplicação entregue; mudanças de comportamento devem ser testadas.
- Valide entrada externa na borda e mantenha falhas de persistência visíveis ao usuário.
- Preserve RLS, autorização por mesa e operações transacionais em mudanças Supabase.
- Dependência/arquitetura nova pede ADR em `docs/adr/`; ADRs legados permanecem na raiz.

## Harness e continuidade
- Gate atual: `scripts/verify.ps1` (`npm run check` + `npm test`).
- `HARNESS.md` e `STATE.md` ainda não existem; gere-os via `harness-engineering` se necessário.
- Preserve `spec.md`, `design.md`, `AGENTS.md`, `rules/`, `docs/`, `STATE.md` e `ROADMAP.md`.

