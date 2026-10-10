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

Verificações realizadas: sintaxe JavaScript; abertura da interface e campos no navegador; teste transacional no banco para permissões de mestre/jogador, sigilo, limite de jogadores, atualização e versão de ficha; nenhum alerta no verificador de segurança do Supabase. Os dados e usuários temporários do teste foram revertidos.

A inspeção das telas internas usou uma ficha de demonstração local, não incluída nesta entrega. O fluxo completo com dois usuários reais, confirmação de e-mail e troca de eventos ao vivo ainda precisa de validação após a publicação.

## Estado da publicação

A tentativa de criar o deploy na Vercel retornou HTTP 403: a integração não tem permissão para criar projeto na equipe `hrqric's projects`. Nenhum deploy foi concluído. É necessário liberar essa permissão ou criar um projeto `grimorio-dnd` acessível à integração.

O registro inicial no Sites ficou sem publicação, pois o destino foi alterado para Vercel durante a implementação.
