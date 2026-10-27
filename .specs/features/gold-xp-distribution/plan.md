# Plano — moedas do mestre e ouro como progressão

## Objetivo

Dar ao mestre controle exclusivo sobre PC, PP e PO, permitir divisões desiguais
entre fichas e mostrar ao jogador quanto ouro falta para liberar o próximo
level-up.

## Regras de produto propostas

- Somente o mestre distribui ou retira moedas; jogadores apenas consultam.
- Cada distribuição informa o total do tesouro e a parcela de cada ficha.
- A soma por denominação deve coincidir com o total informado.
- Somente PO recebido aumenta o progresso; PP e PC alteram apenas o saldo.
- PO não é convertido automaticamente a partir de outras denominações.
- A meta depende do nível atual: 10, 10, 10, 25, 35, 40, 55, 70, 70,
  100, 110, 120, 120, 120 e 150; do nível 15 em diante, 150.
- Atingir a meta libera o fluxo de level-up existente, sem escolher PV, classe
  ou subclasse silenciosamente.
- O progresso fica limitado à meta atual; PO excedente permanece no saldo, mas
  não conta para outra faixa. Ao aplicar o level-up, o contador volta a zero e
  a interface passa a usar a meta do novo nível.
- Uma distribuição gera evento auditável e notificação única para o jogador.
- Fichas secretas, NPCs, monstros e fichas arquivadas não participam.

## Dados e segurança

- Criar carteira por ficha com saldos inteiros não negativos e PO de progresso.
- Criar lote de distribuição e lançamentos por ficha para auditoria/realtime.
- Fazer a distribuição em uma RPC transacional e idempotente.
- Autorizar a RPC com `dnd_is_gm(table_id)` e validar todas as fichas na mesa.
- RLS permite leitura somente ao mestre e ao jogador responsável pela ficha.
- Revogar escrita direta e `execute` público; conceder somente o necessário a
  `authenticated`.
- Sincronizar o consumo da meta dentro do level-up aplicado, no banco.
- Fazer backfill dos campos legados `cp`, `sp` e `gp` sem apagar os originais.

## Interface

- Painel “Tesouro da mesa” em Progressão, exclusivo do mestre.
- Modal com totais PC/PP/PO, linhas por personagem e saldo restante ao vivo.
- Atalho “Dividir igualmente”, sempre ajustável antes de confirmar.
- Cartão acessível de progresso na ficha e resumo por personagem em Progressão.
- Moedas somente leitura em História e inventário.
- Toast com os valores recebidos; acrescentar aviso quando a meta for atingida.

## Testes e gates

- Unitários: tabela de metas, projeção da barra e validação da divisão.
- UI: visibilidade por papel, divisão desigual, erros e notificação única.
- SQL: mestre, jogador e intruso; atomicidade; idempotência; escopo de mesa;
  saldo não negativo; consumo no level-up; rollback de fixtures.
- Gate final obrigatório: `scripts/verify.ps1` com saída 0.

## Implementação local

- Migração/RPC, interface, notificação realtime e testes implementados.
- Validação PostgreSQL isolada cobre autorização, atomicidade, idempotência e
  integração com level-up; fixtures são sempre revertidas.
- Aplicação no Supabase, commit e deploy continuam fora desta entrega local.
