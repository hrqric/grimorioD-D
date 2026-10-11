# ADR — Novas funcionalidades: progressão de nível, glossário e assistente da ficha

- **Status:** Proposto
- **Data:** 2026-10-10
- **Projeto:** Grimório — Fichas de D&D

## Contexto

O Grimório é atualmente uma aplicação web estática em JavaScript, publicada pela Vercel e integrada ao Supabase para autenticação, banco de dados, RLS e atualizações em tempo real. As fichas são armazenadas principalmente na tabela `dnd_sheets`, com os dados do personagem concentrados no campo `data` em JSON.

Foram propostas três funcionalidades relacionadas:

1. Um botão de subida de nível.
2. Um glossário de progressão que informe tudo o que o personagem recebe ao subir de nível, evitando consultas frequentes aos livros.
3. Um chat capaz de explicar itens, magias, feitiços, encantos, divindades, atributos e demais regras considerando a ficha do personagem.

Essas funcionalidades compartilham a mesma dependência: uma base de regras estruturada, versionada e vinculada aos elementos da ficha.

## Hipóteses e requisitos

- O lançamento inicial atenderá dezenas de mesas e centenas de usuários, sem demanda atual para microsserviços.
- O sistema inicial será baseado nas regras de D&D 2024 e no SRD 5.2.1.
- Level-up pode levar alguns segundos, mas não pode ser aplicado parcialmente nem em duplicidade.
- O chat pode ficar temporariamente indisponível sem impedir o uso das fichas.
- Dados de fichas e conteúdo secreto do mestre são privados e devem respeitar os acessos já definidos no Supabase.
- O sistema deve suportar multiclasse desde a modelagem inicial.
- Conteúdo de regras deve registrar origem, versão e licença.

## Decisão

### 1. O level-up será um processo, não uma alteração direta do nível

O botão **Subir de nível** iniciará um assistente com prévia, escolhas e confirmação. Ele não incrementará diretamente `data.level`.

O processo deverá:

1. Ler o estado atual e a versão da ficha.
2. Identificar a classe que receberá o nível, inclusive em personagens multiclasse.
3. Calcular os ganhos aplicáveis.
4. Solicitar escolhas como PV, subclasse, talentos, atributos, magias e características.
5. Exibir uma revisão final.
6. Aplicar todas as alterações em uma única transação.
7. Registrar o estado anterior, o estado posterior e as escolhas realizadas.
8. Gerar notificações para o jogador e para o mestre.

Cada mesa poderá futuramente escolher uma política de progressão:

- aplicação livre pelo jogador;
- solicitação do jogador com aprovação do mestre;
- progressão iniciada exclusivamente pelo mestre.

Depois da implantação desse fluxo, o nível não deverá ser editado livremente, exceto por uma ação administrativa explícita.

### 2. O glossário será a fonte central de regras

O glossário não será apenas uma coleção de textos para notificações. Ele será um catálogo estruturado utilizado por:

- cálculo e explicação do level-up;
- busca manual de regras;
- links presentes na ficha;
- notificações de progressão;
- assistente conversacional;
- futuras validações e automações.

Cada entrada deverá registrar ao menos:

- tipo da regra;
- nome e identificador estável;
- resumo e conteúdo;
- versão do ruleset;
- fonte e localização na fonte;
- licença;
- metadados estruturados.

### 3. A modelagem do diagrama original será normalizada

A tabela genérica `per_level` do diagrama inicial não será adotada como está porque:

- `sourceId` não distingue com segurança classe de subclasse;
- colunas como `c1`, `c2`, `c3`, `c4` e `c5` não escalam;
- listas de características e magias dentro de colunas dificultam referências, escolhas e consultas;
- a modelagem não representa adequadamente multiclasse, histórico ou decisões do jogador.

O modelo de domínio proposto contém:

#### Catálogo de regras

- `rulesets`
- `classes`
- `subclasses`
- `class_levels`
- `subclass_levels`
- `rule_entries`
- `level_grants`
- `spell_slot_grants`

#### Progressão do personagem

- `character_classes`
- `level_ups`
- `level_up_choices`
- `notifications`

#### Busca do assistente

- `rule_embeddings`, introduzida somente quando a busca semântica for implementada.

O campo `classes.hit_die` armazenará o dado de vida da classe. A rolagem ou escolha concreta de PV será armazenada no evento de level-up, não na definição da classe.

Os espaços de magia serão representados por linhas contendo nível da classe, círculo da magia e quantidade de espaços, em vez de colunas fixas por círculo.

`level_grants` representará cada ganho de classe ou subclasse e poderá apontar para uma entrada do glossário, uma quantidade ou um grupo de escolhas.

