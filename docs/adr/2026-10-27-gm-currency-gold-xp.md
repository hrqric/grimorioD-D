# ADR — moedas do mestre e progressão por ouro

## Status

Aceita para implementação local em 27/10/2026. Ainda não publicada.

## Contexto

PC, PP e PO eram campos livres dentro do JSON da ficha. Isso permitia que um
jogador alterasse o próprio saldo e não oferecia um evento confiável para
notificação. O level-up existente também exige classe, subclasse e ganho de PV,
portanto uma recompensa não pode incrementar o nível silenciosamente.

## Decisão

- A regra é ativada explicitamente por mesa e não possui desligamento na UI.
- Uma carteira normalizada por ficha guarda PC, PP, PO e o progresso de ouro.
- Lotes e lançamentos imutáveis registram cada distribuição para auditoria.
- Somente uma RPC transacional, autorizada pelo dono da mesa, escreve moedas.
- RLS permite leitura ao mestre e ao jogador responsável pela ficha.
- Escrita direta de PC, PP e PO no JSON é bloqueada quando a regra está ativa.
- PP e PC alteram somente saldo; apenas PO avança a progressão.
- O progresso é limitado à meta atual. Excedente continua no saldo, mas não é
  carregado para a próxima faixa.
- A meta alcançada libera o fluxo existente; o contador zera somente quando o
  level-up é efetivamente aplicado.
- Lançamentos são publicados no Realtime para notificar o jogador.

## Consequências

O mestre controla a economia e a concessão de progressão sem duplicar o fluxo
de escolhas do level-up. A solução adiciona três tabelas e exige que migração e
frontend sejam publicados juntos. Saldos legados inteiros são importados; dados
incertos permanecem no JSON original para revisão, sem normalização silenciosa.

## Validação

Testes JS cobrem metas, divisão, renderização e visibilidade por papel. Testes
PostgreSQL isolados cobrem mestre, jogador, intruso, escopo de mesa,
idempotência, bloqueio direto e reset após level-up, sempre com rollback.
