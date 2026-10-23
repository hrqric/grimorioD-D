# Classes homebrew por mesa

## Como usar

1. Entre como mestre e selecione a mesa.
2. Abra **Classes homebrew** e clique em **Criar classe**.
3. Informe nome, descrição, dado de vida e nível de escolha da subclasse.
4. Liste as subclasses, uma por linha, e salve.
5. Na ficha, selecione a classe no campo **Classe**.
6. A subclasse é escolhida na subida de nível, conforme o nível configurado.

O mestre pode adicionar novas subclasses pelo botão **Adicionar subclasse**.
Uma classe e suas subclasses são exclusivas da mesa em que foram criadas.
Participar de duas mesas não permite usar o cadastro de uma na outra.
As classes oficiais continuam disponíveis em todas as mesas.

## O que a progressão aplica

O dado de vida determina a sugestão de ganho de PV no level-up.
O nível de escolha da subclasse determina quando a seleção é exigida.
As políticas de aprovação de level-up da mesa continuam valendo.
Habilidades e recursos devem ser registrados manualmente nas características
da ficha; esta entrega não inclui um editor de habilidades por nível.

## Banco e publicação

Aplicar `supabase/migrations/20261019120000_table_homebrew_classes.sql`
antes de publicar os arquivos de `dist/`.
A migração não altera nomes, níveis nem vínculos de fichas existentes.
Somente o mestre cadastra pela RPC; leitura usa RLS e validação de vínculo.
Ela não é aplicada automaticamente ao projeto de produção.

## Verificação

- `scripts/verify.ps1`: sintaxe e testes JavaScript.
- `tests/homebrew.sql`: cadastro, rollback, RLS e isolamento no PostgreSQL.
- `scripts/test-homebrew-db.mjs`: execução opcional em PGlite temporário.
- Configure `PGLITE_MODULE` com o caminho externo de `@electric-sql/pglite/dist/index.js`.
- O teste local simula as três tabelas originais em `tests/fixtures/homebrew-base.sql`.
- As migrações reais de progressão e os auxiliares de autorização são carregados do repositório.
- Homologação no Supabase deve confirmar também o schema original e o Realtime.

## Reversão

Não remova classes usadas por fichas ou por histórico de level-up.
Para reverter, migre esses vínculos explicitamente antes de remover colunas,
RPCs e gatilhos da migração. Restaure então as políticas anteriores do catálogo.
