# Copiar fichas exclusivamente como mestre

## Problem
O mestre precisa duplicar uma ficha existente sem redigitar seus dados; jogadores não podem executar essa operação.

## Flow
1. Lista de fichas (existente): mestre abre a ação Copiar ficha e informa o nome.
2. Confirmação envia a origem à RPC proposta em Landing, que verifica a posse da mesa.
3. Banco cria cópia independente na mesma mesa; interface abre a nova ficha e informa sucesso.
4. Falha mantém a origem intacta e exibe mensagem; confirmação em andamento bloqueia duplo envio.

## Impact
- Original permanece intacta; nome inicial da cópia será o nome original seguido de “ (cópia)”, limitado a 150 caracteres.
- Preservar tipo, privacidade, jogador responsável, dados compartilhados e vínculos de classes/subclasses.
- Cópia nasce não arquivada, com identidade e revisão próprias; não copia histórico de level-up, retrato ou caderno privado do mestre.
- Nenhuma dependência nova. Publicação e aplicação da migração permanecem fora desta autorização local.

## Relations
Uma mesa possui muitas fichas; cada cópia pertence à mesma mesa da origem.
Uma ficha possui vários vínculos de classes; cópia recebe vínculos próprios para as mesmas classes/subclasses.
Caderno privado, histórico de progressão e mídia permanecem ligados à origem.

## Surface
| Route | In | Out | Status |
|---|---|---|---|
| RPC dnd_copy_sheet | ficha de origem e nome | nova ficha | 200 sucesso; 403 não autorizado; 400 entrada inválida; 404 origem inexistente |
A ação aparece apenas para o mestre; jogador e usuário externo também recebem recusa no banco quando chamam a operação diretamente.

## Landing
| Door | Literal shape | Rejected alternative |
|---|---|---|
| RPC transacional em nova migração | public.dnd_copy_sheet(p_sheet_id uuid, p_name text) returns public.dnd_sheets; security definer set search_path=''; permissão authenticated com verificação explícita de owner_id=auth.uid() | Insert direto pelo navegador: trigger existente impede novas fichas acima do nível 1 e não garante duplicação atômica dos vínculos |

## Criteria
AC-1: WHEN o mestre confirma uma cópia válida, o sistema SHALL criar exatamente uma ficha independente na mesma mesa com os dados e vínculos definidos em Impact.
AC-2: WHEN jogador, outro mestre ou usuário anônimo tenta copiar, o banco SHALL recusar e criar zero fichas.
AC-3: WHEN o nome é vazio ou excede 150 caracteres, o sistema SHALL recusar e preservar a origem.
AC-4: WHEN qualquer etapa da cópia falha, o sistema SHALL reverter toda a operação e mostrar o erro.
AC-5: WHILE usuário não é mestre da mesa, a interface SHALL ocultar Copiar ficha.
AC-6: WHEN copia ficha de nível maior que 1, o sistema SHALL preservar o nível sem enfraquecer a restrição das inserções diretas existentes.

## Out of scope
Copiar entre mesas, mídia, histórico de level-up, caderno privado, commit, deploy e aplicação em produção.

## Assumptions
Open questions: None - defaults aprovados com o plano.
| Question | Chosen default | Rationale |
|---|---|---|
| Conteúdo privado e histórico | Não copiar caderno, mídia ou histórico | Evita compartilhar dados privados ou eventos de outra identidade |
| Responsável e sigilo | Preservar na mesma mesa | A cópia mantém a visibilidade da origem |
| Perfil | light | Padrão da skill; testes JS e SQL de autorização e atomicidade |

## Observable
| Dimension | Landing |
|---|---|
| Permissões | RPC verifica dono da mesa independentemente do navegador |
| Persistência e concorrência | Transação única; nome validado; estado de envio bloqueia repetição |
| Erros e acessibilidade | Modal existente e mensagem de falha visível |
| Compatibilidade | Preserva trigger de nível e dados legados |
| Segurança de dados privados | Caderno privado excluído da cópia |
| Desempenho | Cópia de uma ficha e seus vínculos; sem lotes |
| Operação | Migração nova com rollback documentado |
| Observabilidade | Resultado/erro na interface; nenhum dado pessoal em logs de teste |
| Internacionalização | Textos em português no padrão atual |

## Sources
- Pedido do usuário: copiar fichas somente como mestre.
- AGENTS.md e rules/database-entities.md: aprovação para migração/contrato; autorização e operações transacionais.
- Trigger dnd_guard_sheet_level em supabase/migrations/20261011052921_preserve_legacy_subclass_and_lock_level.sql: inserções diretas só nível 1.

## Open questions
None - plano e nova RPC/migração local aprovados pelo usuário em 23/10/2026.
