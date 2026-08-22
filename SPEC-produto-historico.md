# SPEC — Histórico e inteligência de produto

**Status:** proposta de implementação  
**Data:** 2026-08-22  
**Risco:** alto — catálogo, estoque, pedidos, promoções, auditoria e analytics.

## Contexto e estado atual

O catálogo de produtos finais usa `public.produtos`; o estado atual continua sendo
fonte de verdade dessa tabela. O projeto ativo (`olkzbualikbyudupizxz`) tem 14
produtos, mas, na auditoria de 2026-08-22, não possui pedidos nem `itens_pedido`
vinculados a produto. Não há promoção ativa.

Hoje não existe tabela de histórico de produto, ledger de estoque nem entidade de
promoção. A promoção corrente é representada no próprio produto por
`preco_original`, `preco` e `desconto`. `itens_pedido` já preserva
`preco_unitario`, `subtotal`, `subtotal_original` e `desconto_manual`, mas não
preserva a promoção que originou a venda nem o preço-base daquela promoção.

O histórico administrativo e operacional será garantido a partir da migration.
Não haverá backfill de eventos. As métricas comerciais anteriores são
explicitamente indisponíveis neste projeto porque não existem itens de pedido.

## Mapa de escrita auditado

| Caminho | Escrita atual | Responsável pelo histórico após a migration |
| --- | --- | --- |
| Novo/editar produto | `src/app/admin/produtos/page.tsx` faz `INSERT`/`UPDATE produtos` | trigger de `produtos` |
| Foto, remoção de foto, ordem e categoria em lote | `src/app/admin/produtos/page.tsx` faz `UPDATE produtos` | trigger de `produtos` |
| Ajuste rápido / zerar estoque | RPCs `ajustar_estoque_produto` e `definir_estoque_produto` | RPC define contexto; trigger de `produtos` registra movimento |
| Toggle “Esgotado no site” | `src/app/admin/estoque/page.tsx` atualiza `bloquear_venda_sem_estoque` | trigger de `produtos` |
| Inserir/editar/remover item | triggers de `itens_pedido` chamam `sincronizar_estoque_item_pedido` | função de estoque define contexto; trigger de `produtos` registra o delta |
| Cancelar/reabrir pedido | trigger de `pedidos` chama `reconciliar_estoque_status_pedido` | função de estoque define contexto; trigger de `produtos` registra o delta |
| Script, integração ou cliente adicional | atualização direta em `produtos` | trigger de `produtos`; fonte fica identificada como banco/integração não classificada |

As atualizações de atributos de um produto realizadas no mesmo `UPDATE` produzem
um único evento com as diferenças relevantes. A quantidade de estoque continua
uma operação própria (RPC/trigger de pedido), logo é uma ocorrência operacional
separada — não será agrupada por proximidade de horário, o que seria uma
inferência incorreta.

## Modelo de domínio

| Conceito | Fonte de verdade | Papel |
| --- | --- | --- |
| Produto | `produtos` | estado presente do catálogo |
| Evento de produto | `produto_historico_eventos` | audit trail append-only de mudanças administrativas, operacionais e comerciais |
| Episódio promocional | `produto_promocoes_historico` | identidade de cada intervalo promocional; fecha uma única vez |
| Snapshot comercial do item | novas colunas em `itens_pedido` | preço-base e episódio aplicados na venda; nunca recalcula pelo catálogo atual |

`produto_historico_eventos` é append-only: não haverá API/UI de editar ou apagar
eventos e a migration revoga escrita direta para `anon` e `authenticated`.
`produto_promocoes_historico` é imutável depois de criado, exceto pelo
encerramento único (`encerrada_em`) do episódio ativo. A alteração é protegida
por trigger de integridade; o evento de encerramento é append-only.

### Tipos e categorias de evento

