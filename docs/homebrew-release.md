# Publicação de classes homebrew

## Resultado

Publicação autorizada pelo usuário e concluída em 19/10/2026 (São Paulo).
Endereço público: https://grimorio-dnd-ochre.vercel.app
Projeto Vercel: `grimorio-dnd`, equipe `hrqrics-projects`.
Deploy: `dpl_HGi3o46TF8N4ByZronvqg5T1pLsz`, produção, READY.
URL imutável: https://grimorio-71495nnh4-hrqrics-projects.vercel.app
Tempo de build informado pela Vercel: 2 segundos.
Arquivos locais sem commit; nenhum commit ou push realizado.

## Migração

Banco: `dnd-ficha-prd`, referência `psvugkyzlhzemptavpdh`.
Arquivo local: `supabase/migrations/20261019120000_table_homebrew_classes.sql`.
Registro remoto atribuído pelo conector: `20261020000929_table_homebrew_classes`.
Aplicação confirmada pelo conector e pela listagem de migrações.
Colunas, três gatilhos, RLS, privilégios das RPCs e publicação Realtime conferidos.
As RPCs estão disponíveis a usuários autenticados e negadas a `anon`.
A autorização interna continua exigindo o mestre da mesa.
Sem criação de classes, fichas ou usuários de teste em produção.

## Verificação da entrega

O gate local passou com 58 testes antes da publicação.
Pacote enviado: somente os sete arquivos de `dist/` e `vercel.json`.
Versão de produção criada, arquivos conferidos e então promovida.
Domínio público retornou HTTP 200 para index.html, app.js e progression.js.
Os três arquivos servidos correspondem exatamente aos arquivos locais testados.
SHA256 app.js: `9D34E93A9628646787934A01E88675974B5C35CFC5D59136CFFC216BED583215`.
SHA256 progression.js: `C8183E9AF2FB54E08A7CC7411F65775EFD6456AD3A4C21A2B239C75FBE9CB576`.
O assessor de segurança registrou os dois novos endpoints SECURITY DEFINER
intencionais; ambos têm autorização explícita, search_path vazio e bloqueio anônimo.
Não houve teste com sessão real de jogador ou mestre nem de entrega Realtime.

## Reversão

Deploy anterior: `dpl_AMvdgXCrU6KfhTigTKajzx9p5W5K`.
URL anterior: https://grimorio-cov1024jq-hrqrics-projects.vercel.app
Pode-se restaurar essa versão da interface se necessário.
A migração é compatível com a interface anterior; não remover dados vinculados.
Reversão de schema exige o procedimento documentado em `docs/homebrew-classes.md`.
