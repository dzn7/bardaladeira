# SPEC — Financeiro, Lucro e Notificações do Admin

**Data:** 2026-08-20  
**Status:** aprovada pela task para implementação  
**Referência funcional (somente leitura):** `/Users/administrador/fortes-fios`

## 1. Objetivo

Evoluir o Financeiro existente do Bar da Ladeira para distinguir resultado de caixa de lucro bruto histórico e adicionar uma Central de Notificações persistente no Admin, com ocorrências de estoque e novos pedidos deduplicadas, resolvíveis e contextualizadas.

## 2. Auditoria e gap analysis

| Capacidade | Fortes Fios | Bar da Ladeira antes desta SPEC | Decisão |
|---|---|---|---|
| Receitas e despesas | Pedidos elegíveis + lançamentos manuais em `movimentacoes_caixa` | Já existe, inclusive CRUD, categorias, filtros, gráficos e diárias | Evoluir; não duplicar tabelas nem CRUD |
| Resultado de caixa | Receita − despesa | Existe, mas é rotulado como “lucro líquido” | Corrigir o conceito e o rótulo |
| Lucro por produto | RPC agrega subtotal do item menos custo congelado | Não existe; item não guarda custo | Criar snapshot e RPC agregada |
| Histórico de custo | Trigger preenche `itens_pedido.custo_unitario` no insert | Só há custo atual em `produtos` | Criar snapshot; não backfill histórico |
| Notificações | Evento global + leitura por usuário + preferência de modal | Só há preferências de push; nenhuma central interna | Criar infraestrutura própria, sem reutilizar a tabela de push |
| Estoque | Baixo/esgotado com chave ativa única | Fonte de verdade já existe em `estoque-produto.mjs` | Adaptar os mesmos limites no banco |
| Novo pedido | Normal, escalável e resolvido ao avançar status | Não existe | Criar apenas para novos eventos pós-migration |
| Modal inicial | Uma vez por sessão para ocorrências não apresentadas | Não existe | Criar; persistir apresentação no banco |
| “Não mostrar novamente” | Preferência reversível do modal | Não existe | Preferência por usuário; não silencia eventos futuros |
| Segurança das tabelas novas | RLS/revogação após correções posteriores | Banco legado do Bar da Ladeira está aberto | Novas tabelas fechadas a `anon`/`authenticated`; acesso por server route |

### 2.1 Comportamentos do Fortes que não serão copiados

- O primeiro desenho de funções permitia execução herdada por `PUBLIC`; no Bar da Ladeira toda função privilegiada terá `search_path` explícito e privilégios revogados.
- O trigger de custo do Fortes aceita um custo arbitrário enviado pelo cliente quando ele já vem preenchido. No Bar da Ladeira o banco sempre deriva o snapshot do catálogo no `INSERT`.
- Alertas de cliente inativo não serão trazidos: não são necessários ao fluxo atual do restaurante.
- Pedidos pendentes históricos não serão transformados em centenas de alertas ao instalar a feature.
- Nenhuma query de badge carregará a lista completa e não haverá polling agressivo ou subscriptions duplicadas.

## 3. Financeiro

### 3.1 Períodos e timezone

- O filtro continua usando intervalos ISO inclusivos gerados pelo cliente na timezone operacional `America/Fortaleza`.
- O agrupamento diário continua respeitando o dia de trabalho já definido em `obterDiaTrabalhoReferencia`.
- O lucro por produto recebe `inicio` e `fim` em `timestamptz` e usa o mesmo intervalo inclusivo.

### 3.2 Receita

Entram na receita recebida:

1. `pedidos.total` com status diferente de `cancelado`, `aguardando_pagamento` e `pendente`, e cujo `pagamento_online_status` não seja `aguardando_pagamento`;
2. `movimentacoes_caixa` do tipo `entrada` sem `pedido_id`.

Movimentações ligadas a pedido não são somadas novamente. Pedidos `pendente` e `aguardando_pagamento` permanecem em “a receber”. Um pedido cancelado não compõe receita nem lucro.

### 3.3 Despesas

