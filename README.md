# Grimório — Fichas de D&D

Site em português, baseado nos campos da ficha D&D 2024 fornecida. Banco já configurado no projeto Supabase `dnd-ficha-prd` (`psvugkyzlhzemptavpdh`).

## Uso

1. Crie uma conta e confirme o e-mail, caso a confirmação esteja habilitada no Supabase.
2. Entre e escolha **Criar mesa**. Quem cria a mesa torna-se seu mestre.
3. Em **Jogadores**, ajuste o limite e adicione nome e e-mail dos participantes.
4. Crie fichas e atribua o jogador responsável. Compartilhe o endereço do site; não há envio automático de convites.
5. O jogador deve entrar com o mesmo e-mail cadastrado pelo mestre.
6. Use **Arquivo secreto** para fichas de monstros, NPCs e personagens exclusivos do mestre.

As mudanças são salvas ao sair de um campo e enviadas pelo Supabase Realtime. A aplicação mostra quando o salvamento falhou. Edições simultâneas conflitantes são bloqueadas: copie o texto pendente, recarregue e reaplique a alteração. Fichas arquivadas podem ser restauradas. Remover acesso de um jogador preserva suas fichas.

## Publicação na Vercel

- Framework: **Other**.
- Diretório de saída: `dist`.
- Sem instalação de dependências ou etapa de compilação.
- `vercel.json` já contém a configuração.
- Após definir o domínio, configure **Authentication > URL Configuration** no Supabase: coloque a URL publicada em **Site URL** e adicione-a às URLs de redirecionamento permitidas. Isso direciona os links de confirmação de e-mail de volta ao site.
- Para receber cadastros de jogadores fora da equipe do projeto, confira a entrega de e-mails de Auth e configure SMTP se o serviço de envio padrão estiver restrito.

O navegador usa apenas a chave publicável do Supabase. Não é necessário colocar chave secreta ou `service_role` no site. As permissões são aplicadas no banco, independentemente da interface. O código usa Supabase JS 2.57.4 via esm.sh e fontes do Google; precisa de internet.

## Banco e verificação

Tabelas: `dnd_tables`, `dnd_players`, `dnd_sheets`. Todas possuem RLS e integram a publicação `supabase_realtime`.

### Glossário e level-up

A aba **Características** na ficha mostra níveis, nomes e recursos: adquiridos,
prévia do próximo nível e progressão futura. Pedidos aguardando aprovação ficam
separados dos ganhos adquiridos. As descrições completas ficam para o futuro
Oráculo. Recursos por nível são referências, não valores cumulativos.

Classe usa dropdown do catálogo e fica protegida quando há progressão ou pedido
pendente. Nomes legados desconhecidos aparecem em **Progressão → Classes
aguardando avaliação** para o mestre manter o nome ou mapear para uma classe
cadastrada. A decisão e seu autor são registrados na ficha. Uma classe
personalizada aprovada permanece sem level-up automático até ter catálogo.
Subclasse continua somente leitura e é escolhida no level-up.

As migrações `20261011045451_class_review_guards.sql` e
`20261011045726_progression_read_access.sql` protegem a avaliação do mestre,
validam a identidade de classe/subclasse e permitem ao jogador consultar apenas
a progressão das fichas às quais já tem acesso. Foram aplicadas no Supabase.
Testes: `npm test`, `npm run check` e `tests/class-review.sql` (com rollback).
Os testes de interface verificam o HTML gerado; não substituem validação visual
no navegador com duas contas reais.

Subclasses: a migração `20261011022314_subclass_progression.sql` cria `dnd_subclasses`, `dnd_subclass_levels` e `dnd_subclass_level_grants`. Cada classe do personagem e pedido de level-up guarda `subclass_id`, com chave estrangeira composta que impede combinar classes incompatíveis. A escolha é obrigatória a partir de `dnd_classes.subclass_level` (3 no catálogo atual), persiste na aprovação e não pode ser trocada pelo fluxo de level-up. Pedidos antigos sem a escolha obrigatória precisam ser rejeitados e refeitos. O campo textual da ficha passa a ser somente leitura; fichas legadas confirmam a subclasse no próximo level-up.

O catálogo da planilha D&D 2024 foi importado com 12 classes, 48 subclasses, 240 progressões de classe e 184 características de subclasses. O seed reproduzível e sua documentação estão em `supabase/seeds/`. A estrutura agrega características vinculadas em `dnd_subclass_level_grants` ao histórico. Os textos são referências da planilha, não regras completas; o fluxo não automatiza efeitos mecânicos individuais dessas características.

A migração em `supabase/migrations/20261011004229_level_up_glossary.sql` adiciona o catálogo de regras, classes estruturadas, histórico de progressão e as funções transacionais de solicitação e aprovação. Aplique essa migração no projeto Supabase antes de publicar esta versão da interface.

Cada mesa começa no modo **solicitação com aprovação do mestre**. O mestre pode trocar a política na tela **Progressão** entre:

- aplicação livre pelo jogador;
- solicitação do jogador com aprovação do mestre;
- progressão iniciada exclusivamente pelo mestre.

O primeiro catálogo contém a estrutura e as regras fundamentais de progressão do SRD 5.2.1. Características adicionais devem ser importadas somente com fonte, versão e licença registradas em `dnd_rule_entries`, ligadas ao nível por `dnd_level_grants`.

Verificações realizadas: sintaxe JavaScript; abertura da interface e campos no navegador; teste transacional no banco para permissões de mestre/jogador, sigilo, limite de jogadores, atualização e versão de ficha; nenhum alerta no verificador de segurança do Supabase. Os dados e usuários temporários do teste foram revertidos.

A inspeção das telas internas usou uma ficha de demonstração local, não incluída nesta entrega. O fluxo completo com dois usuários reais, confirmação de e-mail e troca de eventos ao vivo ainda precisa de validação após a publicação.

## Estado da publicação

A tentativa de criar o deploy na Vercel retornou HTTP 403: a integração não tem permissão para criar projeto na equipe `hrqric's projects`. Nenhum deploy foi concluído. É necessário liberar essa permissão ou criar um projeto `grimorio-dnd` acessível à integração.

O registro inicial no Sites ficou sem publicação, pois o destino foi alterado para Vercel durante a implementação.
