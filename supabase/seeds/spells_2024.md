# Importação de magias e truques

Fonte: magias_e_truques_dnd_2024.xlsx, fornecida pelo usuário.
O hash SHA-256 e a origem (aba e intervalo) constam nos metadados de cada entrada.

- 139 entradas spell: 34 truques (círculo 0) e 105 magias (círculos 1–9).
- 32 referências de magias de subclasses, sem aplicação automática nas fichas.
- 8 resumos por classe, calculados das 139 entradas. As fórmulas da matriz
  original não têm resultados em cache; ausências não foram tratadas como zero.
- 179 entradas no total, no ruleset phb-2024-workbook-v2.
- Truques recebem metadata.spell_level = 0 e metadata.tags contendo "Truques".
- Todos os campos da lista foram preservados: escola, classes, tempo, alcance,
  componentes, propriedades especiais e efeito resumido.

spells_2024.json contém os dados normalizados; spells_2024.sql contém o mesmo
payload e a transação idempotente. Execute o SQL após o seed classes_2024_v2.sql.
A importação valida contagens e igualdade integral dos textos e metadados antes
do commit; reexecução não duplica entradas. Não modifica fichas nem ganhos.

Os conteúdos são identificados como planilha fornecida, sem atribuição de licença
CC-BY do SRD. O título da planilha diz "completo", mas o importador não afirma
completude ou exatidão perante o livro. Magias mencionadas apenas nas referências
de subclasses não recebem descrições inventadas.

Verificação realizada: ensaio com rollback, aplicação, reexecução com rollback,
testes do filtro e da tag no HTML gerado. A planilha original não foi alterada.