### 4. Multiclasse será modelada explicitamente

Será criada a entidade `character_classes`, contendo:

- ficha;
- classe;
- subclasse opcional;
- nível naquela classe;
- indicação de classe primária.

O nível total será derivado da soma dos níveis de classe. Durante a migração, `data.level`, `data.class` e `data.subclass` poderão continuar sendo atualizados como campos derivados para preservar compatibilidade com a interface existente.

### 5. Level-up terá histórico, idempotência e controle de concorrência

Cada progressão será registrada em `level_ups` com:

- ficha e mesa;
- autor e aprovador;
- nível total anterior e posterior;
- classe que recebeu o nível;
- estado anterior e posterior;
- status do processo;
- datas de criação e aplicação.

A operação de aplicação receberá a versão esperada da ficha e uma chave de idempotência. Uma função transacional no banco ou uma Edge Function coordenará a validação e a transação. Isso impedirá que duas telas apliquem o mesmo level-up simultaneamente.

### 6. Notificações não substituirão o histórico

O resultado da progressão será apresentado em três lugares:

1. resumo imediato após a confirmação;
2. caixa de notificações com estado lido/não lido;
3. histórico persistente da ficha.

O Supabase Realtime será reutilizado para entregar notificações dentro da aplicação. Push notifications do navegador ficarão fora do primeiro lançamento.

### 7. O chat será próprio e fundamentado em fontes

A aplicação não dependerá do NotebookLM pessoal como infraestrutura do chat.

O assistente do Grimório consultará:

- dados estruturados da ficha;
- catálogo de regras;
- regras personalizadas e públicas da mesa;
- documentos autorizados indexados para busca semântica.

O fluxo de resposta será:

1. validar a identidade e o acesso à ficha no servidor;
2. resolver primeiro informações estruturadas;
3. buscar entradas relevantes no glossário;
4. usar busca semântica somente quando necessário;
5. enviar ao modelo apenas o contexto necessário;
6. responder com as fontes consultadas e indicar quando não houver evidência suficiente.

O modelo não poderá alterar uma ficha diretamente. Ele poderá propor mudanças, mas qualquer escrita exigirá confirmação explícita e uma operação validada pelo servidor.

### 8. NotebookLM será apenas uma integração complementar possível

Foram consideradas três alternativas:

1. **NotebookLM compartilhado por link:** simples, mas externo ao Grimório e sem sincronização viva com a ficha.
2. **Gemini Notebook Enterprise:** permite gerenciar notebooks e fontes por API, mas exige Google Cloud, IAM e licenciamento; as APIs públicas avaliadas não fornecem um contrato adequado para embutir o chat do notebook no site.
3. **Assistente próprio fundamentado em fontes:** escolhido por permitir integração nativa, autorização por ficha, controle de custo, respostas com fontes e uso do estado atualizado da aplicação.

Uma futura sincronização com NotebookLM Enterprise poderá ser avaliada como recurso complementar, caso surja justificativa comercial ou operacional.

### 9. A stack atual será ampliada de forma incremental

Não serão introduzidos microsserviços.

A arquitetura continuará usando:

- Vercel para a interface;
- Supabase Auth, Postgres, RLS e Realtime;
- Supabase Edge Functions para operações protegidas de level-up e chat;
- `pgvector` somente na fase do assistente semântico;
- um provedor de modelo acessado exclusivamente pelo servidor.

Segredos e chaves de modelos nunca serão incluídos no JavaScript entregue ao navegador.

O código da interface deverá ser modularizado gradualmente. Uma estrutura prevista é:

```text
src/
  app/
  auth/
  sheets/
  level-up/
  glossary/
  assistant/
  notifications/
  shared/

supabase/
  migrations/
  functions/
    preview-level-up/
    apply-level-up/
    ask-grimorio/
```

Vite poderá ser adotado para módulos e build. React não é uma exigência desta decisão e só deverá ser introduzido se a complexidade futura da interface justificar a migração.

### 10. O conteúdo inicial será limitado a fontes autorizadas

O conteúdo inicial do catálogo deverá usar:

- SRD 5.2.1 sob CC-BY-4.0, com a atribuição exigida;
- conteúdo autoral do projeto;
- conteúdo criado pelo mestre para a própria mesa;
- outras fontes somente quando houver direito claro de armazenamento e uso.

Não será assumido que todo o conteúdo dos livros comerciais ou das regras disponibilizadas gratuitamente está coberto pela licença do SRD.

## Segurança

