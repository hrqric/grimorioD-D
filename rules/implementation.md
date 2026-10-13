# Implementação

Carregue esta regra para features, correções e refactors.

## Regras verificáveis

- Mantenha o projeto em JavaScript ESM e siga os padrões presentes em `dist/*.js`.
- Faça a menor mudança que entregue um comportamento completo; evite refactors laterais.
- Valide dados externos antes de atualizar DOM, estado local ou Supabase.
- Mantenha erros de salvamento e conflitos visíveis; não descarte edição pendente.
- Preserve acessibilidade e escape conteúdo dinâmico antes de inseri-lo no HTML.
- Não introduza segredo ou chave `service_role` no cliente.
- Dependência nova ou mudança arquitetural exige aprovação e ADR.
- Não edite arquivos gerados de catálogo manualmente quando houver gerador reproduzível.
- Ao terminar, rode `scripts/verify.ps1` e corrija qualquer falha.

## Critério de conclusão

O comportamento possui teste de regressão adequado, a checagem de sintaxe passa e nenhuma mudança local alheia foi sobrescrita.