- A persistência existente em `movimentacoes_caixa` será mantida.
- Criar, editar e excluir continuam usando categoria, descrição, valor, forma de pagamento, funcionário e data já suportados.
- Toda movimentação `saida` do período compõe despesas.
- Não há recorrência persistida; portanto a UI não inventará essa capacidade.

### 3.4 Conceitos e fórmulas

| Conceito | Fórmula |
|---|---|
| Receita de pedidos | soma de `pedidos.total` elegíveis |
| Receita extra | soma de entradas manuais |
| Receita total | receita de pedidos + receita extra |
| Despesas | soma de saídas |
| Resultado de caixa | receita total − despesas |
| Receita de produtos com custo conhecido | soma de `itens_pedido.subtotal` com snapshot de custo |
| CMV conhecido | soma de `custo_unitario × quantidade` |
| Lucro bruto conhecido | receita de produtos com custo conhecido − CMV conhecido |
| Margem bruta conhecida | lucro bruto conhecido ÷ receita de produtos com custo conhecido × 100 |

“Lucro líquido” não será exibido porque impostos, taxas de adquirência, custos de adicionais/bebidas/combos e demais custos operacionais não estão completamente modelados. Taxa de entrega, taxa de serviço e taxa de pagamento participam de `pedidos.total`/resultado de caixa, mas não da margem por produto. O `subtotal` do item já representa adicionais e descontos efetivamente persistidos; custos não modelados ficam explicitamente fora do CMV.

### 3.5 Snapshot histórico de custo

- A tabela privada 1:1 `custos_itens_pedido_admin` guarda o snapshot; o campo transitório em `itens_pedido` permanece sempre nulo porque a tabela legada é legível por `anon`.
- Depois de cada `INSERT`, um trigger obtém `produtos.custo_unitario` quando `produto_id` existe e ignora qualquer valor enviado pelo cliente.
- Alterações futuras em `produtos.custo_unitario` não modificam itens antigos.
- Registros históricos permanecem `NULL`; não haverá backfill usando o custo atual.
- Bebidas, combos e itens sem produto vinculado permanecem sem custo até que esses catálogos tenham custo próprio.
- A UI mostrará receita/unidades sem custo para impedir interpretação de lucro parcial como total.

### 3.6 Consulta de lucro

Uma função agregada no banco retorna por mês e produto: quantidade, receita com custo, CMV, lucro bruto, margem, receita sem custo e unidades sem custo. Ela:

- seleciona somente colunas necessárias;
- filtra pedidos inelegíveis;
- agrega no PostgreSQL;
- é executável somente por `service_role`;
- é chamada por route handler server-side, sem expor a função diretamente ao browser.

## 4. Notificações

### 4.1 Eventos aplicáveis

| Tipo | Prioridade | Criação | Resolução | Destino |
|---|---|---|---|---|
| `estoque_baixo` | urgente/vermelho | `0 < estoque_quantidade <= estoque_minimo` | reposição acima do mínimo ou esgotamento | `/admin/estoque?produto=<id>` |
| `estoque_esgotado` | urgente/vermelho | `estoque_quantidade <= 0` | reposição positiva | `/admin/estoque?produto=<id>` |
| `pedido_novo` | normal | novo pedido em `pendente` ou `confirmado` | pedido sai desses estados ou é cancelado | `/admin/pedidos?pedido=<id>` quando suportado; caso contrário `/admin/pedidos` |

O banco espelha exatamente os limites existentes de estoque; a regra React não será duplicada com outro threshold.

### 4.2 Modelo e ciclo de vida

- `notificacoes_admin`: ocorrência global, prioridade, entidade, chave de deduplicação, estado `ativa|resolvida` e timestamps.
- `notificacoes_admin_leituras`: estado por `usuario_chave`, com `apresentada_em`, `lida_em` e `silenciada_em`.
- `notificacoes_admin_preferencias`: preferência reversível `mostrar_modal_entrada` por usuário.

O ciclo global é `ativa → resolvida`. Por usuário, a ocorrência progride de nova para apresentada e/ou lida; silenciar afeta somente aquela ocorrência. Resolver não apaga histórico.