- RLS continuará sendo aplicada no banco.
- Toda Edge Function repetirá a autorização; ela não confiará apenas no `sheet_id` enviado pelo navegador.
- Conteúdo secreto do mestre nunca poderá entrar no contexto de um jogador.
- O chat terá limites por usuário e por mesa.
- Custos, latência e erros serão observados sem registrar conteúdo sensível desnecessário.
- Textos da ficha e documentos serão tratados como dados, não como instruções confiáveis ao modelo.
- As respostas do assistente deverão citar as entradas ou documentos usados.

## Plano de entrega

### Fase 0 — decisões de produto

- definir política de aprovação do level-up;
- confirmar D&D 2024/SRD 5.2.1;
- selecionar classes e subclasses do primeiro lançamento;
- definir regras de PV;
- definir como correções ou reduções de nível serão tratadas.

### Fase 1 — fundação

- criar catálogo versionado;
- importar conteúdo autorizado;
- estruturar classes do personagem;
- criar migrações e políticas RLS;
- manter compatibilidade temporária com o JSON atual.

### Fase 2 — level-up

- criar assistente de escolhas;
- apresentar prévia dos ganhos;
- aplicar em transação;
- registrar histórico;
- entregar notificações;
- oferecer aprovação opcional pelo mestre.

### Fase 3 — glossário

- implementar busca e filtros;
- adicionar links nas características da ficha;
- criar página de detalhes e fontes;
- distinguir regras oficiais e regras da mesa.

### Fase 4 — assistente da ficha

- responder primeiro com dados estruturados;
- adicionar busca semântica;
- devolver respostas com fontes;
- separar rigorosamente os contextos de mestre e jogador;
- adicionar limites, métricas e controle de custo.

### Fase 5 — evoluções

- propor alterações na ficha por chat;
- importar itens e magias de forma assistida;
- suportar regras personalizadas mais avançadas;
- avaliar push notifications;
- reavaliar integração complementar com NotebookLM Enterprise.

## Alternativas rejeitadas

### Apenas incrementar `data.level`

Rejeitada porque não processa escolhas, ganhos, multiclasse ou histórico e pode deixar a ficha inconsistente.

### Manter todo o catálogo no JSON da ficha

Rejeitada porque duplica regras, dificulta atualizações e inviabiliza referências consistentes e pesquisa eficiente.

### Adotar a tabela polimórfica `per_level` do diagrama original

Rejeitada devido à referência ambígua, colunas rígidas de magia e dificuldade de evolução.

### Usar NotebookLM pessoal como backend do chat

Rejeitada por não oferecer integração oficial adequada ao contexto vivo e às permissões por ficha do Grimório.

### Introduzir microsserviços

Rejeitada porque o volume e a operação atuais não justificam essa complexidade. Supabase, Edge Functions e Postgres atendem aos requisitos previstos.

## Consequências positivas

- Level-up consistente, explicável e auditável.
- Mesma base de conhecimento reutilizada por interface, notificações e chat.
- Suporte correto a multiclasse.
- Respostas do assistente vinculadas a fontes.
- Evolução incremental sem reescrever imediatamente toda a aplicação.
- Menor dependência de uma plataforma externa de notebooks.

## Consequências e custos

- Será necessária uma migração parcial do JSON para dados estruturados.
- O catálogo de regras exigirá curadoria, versionamento e manutenção.
- Regras de progressão e multiclasse precisarão de testes de domínio.
- O chat terá custo variável e exigirá limites e observabilidade.
- Conteúdo fora do SRD dependerá de avaliação de licença e direitos de uso.

## Riscos

| Risco | Severidade | Mitigação |
|---|---:|---|
| Uso indevido de conteúdo fora do SRD | Alta | Registrar fonte e licença por entrada e limitar a importação |
| Level-up parcial ou duplicado | Alta | Transação, idempotência e controle de versão |
| Vazamento de segredos do mestre no chat | Alta | RLS, autorização no servidor e montagem segura de contexto |
| Regras incorretas de multiclasse | Alta | Motor de regras isolado e testes por combinação |
| Respostas inventadas pelo modelo | Média/alta | Fontes obrigatórias e resposta de insuficiência de evidência |
| Custos imprevisíveis do chat | Média | Limites, métricas, cache e resolução estruturada primeiro |
| Crescimento do arquivo único atual | Média | Modularização incremental e adoção de build |

## Critérios de revisão desta decisão

Este ADR deverá ser revisto se ocorrer qualquer uma destas situações:

- mudança do sistema ou da edição principal de regras;
- surgimento de API oficial de chat incorporável do NotebookLM;
- necessidade comprovada de mais escala ou isolamento operacional;
- adoção de um provedor externo de catálogo licenciado;
- alteração relevante na política de conteúdo da Wizards of the Coast;
- decisão de migrar a interface para outro framework.
