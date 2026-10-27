# Fichas de boss e barra pública — proposta

## Objetivo
O mestre prepara uma ficha de boss secreta e revela sua barra de vida à mesa durante o encontro.
O usuário confirmou que a revelação deve ser manual para evitar spoilers.

## Fluxo proposto
1. No Arquivo secreto, criar ficha com opção Boss ou marcar um monstro existente como boss.
2. Informar nome e PV máximos; o restante da ficha continua no formato existente.
3. Revelar boss pelo card ou pela ficha; a barra aparece para os membros daquela mesa.
4. Alterar PV pelo salvamento versionado existente; a barra acompanha os valores salvos.
5. Ocultar boss encerra a apresentação, sem apagar a ficha.

## Interface
- Barra no topo da área de jogo, abaixo da navegação, compartilhada entre as telas da mesa.
- Nome centralizado acima, moldura fina dourada e preenchimento vermelho escuro, alinhados ao Grimório.
- Inspiração Souls-like: proporção de vida para jogadores, sem números exatos por padrão.
- Mestre consulta os números exatos na ficha e no resumo de combate existentes.
- No celular, a barra ocupa a largura útil; nunca cobre campos, botões ou navegação.
- Cada boss revelado possui sua própria barra; suporte a mais de um boss no encontro.
- Ao chegar a zero, a barra fica vazia até o mestre ocultar; não apagar ou arquivar automaticamente.

## Persistência e sigilo
- Manter fichas de boss no arquivo secreto; não ampliar a leitura das fichas por jogadores.
- Identificar boss por marcador nos dados existentes, mantendo compatibilidade com os tipos atuais.
- Criar projeção pública separada com identificação da mesa, referência da ficha, nome e PV.
- A projeção só existe enquanto revelada; sem antecipar nomes de bosses não apresentados.
- Uma operação autorizada do mestre revela ou oculta; atualização da ficha sincroniza a projeção no banco.
- Arquivar, apagar ou desmarcar a ficha de boss remove sua barra compartilhada.
- RLS limita leitura aos membros da mesa e impede escrita por jogadores ou terceiros.
- Realtime atualiza as barras; consulta periódica e recuperação de foco/conexão reconciliam o estado.
- Atualizar a barra não reconstrói o editor nem descarta campos em edição.

## Alternativas consideradas
- Compartilhar a ficha inteira: rejeitada porque expõe ataques e informações secretas.
- Publicar apenas no navegador do mestre: rejeitada porque depende de a tela dele permanecer aberta.
- Projeção persistida mínima: proposta porque protege a ficha e permite recuperação após reconexão.

## Mudanças que precisam de aprovação
Nova migração SQL para a projeção, permissões, sincronização e operações de revelar/ocultar.
Não há dependência nova, custo contratado ou migração destrutiva prevista.
Aplicação dessa migração ao banco real será uma etapa separada, após código e validação revisáveis.

## Critérios de validação
- Mestre cria, revela, atualiza PV e oculta; jogador vê somente a barra de sua mesa.
- Não revelar bosses ocultos, fichas completas ou dados de outra mesa.
- Restaurar estado ao abrir ou reconectar; tratar falhas sem anunciar sucesso indevido.
- Validar vida zero, PV máximos inválidos, múltiplos bosses, arquivamento e troca de mesa.
- Executar testes JS, testes de permissões SQL com rollback em ambiente autorizado e revisão independente.

## Situação
Desenho e nova migração aprovados pelo usuário em 27/10/2026.
Implementação revisada; nove testes JS específicos e teste SQL transacional aprovados localmente.
Conferência visual em desktop/celular: criar, revelar, atualizar vida, ocultar e apresentar dois bosses.
Regras de acesso validadas em PostgreSQL local; nenhum fixture foi criado no banco real.
Migração `20261027132915_boss_bars.sql` aplicada ao projeto existente em 27/10/2026.
Conferência do banco real confirmou RLS, leitura restrita a autenticados, escrita direta negada e publicação Realtime.
Gate final: 88 testes JS aprovados; latência entre duas contas reais permanece uma conferência manual.