| Categoria | Tipos semânticos |
| --- | --- |
| Alteração | `produto_criado`, `produto_atualizado`, `preco_alterado`, `produto_ocultado`, `produto_publicado`, `controle_estoque_alterado`, `estoque_minimo_alterado` |
| Promoção | `promocao_iniciada`, `promocao_alterada`, `promocao_encerrada` |
| Estoque | `estoque_ajustado`, `estoque_reservado_pedido`, `estoque_restaurado_pedido`, `estoque_esgotado`, `estoque_recuperado` |
| Comercial | a venda é o snapshot de `itens_pedido`; a Timeline a representa pelo evento de reserva associado ao pedido |

O evento armazena `antes` e `depois` estruturados somente para campos de negócio:
nome, descrição, categoria, imagem, preço, promoção, disponibilidade, custo,
estoque mínimo, bloqueio e quantidade. `updated_at` isolado nunca gera evento.

### Actor e origem

Cada evento possui `actor_type`, `actor_id`, `actor_name_snapshot`, `origem` e
`referencia_origem`. Para trigger de pedido/RPC, a origem é determinada pelo
banco (`pedido`, `cancelamento_pedido`, `ajuste_estoque`). Para atualizações
diretas sem contexto, a origem será `banco_direto` e o ator, `Sistema`.

O login atual é `localStorage`/anon, sem sessão autenticada propagada ao
Postgres; portanto o banco não consegue provar a identidade de quem fez uma
atualização client-side. Esta feature não inventará um nome de funcionário. Uma
sessão administrativa server-side é pré-requisito para atribuição humana
confiável e permanece fora de escopo.

## Persistência, constraints e segurança

1. Criar `produto_historico_eventos` e `produto_promocoes_historico` no schema
   `public`, ambos com RLS habilitada e todos os grants revogados de `anon` e
   `authenticated`.
2. A escrita vem exclusivamente de funções-trigger com `SECURITY DEFINER`,
   `search_path` vazio e `EXECUTE` revogado de `PUBLIC`; não serão endpoints
   públicos. A leitura será feita pelo service role em route handler.
3. Guardar `produto_id`, snapshot do nome, `ocorreu_em`, dados antes/depois,
   metadata, pedido e episódio quando houver. O vínculo com produto preserva o
   evento se o catálogo permitir excluir um produto; os snapshots mantêm a
   legibilidade histórica.
4. Adicionar em `itens_pedido`, apenas para `produto_id`,
   `promocao_produto_historico_id`, `preco_base_produto` e
   `preco_promocional_produto`. Trigger no insert preenche-os somente se um
   episódio ativo foi efetivamente aplicado ao preço do item.
5. Manter uma chave de fonte para operações que possam ser reexecutadas. Para
   cancelamento/reabertura, a própria transição de status é idempotente: repetir
   o mesmo status não altera estoque nem emite novo evento.

Índices planejados, baseados nas consultas reais:

- `(produto_id, ocorreu_em DESC, id DESC)` para cursor da Timeline;
- `(produto_id, categoria, ocorreu_em DESC, id DESC)` para Timeline filtrada;
- `(produto_id, iniciada_em DESC)` para episódios promocionais;
- `itens_pedido(promocao_produto_historico_id)` para analytics por episódio.

Não será criado índice geral adicional em `pedidos`: o filtro comercial parte de
`itens_pedido.produto_id`, que já é indexado, e junta `pedidos` pela PK.

## Promoções e snapshots

Uma promoção é ativa quando `preco_original > preco`. A primeira transição para
esse estado abre um episódio com preço normal, promocional e percentual. Alterar
qualquer preço de uma promoção fecha o episódio atual e abre outro; remover a
promoção o fecha. Assim “promoção X” sempre designa um intervalo e preço
concretos, nunca o estado atual do produto.

Na inserção do item de pedido, o banco relaciona a venda ao episódio ativo e
congela o preço-base/promocional. Métricas de uma promoção usam esse snapshot,
não `produtos.preco` atual. Desconto promocional é
`quantidade × (preco_base_produto - preco_promocional_produto)`; desconto manual
adicional não é atribuído falsamente à promoção.

## Consultas, métricas e fórmulas

O Dialog fará duas requisições independentes, em paralelo, para route handlers
administrativos: Timeline paginada e inteligência agregada. Nenhuma tela baixa
todos os pedidos para somar no React.

