# Banco, entidades e migrações

Carregue esta regra para Supabase, Postgres, RLS, Storage e Realtime.

## Regras verificáveis

- Toda mudança de schema usa nova migração versionada em `supabase/migrations/`.
- Nunca altere uma migração que já possa ter sido aplicada.
- Migração deve ser reversível ou documentar claramente por que não é.
- Mantenha invariantes críticas no banco, preferindo constraints e RPCs transacionais.
- Toda tabela exposta deve ter RLS e políticas mínimas por papel/posse.
- Teste acesso do mestre, jogador responsável e usuário sem autorização.
- Use funções `security definer` somente com `search_path` seguro e autorização explícita.
- Preserve compatibilidade de dados legados; não normalize silenciosamente valores incertos.
- Buckets privados usam URLs assinadas; valide MIME, tamanho e vínculo com a mesa/ficha.
- Realtime não substitui persistência nem tratamento de reconexão/conflitos.
- Índices devem acompanhar filtros e joins usados por políticas e consultas frequentes.
- Nenhum segredo, token, e-mail de teste ou dado pessoal deve entrar em logs ou commits.

## Validação

Rode os testes JavaScript pelo gate. Testes SQL são manuais em ambiente Supabase autorizado, sempre com rollback e conferência de alertas de segurança.

