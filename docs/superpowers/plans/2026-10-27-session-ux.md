# UX de sessão — plano de implementação

> Execução: superpowers:executing-plans, nesta sessão. Direção aprovada pelo usuário na prévia local em 27/10/2026; envio à develop autorizado.

**Objetivo:** integrar a visão da mesa e a ficha orientada à sessão à aplicação existente.
**Arquitetura:** manter JavaScript ESM, os renderizadores, a autorização e o salvamento versionado existentes. CSS específico de UX complementa o tema e preserva impressão.
**Stack:** HTML, CSS e JavaScript sem dependências adicionais.
**Spec:** prévia local em `preview/`, aprovada nesta conversa.

## Restrições
- Preservar todos os campos, arquivos secretos, caderno, cópia, progressão, mídia e impressão.
- Não alterar banco, contratos públicos ou dependências.
- Não enviar dados fictícios, arquivos temporários ou mudanças locais de terceiros.
- Erros de salvamento e conflitos devem continuar visíveis.

## Foco de revisão
- Jogador não vê pendências de outro jogador nem ações exclusivas do mestre.
- Busca inclui jogador responsável e não revela fichas secretas.
- Valores rápidos refletem mudanças de campos e controles respeitam conflito e salvamento.
- Vida vazia, zero, máxima e valores inválidos não produzem estado incoerente.
- Celular, teclado e impressão conservam acesso aos controles e conteúdo.

## Tarefas
- [x] Escrever e executar testes inicialmente falhos: busca por jogador, pendências por acesso, valores rápidos e controles de PV.
- [x] Integrar navegação por perfil, visão da mesa e painel de pendências em `dist/app.js`.
- [x] Integrar resumo de combate, aba Em jogo e controles de PV pelo salvamento existente.
- [x] Aplicar tema aprovado em `dist/ux.css`, carregado por `dist/index.html`.
- [x] Executar `scripts/verify.ps1`, validar desktop/celular com fixtures locais e revisar o diff.
- [x] Commitar somente a entrega desta tarefa e enviar à `origin/develop`, sem force push.

## Decisões de execução
- Manter todas as seções reais da ficha; Em jogo abre Combate e mantém Identidade, Perícias, Magias e História acessíveis.
- Reutilizar condições e seus símbolos existentes; possuem significado de regra e testes de regressão.
- A prévia aprovada permanece local; não integra a publicação.

## Validação
Gate `scripts/verify.ps1`: 73 testes aprovados, sintaxe válida, saída 0. Revisão independente concluída sem pendências após corrigir preservação de foco nos controles de PV. Conferência visual com dados locais em desktop e celular (390 px); largura útil de 375 px sem transbordamento. Perfil jogador sem ações privadas do mestre. Detector: folha legada apresentou 9 ocorrências; nova folha de UX sem assinaturas detectadas. A fonte serifada e símbolos de condições existentes permanecem intencionais. Salvamento e sincronização com duas contas reais não foram revalidados contra produção.