Períodos rápidos: 7, 30 e 90 dias, mês corrente e intervalo personalizado de no
máximo 366 dias. Padrão: 30 dias. O intervalo usa `created_at` dos pedidos.

Pedidos comercialmente realizados seguem a regra financeira existente: excluem
`cancelado`, `aguardando_pagamento`, `pendente` e pagamentos online ainda
`aguardando_pagamento`. Cancelamentos permanecem na Timeline, mas não compõem
receita, unidades ou pedidos realizados.

| Métrica | Fórmula |
| --- | --- |
| Pedidos | `COUNT(DISTINCT pedido_id)` dos itens do produto em pedidos realizados |
| Unidades | `SUM(itens_pedido.quantidade)` |
| Faturamento | `SUM(itens_pedido.subtotal)`; preço efetivamente persistido |
| Ticket médio do produto | faturamento / pedidos, zero se não há pedido |
| Preço médio realizado | faturamento / unidades, zero se não há unidade |
| Desconto promocional | soma do snapshot de desconto do episódio aplicado |
| Entradas/saídas | soma dos deltas positivos/negativos dos eventos de estoque no período |
| Vezes/tempo esgotado | transições reais `>0 → 0` e `0 → >0`; período aberto fecha em “agora” apenas para o recorte exibido |
| Promoção | pedidos/unidades/faturamento/desconto dos itens cujo `promocao_produto_historico_id` é o episódio |

O comparativo antes/durante/depois, quando houver dados, usa janelas com a mesma
duração do episódio e mostra apenas “unidades/dia no período”, nunca atribui
causalidade à promoção.

## UI e UX

- Em cada card de `admin/produtos`, um botão ícone `History` com `Tooltip`
  “Histórico do produto”, `aria-label` equivalente e sem competir com Editar.
- `DialogHistoricoProduto` reutiliza o `Dialog` responsivo: desktop amplo com
  Timeline (~55%) e inteligência (~45%); mobile é Drawer com resumo, Timeline e
  relatórios em Tabs.
- Header mostra foto, nome, categoria, preço corrente, quantidade, status e
  badge de promoção somente se estiver ativa.
- Timeline usa grupos Hoje/Ontem/data, filtros Tudo/Alterações/Estoque/Vendas/
  Promoções/Visibilidade e cursor “Carregar mais”. JSON nunca é exibido cru.
- O painel de inteligência usa faixa densa de métricas, gráfico Chart.js de
  evolução de preço e episódios de promoção. Loading exibe Skeletons por coluna;
  estados vazios declaram “Histórico disponível a partir de 22/08/2026”.
- Pedido é linkado somente se a rota existente `/admin/pedidos?pedido=` puder
  ser usada; não será inventada rota nova.

## Casos de borda

- Salvar valor idêntico não cria evento.
- Atualização com vários campos cria uma ocorrência com todos os diffs.
- Estoque não fica negativo; os locks e a regra de reserva existentes são
  preservados.
- Item removido/alterado restaura o saldo e ganha evento operacional genérico;
  cancelamento/reabertura ganha evento semântico próprio.
- Promoção ativa sem item que corresponda ao preço promocional não recebe
  crédito comercial.
- Evento/promoção privada não entra em Realtime nem em consultas do cardápio
  público.

## Plano de testes e critérios de aceite

Testes Node estruturais serão criados primeiro em RED e depois GREEN para:

1. criação dos objetos, RLS/grants e índices;
2. preço alterado, mesmo valor sem evento, ocultar/publicar e promoção
   iniciar/alterar/encerrar;
3. ajuste +10, venda/reserva -2, cancelamento +2 e transições de esgotamento;
4. idempotência de repetir status; snapshots e fórmula conhecida da promoção;
5. rota server-side: UUID/período/cursor inválido retornam 400, token ausente
   retorna 401 e resposta não contém dados sensíveis.

No banco ativo, a migration será ensaiada em transação e revertida, depois
aplicada somente após os testes passarem. A verificação final inclui consultas de
cenários conhecidos, `EXPLAIN` das duas consultas principais, `npx tsc --noEmit`,
`npm run lint`, build e revisão integral do diff.
