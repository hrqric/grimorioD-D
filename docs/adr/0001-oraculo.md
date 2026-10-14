# ADR 0001 — Oráculo fundamentado na ficha e no catálogo de regras

- **Status:** Proposto · **Data:** 2026-10-13 · **Decisores:** equipe do Grimório

## Contexto

O Grimório precisa explicar regras de D&D 2024 considerando a ficha acessível ao usuário, sem expor conteúdo secreto do mestre nem transformar respostas do modelo em autoridade mecânica. O catálogo `dnd_rule_entries` já reúne regras versionadas e pesquisáveis; a aplicação usa JavaScript estático na Vercel e Supabase para identidade, dados e RLS.

Esta decisão detalha o Oráculo previsto no ADR legado `adr_new_features.md`. O lançamento atende dezenas de mesas e centenas de usuários. A ficha deve continuar disponível quando o Oráculo falhar; latência de alguns segundos é aceitável. Fichas, regras privadas e conversas são dados sensíveis da mesa.

## Decisão

O Oráculo será um assistente de leitura, implementado incrementalmente como um monólito serverless sobre a stack atual:

1. A interface envia pergunta, `sheet_id` opcional e identificador da conversa para a Edge Function `ask-oracle`.
2. A função valida o JWT e recalcula o acesso à ficha e à mesa; nenhum contexto enviado pelo navegador é confiável.
3. Um resolvedor consulta primeiro dados estruturados da ficha e faz busca textual em `dnd_rule_entries`.
4. Busca semântica com `pgvector` só será adicionada se métricas mostrarem baixa recuperação da busca textual.
5. A função monta contexto mínimo, separa dados de instruções e chama um provedor de modelo somente no servidor.
6. A resposta retorna texto, fontes identificáveis, aviso de incerteza e métricas técnicas sem conteúdo sensível.

O modelo não escreve na ficha, não executa level-up e não decide regras da mesa. Futuras sugestões de alteração exigirão confirmação explícita e operação transacional própria.

## Contrato inicial

`POST /functions/v1/ask-oracle` recebe `{ question, sheetId?, conversationId? }` e retorna `{ answer, citations[], conversationId, requestId }`. Usa `400` para entrada inválida, `401` sem sessão, `403` sem acesso, `429` por limite e `503` quando o provedor falhar. Pergunta e histórico terão tamanho máximo, timeout e cotas por usuário e mesa.

## Dados e privacidade

- O contexto da ficha será uma projeção permitida, não o JSON inteiro por padrão.
- Conteúdo secreto só entra em solicitações de um mestre autorizado e nunca em contexto de jogador.
- Perguntas e respostas não serão persistidas no MVP; logs estruturados guardam apenas identificadores, duração, consumo, resultado e erros, sem tokens, prompts ou conteúdo da ficha.
- Fontes precisam registrar origem, versão e licença; ausência de evidência gera resposta explícita de insuficiência.

## Alternativas preteridas

- **Chamar o modelo no navegador:** rejeitado por expor chave, controles e contexto sensível.
- **NotebookLM como backend:** rejeitado por não oferecer autorização integrada à ficha e contrato adequado ao produto.
- **RAG vetorial desde o início ou agente com escrita:** adiados; o catálogo já possui índice textual e alterações induzidas por modelo elevam o risco.

## Consequências

O Oráculo fica isolado de falhas da ficha, reutiliza RLS e catálogo existentes e permite trocar o provedor. Em contrapartida, exige uma Edge Function, controle de custo, avaliação da qualidade das respostas e curadoria contínua das fontes.

## Operação e critérios de aceite

- Health check e métricas de latência, erro, tokens e custo; p95 menor que 8 s e disponibilidade mensal de 99%, sem afetar o restante do app.
- Testes de autorização cobrem mestre, jogador responsável, jogador sem acesso e intruso.
- Avaliação versionada mede recuperação de fontes, fidelidade à ficha, citações e recusa por falta de evidência.
- Circuit breaker lógico interrompe chamadas após falhas repetidas e apresenta indisponibilidade recuperável.

## Riscos abertos

| Risco | Severidade | Mitigação |
|---|---:|---|
| Vazamento entre mesas ou papéis | Alta | Autorização na função, projeções mínimas e testes negativos |
| Prompt injection em ficha ou regra | Alta | Tratar conteúdo como dados, delimitar contexto e negar ferramentas de escrita |
| Resposta inventada ou regra desatualizada | Alta | Citações obrigatórias, versão visível e resposta de insuficiência |
| Custo ou latência imprevisível | Média | Cotas, timeout, métricas e busca estruturada primeiro |
| Conteúdo sem licença adequada | Alta | Fonte e licença obrigatórias antes da indexação |

## Perguntas antes da aceitação

1. O MVP responde apenas sobre uma ficha selecionada ou também aceita perguntas gerais sem ficha, e regras autorais da mesa entram já no MVP?
2. Qual provedor/modelo e qual teto mensal de custo serão adotados?
3. Conversas permanecem efêmeras ou o usuário precisa de histórico persistente?

## Critérios de revisão

Revisar ao permitir escrita, persistir conversas, adicionar documentos livres, trocar de ruleset principal ou exceder as metas de escala, custo, latência ou disponibilidade.
