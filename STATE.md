# Estado do projeto

## Handoff

- AD-001 (2026-10-13): atualizado o roteamento de especificação no `AGENTS.md` para refletir `tlc-discover`, `tlc-spec-lean` e `tlc-spec-driven`, conforme a regra vigente de `agentic-delivery`.
- Próxima fase: executar o plano `docs/superpowers/plans/2026-10-13-cutscene-history.md` após o pre-flight da skill TLC aplicável.
- AD-002 (2026-10-19): usuário aprovou implementação de classes e subclasses homebrew por mesa; plano em `.specs/features/table-homebrew-classes/plan.md`, decisão em `docs/adr/0002-table-homebrew-classes.md`.
- Homebrew: implementado e aprovado em revisão independente C1–C7; gate final com 58 testes passou, assim como os testes SQL homebrew e class-review em PostgreSQL temporário. Relatório em `.specs/features/table-homebrew-classes/verification.md`.
- Publicação homebrew concluída com autorização explícita em 19/10/2026: migração registrada no Supabase como `20261020000929_table_homebrew_classes`; deploy de produção `dpl_HGi3o46TF8N4ByZronvqg5T1pLsz` READY. Domínio público e hashes conferidos; detalhes em `docs/homebrew-release.md`. Sem commit ou push.
- AD-003 (2026-10-23): em modo degradado autorizado (skills TLC não instaladas), implementado o caderno privado do mestre nas fichas. A migração `20261023013000_sheet_gm_notes.sql` cria armazenamento separado com RLS exclusiva do mestre, salvamento otimista por revisão e backfill não destrutivo dos backgrounds de Glx/Cillian Liel, Derick/Kel Thuzad e Felipe/Yuri Kenpachi; Samurai permanece sem backfill por estar vazio no Notion. A interface carrega sob demanda e oferece as abas Background e Anotações do mestre. Testes JS e SQL adicionados; sem commit ou publicação.

- AD-004 (2026-10-23): cópia de fichas exclusiva do mestre planejada em .specs/features/copy-sheets/plan.md; aguardando aprovação humana do plano e da nova RPC/migração conforme TLC e AGENTS.md. Trigger de nível impede cópia completa por insert direto; proposta transacional preserva restrições existentes. Nenhum código, migração, commit ou publicação realizado. Próxima fase: aprovar plano, derivar checks, implementar e verificar.

- AD-005 (2026-10-23): usuário aprovou plano e RPC/migração locais para cópia exclusiva do mestre. Implementados botão/modal e RPC transacional em `20261023120000_copy_sheets.sql`; 4 testes JS e testes PostgreSQL temporário para autorização, cópia, validação, atomicidade e guard de nível passaram. Sem commit/publicação/aplicação em produção. Próxima fase: revisão independente pelo orquestrador e gate final.
