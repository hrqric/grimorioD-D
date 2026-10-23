# ADR 0002 — Classes homebrew restritas à mesa

## Estado

Aceito no escopo aprovado pelo usuário em 19/10/2026.

## Contexto

O catálogo existente é global e alimenta seleção, subclasses e level-up.
O mestre precisa cadastrar, por exemplo, Pirata exclusivamente para a mesa 1.
Uma aprovação textual de classe legada não fornece esse catálogo.
Jogadores podem participar de mais de uma mesa.

## Decisão

Estender `dnd_classes` com vínculo opcional à mesa.
Classes sem vínculo permanecem globais; subclasses herdam o escopo da classe.
Preservar as entidades e RPCs de progressão já existentes.
Cadastrar classe e subclasses em uma única RPC autorizada ao mestre.
Permitir adicionar subclasses por uma segunda RPC com a mesma autorização.
Serializar cadastro de nomes por mesa e subclasses por classe.
Filtrar seletores pela mesa da ficha, independentemente das demais mesas acessíveis.
Aplicar RLS ao catálogo e seus níveis.
Validar escopo em gatilhos também durante RPCs privilegiadas de level-up.

## Alternativa rejeitada

Um catálogo paralelo exigiria duplicar vínculos, consultas e progressão.
Guardar o cadastro somente no navegador não protegeria o uso entre mesas.
Inserções separadas poderiam persistir uma classe incompleta em falha parcial.

## Consequências

Não há nova dependência na aplicação.
A publicação exige nova migração antes da interface.
Fichas existentes não são reescritas.
Descrições são texto e são escapadas antes da renderização.
O editor de habilidades por nível fica fora desta entrega.
Reverter dados em uso exige migrar os vínculos; não há exclusão automática.
