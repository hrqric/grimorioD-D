# Catálogo da planilha D&D 2024

Fonte: classes_e_subclasses_dnd_2024-v2.xlsx, fornecida pelo usuário.
SHA-256: 4385d5b4325a090b962cba28ea47629f655191e9a187e664ed3e138713d535a7.

classes_2024_v2.json contém a extração normalizada. classes_2024_v2.sql
contém o mesmo payload e a transação de importação, executável após as
migrações de glossário e subclasses. Não requer a migração harden_level_up.

- 12 classes, 48 subclasses, 240 níveis de classe.
- 484 entradas: 12 visões de classes, 48 conceitos de subclasses,
  240 resumos por nível e 184 características de subclasses.
- 240 vínculos de ganhos de classe e 184 de subclasse.
- Mantém IDs das quatro classes/subclasses do catálogo inicial, passando
  essas classes ao catálogo PHB 2024 da planilha. O ruleset SRD e suas
  entradas próprias permanecem preservados.
- Reexecução atualiza entradas por chave natural, sem duplicar vínculos.
  Não remove conteúdo que tenha deixado de constar em uma futura planilha.
- Cada entrada guarda aba, linha, hash da origem e licença não informada.
  O conteúdo importado não é apresentado como material CC-BY do SRD.
- Características de classe permanecem agrupadas por nível, pois a fonte
  fornece nomes e rastreadores, não descrições completas de cada habilidade.
  Recursos são referências textuais do nível, não incrementos automáticos.
- A descrição do Domínio da Trapaça em Visão Geral, linha 22, contém o
  caractere "舆"; foi preservada e marcada com needs_review.

Verificado no banco: importação com rollback antes de aplicar; aplicação;
reexecução com rollback; contagens e comparação integral dos textos;
compatibilidade dos vínculos por classe/subclasse e nível; preservação dos
IDs existentes e hashes de fichas, vínculos de personagens e level-ups.
O seed falha e reverte em caso de contagens divergentes ou alteração desses
dados de personagens durante a transação.

Não é uma validação das regras contra o livro nem um motor automático de
habilidades, escolhas, espaços de magia ou recursos.
