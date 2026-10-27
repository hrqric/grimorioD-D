# Bosses na mesa

## Preparar
1. Abra **Arquivo secreto** e **Nova ficha**.
2. Escolha o tipo **Boss** e dê um nome à criatura.
3. Em **Em jogo**, preencha PV atuais e PV máximos maiores que zero.
4. Salve as alterações antes de apresentar o encontro.

Para aproveitar um monstro existente, abra **Gerenciar ficha** e marque **Ficha de boss**.
A opção aparece somente para fichas de monstro do arquivo secreto.

## Apresentar
Use **Revelar boss** no card ou na ficha.
Todos os membros da mesa veem o nome e a proporção de vida no topo da área principal.
Jogadores não recebem acesso à ficha, aos ataques ou ao caderno do mestre.
O HUD não apresenta PV numéricos; os valores continuam disponíveis na ficha do mestre.

## Durante o encontro
Altere os PV pela ficha ou pelos controles rápidos de vida.
A barra reflete os valores salvos, não uma edição ainda pendente ou com erro.
É possível revelar vários bosses ao mesmo tempo.
Ao chegar a zero, a barra continua visível e vazia até o mestre encerrar a apresentação.

## Encerrar
Use **Ocultar boss** sem apagar ou arquivar a ficha.
Arquivar, desmarcar como boss ou apagar a ficha também remove sua apresentação.
Restaurar uma ficha arquivada não revela o boss automaticamente.

## Implantação e limites de validação
A nova migração deve estar aplicada antes de usar Revelar boss.
Migração aplicada ao projeto existente: `20261027132915_boss_bars.sql`.
O cliente mantém a aplicação utilizável quando a migração ainda não existe e informa a indisponibilidade ao mestre.
Realtime atualiza o HUD; uma consulta a cada cinco segundos recupera eventos perdidos.
Se a consulta falhar, a última barra conhecida recebe aviso de sincronização.
Testes SQL usam rollback em ambiente de validação, sem dados de produção.
O fluxo foi conferido com dados locais; latência real entre duas contas depende da conexão e do Realtime.
