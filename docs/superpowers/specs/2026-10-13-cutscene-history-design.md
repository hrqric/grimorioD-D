# Histórico de cutscenes e suporte a GIF

## Objetivo

Permitir que o mestre escolha cutscenes para compor um histórico compartilhado da mesa.
Jogadores podem rever cenas salvas em tela cheia somente no próprio dispositivo.
O fluxo de apresentação ao vivo deve continuar rápido e independente do histórico.

## Escopo

- Aceitar JPEG, PNG, WebP e GIF em mapas e cutscenes, com limite de 30 MB.
- Manter os formatos e o limite atuais para retratos.
- Guardar somente cutscenes no histórico; mapas anteriores ficam fora do escopo.
- Exigir uma ação explícita do mestre para salvar cada cena.
- Tornar o título opcional e editável depois do salvamento.

## Modelo de dados

Uma nova migração cria `public.dnd_scene_history` com identificador, mesa, ativo de mídia,
título opcional, autor, datas de criação e atualização e data opcional de remoção lógica.
O ativo deve ser uma cutscene não removida e pertencer à mesma mesa do registro.
Um ativo aparece no máximo uma vez no histórico da mesma mesa.
Um índice atende leitura por mesa, remoção e ordem cronológica decrescente.

## Autorização e operações

RLS permite leitura de entradas não removidas a qualquer membro da mesa.
Somente o mestre pode criar, renomear ou remover entradas.
RPCs com autorização explícita salvam, renomeiam e removem cenas de forma transacional.
Remover uma entrada não apaga o arquivo e não encerra uma apresentação ativa.
A tabela participa do Realtime para atualizar a galeria de jogadores conectados.

## Fluxo do mestre

O mestre envia e apresenta uma cutscene pelo fluxo atual.
Após o envio, a interface oferece `Salvar no histórico` sem abrir formulário.
O salvamento usa título vazio por padrão e confirma a inclusão sem bloquear outra apresentação.
Na visualização do histórico, o mestre pode editar o título ou remover a entrada.
O tamanho e o tipo do arquivo aparecem antes da confirmação de upload.

## Fluxo do jogador

A aba `Mapa e cenas` mantém a tela atual como padrão e recebe o botão `Histórico`.
Esse botão troca o conteúdo pela galeria de cutscenes salvas em ordem decrescente.
Cada item mostra a mídia, o título quando preenchido e a data de inclusão.
Selecionar um item abre uma sobreposição em tela cheia apenas naquele cliente.
Fechar essa sobreposição não altera a apresentação global nem afeta outros jogadores.

## Estados e falhas

A galeria possui estados de carregamento, vazio e mídia indisponível.
Falha ao salvar no histórico não interrompe a cutscene apresentada.
Falha ao editar ou remover mantém o item visível e informa o erro ao mestre.
Formato inválido ou arquivo acima de 30 MB é rejeitado antes do upload.
URLs assinadas continuam protegendo todos os arquivos do bucket privado.

## Validação

Testes JavaScript cobrem GIF, limites por tipo de mídia, galeria e abertura local.
Testes SQL cobrem mestre, jogador da mesa, intruso, escopo da mídia e remoção lógica.
O gate `scripts/verify.ps1` deve terminar com código zero.
Os testes SQL exigem ambiente Supabase autorizado e rollback; não rodam em produção.