### 4.3 Deduplicação e recorrência

- Uma chave parcial única garante uma ocorrência ativa por `tipo + entidade`.
- Enquanto a condição continua, sincronizações atualizam a mesma linha.
- Ao resolver, a linha ativa recebe `resolvida_em`.
- Se a condição voltar depois, um novo registro é criado e volta a ser apresentável.
- Corridas são absorvidas por `INSERT ... ON CONFLICT` alinhado ao índice parcial.

### 4.4 Badge, central e atualização

- O Header consulta apenas um resumo agregado para o badge.
- A central carrega até 50 itens com colunas explícitas, ativos primeiro e depois histórico.
- Marcar como lida usa upsert por usuário/notificação.
- Após mutações locais de estoque, o contexto invalida o resumo/lista; ao recuperar foco, há reconciliação com throttle de 60 segundos.
- Não será adicionada uma subscription Realtime paralela nesta entrega.

### 4.5 Modal inicial e “Não mostrar novamente”

- O modal abre uma vez por montagem da sessão Admin quando há ocorrências ativas ainda não apresentadas ao usuário.
- Fechar o modal marca somente as ocorrências exibidas como apresentadas.
- “Não mostrar novamente” desativa somente o modal de entrada para esse usuário; a central e o badge continuam funcionando.
- A preferência pode ser reativada na central.
- Uma ocorrência futura continua válida mesmo que uma ocorrência anterior do mesmo produto tenha sido lida ou silenciada.

## 5. Banco e segurança

- Novas tabelas terão PKs, FKs com `ON DELETE CASCADE`, checks, timestamps, RLS habilitada e privilégios diretos removidos de `PUBLIC`, `anon` e `authenticated`.
- `service_role` recebe somente os privilégios necessários.
- Funções `SECURITY DEFINER` terão `SET search_path = ''`, relações qualificadas e `EXECUTE` revogado de papéis públicos.
- Índices: ocorrência ativa por dedupe, leitura por usuário, listagem ativa por prioridade/data e lucro por pedido/produto.
- Nenhum token Management API será persistido.
- Limitação conhecida: a autenticação Admin atual do Bar da Ladeira é client-side e o banco legado inteiro está sem RLS. Esta entrega fecha apenas as tabelas e funções novas; corrigir autenticação/RLS global exige migração coordenada própria.

## 6. UX

- Financeiro mantém cards, filtros, tabelas, dialogs e gráficos existentes; adiciona uma seção de lucro bruto com aviso de cobertura de custo.
- Alertas de estoque baixo e esgotado usam vermelho forte conforme o requisito do Bar da Ladeira.
- Desktop usa Popover para a central; mobile usa Drawer com área rolável, rodapé alcançável e safe-area.
- Modal inicial usa Dialog responsivo, conteúdo rolável e ações fixas sem scroll duplo.
- Estados de loading, erro e vazio serão explícitos.
- A central e o modal usam destinos reais e não criam páginas paralelas.

## 7. Testes de aceite

### 7.1 Financeiro

- CRUD de despesas é exercitado transacionalmente no SQL.
- Filtro de período e status elegíveis são testados.
- Receita, custo, lucro bruto e resultado de caixa são calculados em centavos.
- Cancelado/pendente não alteram o realizado.
- Alterar custo atual não muda snapshot anterior.
- Histórico sem custo continua identificado como incompleto.

### 7.2 Notificações

- Baixo e esgotado geram urgente.
- Condição contínua não duplica.
- Reposição resolve; reincidência cria nova ocorrência.
- Badge considera não lidas.
- Leitura, apresentação e preferência persistem.
- Modal abre somente para ocorrência elegível.
- Link de estoque é contextual.

### 7.3 Validação permitida

Serão executados testes Node/SQL, typecheck, lint e build. Playwright e automação de browser não serão criados nem executados porque o `AGENTS.md` do projeto os proíbe explicitamente; responsividade será validada por estrutura, componentes existentes e revisão de classes.
