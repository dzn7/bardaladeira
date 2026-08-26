# SPEC — Estoque do catálogo completo

## Problema

O estoque administrativo carrega somente `public.produtos`, enquanto a tela de Produtos administra
`public.produtos` e `public.bebidas`. Por isso uma bebida existente, como “Cerveja Skol”, não aparece
na busca nem pode ser controlada no estoque.

O formulário de edição também trata bebidas como exceção: oculta custo e estoque, mas ainda envia
`preco_original` e `desconto`. Essas colunas não existem em `public.bebidas`, então o PostgREST rejeita
o `PATCH` com `PGRST204`.

Além disso, as rotas server-side de notificações, visibilidade e configuração da sidebar estão recebendo
credenciais Supabase inválidas ou ausentes no deploy e respondem `500`.

## Escopo verificado

- Catálogo controlado pelo painel de Produtos: `produtos` (16 registros) e `bebidas` (13 registros).
- “Cerveja Skol” existe somente em `bebidas`.
- `combos` tem 0 registros e possui fluxo administrativo próprio.
- `adicionais` são complementos vinculados a itens, não itens vendáveis isoladamente.

Portanto, “todos os itens” nesta entrega significa todos os itens do painel de Produtos: produtos e bebidas.

## Comportamento esperado

1. O painel de estoque reúne produtos e bebidas, preservando a origem de cada registro.
2. Busca, filtros, totais e paginação são aplicados depois da união, portanto uma bebida pode ser encontrada
   independentemente da página visível.
3. Bebidas possuem preço original, desconto, custo unitário, quantidade, mínimo e bloqueio por falta de estoque.
4. Ajustes manuais e consumo/restauração por pedido atualizam a tabela correspondente ao item.
5. O site respeita o bloqueio de uma bebida sem estoque pela mesma regra de domínio já usada para produtos.
6. As três rotas server-side recebem URL, chave anônima e service role válidas no ambiente do deploy.

## Acesso a dados

- A tela lê colunas explícitas de `produtos` e `bebidas`; não cria `select('*')` novo.
- São 29 registros necessários para os totais e filtros do painel, então a busca reutiliza o conjunto carregado
  e não dispara consultas adicionais.
- Os ajustes usam RPC específica por tabela, sem SQL dinâmico e com `search_path` vazio.
- As constraints impedem custo ou estoque negativos.
- A PK de cada tabela cobre as escritas por `id`; não será criado índice de busca para um catálogo de 29 linhas.

## Migration

A migration incremental deve:

- adicionar as colunas ausentes a `bebidas` com defaults compatíveis;
- criar constraints não negativas;
- criar RPCs de ajuste e definição de estoque de bebida;
- estender os gatilhos de item e status do pedido para consumir/restaurar estoque de `bebida_id` sem alterar
  o comportamento existente de `produto_id`;
- manter privilégios das RPCs equivalentes aos RPCs legados de produto, sem ampliar grants de tabelas.

Não haverá backfill inventado: bebidas atuais começam com quantidade `0`, mínimo `5`, bloqueio desativado e
custo `NULL`.

## Critérios e provas

1. A união inclui produtos e bebidas e encontra Skol pela busca normalizada.
   Prova: `tests/estoque-catalogo.test.mjs`.
2. Campos de estoque são montados para produto e bebida, mas não para combo.
   Prova: `tests/estoque-produto.test.mjs`.
3. O SQL contém colunas, constraints, RPCs, privilégios e os dois caminhos de consumo/restauração.
   Prova: `tests/estoque-bebidas-migration.test.mjs`.
4. O SQL executa em transação e ajusta/consome/restaura uma bebida sem afetar produto.
   Prova: cenário SQL executado por Management API dentro de `begin; ... rollback;`.
5. As rotas publicadas deixam de responder `500`.
   Prova: `curl` contra os três endpoints após publicação.

## Fora de escopo

- Criar estoque próprio para combos ou adicionais.
- Corrigir os avisos de foco/`aria-hidden` do Radix.
- Reestruturar autenticação administrativa ou fechar os grants legados do banco.
