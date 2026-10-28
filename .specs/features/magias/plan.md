# Magias por mesa e na ficha

## Objetivo
Criar uma seção Magias com consulta por nome, círculo e classe, propostas de magias por participantes e revisão pelo mestre. Na ficha, permitir marcar e desmarcar magias preparadas por classe, preservando o texto existente.

## Comportamento
- O catálogo oficial continua derivado do glossário, com fonte e detalhes; a lista fornecida não garante cobertura completa de D&D.
- Magias propostas pertencem à mesa; jogadores ativos enviam propostas pendentes e o mestre aprova ou rejeita. O mestre pode cadastrar magias aprovadas para sua própria mesa.
- A ficha mostra magias oficiais e aprovadas da mesa vinculadas às classes do personagem; oferece pesquisa e círculos. A seleção persiste na ficha, sem inferir limites ou regras de preparação que variam por classe.
- Truques aparecem separados e identificados; a seleção é um registro manual. O texto antigo permanece editável e não é convertido automaticamente.
- Mudanças de classe ou catálogo não apagam seleções anteriores; itens indisponíveis são apresentados ao jogador para revisão.

## Banco proposto para aprovação
- Nova tabela `dnd_table_spells`, com id, mesa, autor, nome, círculo, classes, descrição e metadados de conjuração, estado de revisão, decisor e datas; validação de comprimentos, círculo e estado no banco.
- Leitura por membros ativos da mesa para magias aprovadas; propostas pendentes visíveis ao autor e mestre. Escrita e revisão protegidas por RLS e/ou funções com checagem explícita de vínculo e propriedade da mesa; ninguém pode aprovar sua própria proposta por alteração direta, salvo o mestre.
- Seleções armazenadas como identificadores estáveis no JSON da ficha, aproveitando salvamento e controle de concorrência existentes. IDs oficiais e de mesa carregam tipo para evitar colisões.
- Migração nova, sem modificar migrações anteriores; testes isolados de acesso entre mesas, submissão, aprovação, rejeição, seleção e preservação legada. Não aplicar em produção sem autorização específica.

## Verificação
Testes de filtro, seleção, preservação de dados, visibilidade e autorização; `scripts/verify.ps1`; testes SQL isolados se ambiente estiver disponível; revisão visual da prévia e da implementação.

## Prévia
`preview/proposta-magias/index.html`: demonstra catálogo, seleção e revisão com dados fictícios; não salva alterações.
