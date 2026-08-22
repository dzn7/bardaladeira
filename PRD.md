# PRD — Bar da Ladeira

> Estado confirmado por leitura do repositório e da Supabase Management API em 2026-07-12.
> Identidade atualizada em 2026-08-15: o código veio da **Edienai Lanches somente como base inicial**. O produto oficial é **Bar da Ladeira**. Manutenção futura trata este app como Bar da Ladeira; não reintroduzir nomenclatura da base antiga. Identificador técnico/slug: `bar-da-ladeira`.

## Problema

Centralizar a operação digital e presencial do Bar da Ladeira: exposição do cardápio, entrada de pedidos por múltiplos canais, produção, impressão, salão, entrega, recebimento, caixa, crediário e acompanhamento administrativo.

## Usuários e casos de uso

| Perfil | Entrada | Uso principal |
|---|---|---|
| Cliente | `/` | Navegar no cardápio, montar carrinho, aplicar cupom, escolher entrega/retirada/local, pagar e consultar pedidos pelo telefone |
| Administrador/operador | `/admin/*` | Operar PDV, pedidos, produção, catálogo, salão, entregas, caixa, finanças, usuários, relatórios e configurações |
| Garçom | `/garcom/*` | Abrir e editar pedidos de mesa/comanda, acompanhar seus pedidos e registrar atividade |
| Entregador | `/entregador/*` | Ver entregas atribuídas, iniciar rota, concluir/cancelar entrega e abrir navegação/contato |
| Atendimento WhatsApp | Electron e Evolution API | Criar pedido manualmente pelo chat ou atender automaticamente com contexto, rascunho e fila de envio |
| Cozinha/expedição | Electron de impressão | Consumir a fila, imprimir pedido completo ou somente itens novos e permitir reimpressão |

## Escopo (o que o produto é)

- Cardápio público responsivo com produtos, bebidas, combos, adicionais, categorias, busca, carrinho persistido e status da loja.
- Checkout para entrega, retirada, mesa e local parceiro, com bairros, taxas, cupons, troco, pagamentos múltiplos e PIX online.
- Painel administrativo com dashboard, Kanban de produção, PDV, histórico/listagem de pedidos e edição detalhada.
- Gestão de salão: mesas, comandas, locais externos, ocupação, tempo limite e liberação.
- Gestão de entregas, entregadores e repasses.
- Catálogo: produtos, bebidas, combos, adicionais, categorias, ordenação, imagens e disponibilidade. Produtos finais possuem histórico operacional/comercial auditável, acessível no admin.
- Estoque operacional de produtos finais: custo opcional, quantidade, mínimo, bloqueio de venda e reserva/restauração atômica pelos itens do pedido. Bebidas, combos, adicionais e insumos ficam fora desse controle.
- Caixa, movimentações, categorias financeiras, saldos, salários, crediário, relatórios e fechamento anual.
- A Central do Admin mantém ocorrências persistentes de estoque baixo/esgotado, pedidos novos e pagamentos mensais da equipe, com preferências por administrador, deduplicação e resolução automática.
- Gestão de usuários de sistema (`admin`, `garcom`, `entregador`) e cadastro derivado de clientes.
- Controle global de visibilidade dos menus do admin e garçom pelo superusuário em `/dzn`.
- Controle visual de ações por cargo e usuário para garçons e entregadores, administrável em Usuários e no `/dzn`.
- Modo manutenção por módulo operacional, exclusivo do `/dzn`.
- Produtividade dos garçons: pontuação por pedido criado, entregue, editado e bem cadastrado, com desconto por cadastro incompleto, ranking, metas e lista de ocorrências.
- Fila de impressão compartilhada entre web e aplicativo Electron.
- Canais WhatsApp manual e automatizado, com integração Evolution API.
- PWA separada por perfil público, admin, garçom e entregador.

## Fora de escopo

Não há uma lista formal de exclusões de produto no repositório. Para cada nova tarefa, o solicitante deve definir explicitamente o que não será alterado, sobretudo quando a mudança tocar pedido, caixa, impressão, crediário ou WhatsApp ao mesmo tempo.

## 🔴 Segurança (crítico — verificado 2026-07-19 via Management API)

O modelo de acesso atual é uma **exposição de dados explorável**, não apenas uma decisão de arquitetura. Registrado aqui como risco de produto, não como característica:

- **Nenhuma das 50 tabelas tem RLS habilitado** (zero policies).
- Os roles **`anon` e `authenticated` têm grant total** (SELECT/INSERT/UPDATE/DELETE/`TRUNCATE`) nas tabelas sensíveis, incluindo `usuarios_cliente` (667), `pedidos` (7.776), `pagamentos_pedido` (6.772), `crediario_contas` (480), `funcionarios` e **`usuarios_sistema`** (11 registros, com coluna `senha_hash` e `papel`).
- A **anon key é pública** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, embutida no bundle por `src/lib/supabase.ts`) e **69 componentes client** consultam tabelas diretamente.

**Impacto:** qualquer pessoa com a anon key (extraível do site) pode, via PostgREST, **ler todos os clientes, pedidos, pagamentos e os hashes de senha do sistema**, e **apagar ou `TRUNCATE` qualquer tabela**. O login (`autenticacao.ts`, RPC `verificar_senha_usuario` + `localStorage`) é confiança no cliente: o banco já está aberto antes de qualquer autenticação.

**Remediação (tarefa própria, com autorização — migração coordenada web/Electron/bot):** habilitar RLS + policies por tabela, revogar os grants amplos do `anon`, mover as consultas sensíveis para route handlers server-side com service role, e rotacionar a service role. Também: remover `.env.local` do rastreio do git (contém `MERCADO_PAGO_ACCESS_TOKEN`, `EVOLUTION_API_KEY`, `VERCEL_OIDC_TOKEN`) e rotacionar essas chaves. Ver `AGENTS.md §3.9/§3.10` e `SKILLS.md §Segurança`.

## Arquitetura do repositório

| Parte | Caminho | Responsabilidade | Stack |
|---|---|---|---|
| Aplicação principal | `src/` | Site, PWAs por perfil, admin, APIs de pagamento/upload e integração direta com Supabase | Next.js 16, React 18, TypeScript, Tailwind CSS, Supabase JS |
| Impressora desktop | (não está neste repositório; na base original vivia como pasta irmã Electron) | Impressão automática/local e reimpressão a partir de `fila_impressao` | Electron 31, React, TypeScript, Vite, Supabase JS |
| WhatsApp desktop | (não está neste repositório; na base original vivia como pasta irmã Electron) | WhatsApp Web embutido e criação manual de pedido no chat aberto | Electron 31, React, TypeScript, Vite, Supabase JS |
| Serviço WhatsApp | (não está neste repositório; na base original era o bot Evolution) | Webhooks, conversa da Carol, memória, rascunho, outbox e notificação de pedidos | Node.js, Express, Evolution API, Supabase JS |
| Scripts operacionais | `scripts/` | Inventário, migração e manutenção de bancos via Management API | Node.js ESM |
| Documentação específica | `docs/` | Cupons e backlog visual de produtos | Markdown |

## Rotas e módulos da aplicação principal

### Público

- `/`: cardápio e checkout.
- `/contato`: informações de contato.
- `/preview-mobile-frame`: renderização do cardápio dentro do preview administrativo.

### Administração

O menu de `src/components/admin/AdminLayout.tsx` organiza o produto em quatro grupos:

- **Operações:** dashboard, painel Kanban, PDV, pedidos e novo pedido.
- **Operação:** mesas, salão, caixa, formas de pagamento, crediário, entregas, funcionários, garçons, usuários e bairros.
- **Catálogo e canais:** produtos, estoque, combos, adicionais, cupons, WhatsApp e impressora.
- **Análise:** finanças, produtividade, análise diária, relatórios e anos anteriores.

Há ainda páginas de detalhes/edição de pedido, relatórios e saldos de caixa, pedidos por garçom e uma página técnica `/admin/dev`.

### Superusuário

- `/dzn`: login exclusivo do usuário de sistema `dzn`; ativa ou oculta globalmente telas dos menus do admin e garçom.
- A configuração reutiliza `admin_sidebar_config`; itens ocultos globalmente não aparecem na sidebar, em Mais, na busca, nos atalhos nem no personalizador do admin.
- A seção Acessos gerencia permissões visuais por cargo e usuário, além do modo manutenção.
- As permissões não são uma barreira de segurança: não substituem RLS, sessão server-side ou autorização das mutações.

### Permissões operacionais visuais

- O admin configura garçons e entregadores em `/admin/usuarios`, aba Permissões.
- Cada usuário herda o cargo e pode receber override individual para permitir ou bloquear uma ação.
- Garçom: ver, criar, editar e excluir itens de pedidos; ver, criar e editar operações de mesas.
- Entregador: ver entregas e editar o status operacional.
- Configurações ficam em `permissoes_papel`, `permissoes_usuario` e `manutencao_modulos`; tabelas não aceitam `anon`, e as RPCs específicas validam credenciais administrativas antes de gravar.

### Garçom

- `/garcom`: pedidos criados pelo garçom.
- `/garcom/mesas`: visão de mesas e salão.
- `/garcom/novo`: novo pedido.
- `/garcom/editar/[id]`: edição do pedido.

### Entregador

- `/entregador`: painel de entregas atribuídas.
- `/entregador/login`: seleção/autenticação do perfil.

## Fluxos centrais

### 1. Cardápio e checkout do cliente

1. `src/app/page.tsx` carrega categorias, produtos, bebidas, combos e configurações de ordenação.
2. As alterações do catálogo são acompanhadas por canais Realtime.
3. `CarrinhoContext` mantém o carrinho no `localStorage`.
4. `ModalCarrinho` revalida cupom, classifica itens e calcula frete/taxa de pagamento.
5. Para pagamento comum, cria `pedidos`, ocupa a mesa quando aplicável, grava `itens_pedido` e `item_adicionais`, registra cupom e dispara entrega/impressão.
6. Se uma etapa crítica falhar, o frontend tenta compensar: libera mesa, remove uso do cupom e exclui o pedido criado.
7. Para PIX online, a criação passa pelas rotas server-side do Mercado Pago; o pedido é confirmado após conciliação/aprovação.

### 2. Pedido interno (PDV, admin e garçom)

1. O operador escolhe catálogo, cliente/local, pagamento e responsável.
2. O pedido nasce em `preparando` para permitir gravar itens sem impressão prematura.
3. Itens, adicionais, pagamento, entrega e mesa são persistidos.
4. A mudança final para `confirmado` permite que os triggers de impressão processem um pedido completo.
5. Pedidos de garçom registram ações em `atividade_garcom` e vinculam `garcom_id`/`adicionado_por_garcom_id`.

### 3. Produção e ciclo do pedido

- Estados observados em `pedidos`: `pendente`, `confirmado`, `preparando`, `pronto`, `entregue` e `cancelado`.
- O dia operacional de pedidos usa `America/Sao_Paulo` com corte às **03:00**: começa às 03:00 do dia de referência e termina imediatamente antes das 03:00 do dia seguinte.
- O Kanban em `/admin/painel` move pedidos entre colunas e persiste `status`/`status_atualizado_em`.
- Concluir um pedido local libera a mesa; concluir entrega sincroniza também `entregas`.
- Pagamentos parciais ficam em `pagamentos_pedido`; crediário é sincronizado por funções/triggers dedicados.

### 4. Salão

- `mesas` representa mesa, comanda ou local externo por meio do campo `tipo`.
- Mesa real alterna entre `livre` e `ocupada`, guarda pedido/cliente e possui janela de liberação.
- Local externo/parceiro pode receber pedido local sem bloquear uma mesa física.
- Admin e garçom compartilham `PainelSalaoAtual` e regras de dia operacional.

### 5. Entregas

- Pedido do tipo entrega gera ou atualiza `entregas`.
- Estados observados: `pendente`, `em_rota`, `entregue` e `cancelada`.
- Atribuição liga a entrega a um `funcionarios` do tipo entregador.
- A conclusão atualiza entrega e pedido; repasses são consolidados em `pagamentos_entregadores`.

### 6. Impressão

1. Web ou trigger cria evento em `fila_impressao` com tipo, escopo, snapshots, origem e hash de deduplicação.
2. Escopos: `pedido_completo` e `itens_novos`.
3. A impressora Electron escuta `fila_impressao` e `pedidos` por Realtime, com polling de segurança.
4. A fila percorre `pendente` → `processando` → `impresso`; falhas terminam em `erro` com tentativas e mensagem.
5. Snapshots preservam o conteúdo a imprimir mesmo se o pedido for editado depois.
6. Eventos são classificados como automáticos ou manuais. A janela configurável afeta apenas os automáticos; ações explícitas de imprimir/reimprimir continuam disponíveis.
7. As chaves `fila_impressao_automatica_ativa`, `fila_impressao_horario_inicio` e `fila_impressao_horario_fim` controlam a janela diária em `America/Fortaleza`; início igual ao fim significa 24 horas.
8. `impressao_itens_editados_ativa` controla separadamente o envio automático de `itens_novos` criado por `ModalEditarPedido`.
9. Ao pausar ou restringir a janela, pendências automáticas incompatíveis passam a `cancelado`; novas solicitações automáticas fora da regra não são inseridas. Isso impede impressão tardia em lote quando o Electron é ligado.

### 6.1 Produtividade dos garçons

- Pontuação **derivada sob demanda** de `pedidos`, `itens_pedido` e `atividade_garcom` por funções SQL (`produtividade_garcons`, `produtividade_serie_diaria`, `produtividade_ocorrencias`); não há tabela de eventos nem trigger novo, e o cálculo é retroativo.
- Ganhos: pedido criado (qualquer status, menos cancelado), pedido `entregue`, item adicionado, pedido editado (uma vez por dia operacional) e bônus de cadastro completo.
- Descontos: nome de cliente genérico (`cliente`, `mesa 7`, vazio, só dígitos, até 2 letras) e retirada/entrega sem telefone utilizável ou entrega sem endereço. Pedido cancelado é neutro por padrão.
- Pesos e metas ficam em `produtividade_config`; alterar um peso recalcula todo o histórico.
- A tabela não é acessível pelo `anon`: as funções são `security definer` e a escrita passa por `produtividade_salvar_config`, que valida chave e intervalo. Isso existe porque `SUPABASE_SERVICE_ROLE_KEY` não está configurada e o cliente "admin" do servidor cai na anon key.

### 7. Caixa, finanças e crediário

- **Caixa operacional (gaveta):** sessão em `caixas` (abrir/fechar); saldo físico e diferença do fechamento são sobre **Dinheiro**; PIX/cartão no resumo informativo; sangria/suprimento via categorias dedicadas; `fechamento_formas` (jsonb) guarda o snapshot da conferência.
- `movimentacoes_caixa` registra entrada/saída ligada a categoria, funcionário, pedido e opcionalmente `caixa_id` da sessão.
- `useCaixa.ts` + `caixa-gaveta.ts` concentram regras de gaveta, sync de pedidos e automação.
- **Finanças** (gerencial) reusa `movimentacoes_caixa` e pedidos/crediário; UI independente — despesas sem `caixa_id` não entram no saldo da gaveta.
- `crediario_contas` mantém saldo por cliente; `crediario_movimentos` guarda consumo, pagamento, cancelamento e snapshot de itens.
- Contas abertas podem receber, por ação explícita do operador, um lembrete individual via WhatsApp. Quando falta telefone, o admin solicita, valida e salva o contato antes da confirmação. A mensagem é montada no servidor com o ciclo ainda em aberto, datas, snapshots dos itens e `saldo_atual`; o envio passa pelo bot/Evolution para preservar registro e proteção de eco. Não existe disparo em massa ou automático.
- A transição futura de um pedido crediário para `entregue` quita atomicamente apenas o consumo daquele pedido, registra o pagamento vinculado e troca `forma_pagamento` para `Concluído`; pagamentos integrais da conta ou do último item fazem a mesma conversão. Pedidos históricos já entregues antes desse contrato não são baixados automaticamente.
- Pagamento manual livre nunca pode exceder `saldo_atual`; saldos negativos históricos permanecem uma reconciliação separada.
- Views `vw_crediario_contas_resumo` e `vw_usuarios_cliente_metricas` suportam telas de consulta.
- Dados de anos encerrados são movidos para tabelas `historico_*` e `resumo_anual`.
- Finanças separa resultado de caixa de lucro bruto conhecido. Vendas novas congelam o custo administrativo do item em relação privada; itens históricos sem snapshot não recebem custo inventado pelo catálogo atual.
- Agendas mensais por funcionário registram dia, antecedência, valor previsto, competência e baixa transacional em `movimentacoes_caixa`; pagamentos próximos ou atrasados alimentam a Central.

### 7.1 Estoque e notificações administrativas

- `/admin/estoque` consulta somente produtos finais e oferece busca, estado, categoria, paginação, ajuste rápido por RPC atômica e toggle “Esgotado no site” por produto.
- `itens_pedido.produto_id` reserva saldo ao inserir/alterar item e restaura exatamente o consumo ao excluir, cancelar ou reabrir um pedido.
- Quando o bloqueio está ativo, saldo insuficiente rejeita somente pedidos de origem `site`; pedidos físicos de origem `admin`/`garcom` continuam permitidos. Sem saldo, esses canais registram consumo zero e nunca deixam quantidade negativa.
- A Central usa route handlers autenticados e service role para suas relações privadas. O estoque operacional legado continua acessado pelo client anon, risco conhecido que esta task não amplia.

### 7.2 Histórico e inteligência de produto

- O estado atual continua em `produtos`; `produto_historico_eventos` é um audit trail append-only e `produto_promocoes_historico` identifica cada episódio promocional a partir de 22/08/2026. Não há auditoria administrativa retroativa inventada.
- Triggers registram alterações relevantes de catálogo, visibilidade e estoque. As rotinas já existentes de estoque acrescentam contexto causal para ajuste, reserva por pedido, cancelamento e reabertura, sem duplicar movimentos.
- `itens_pedido` congela o episódio, preço normal e preço promocional quando a venda coincide com a promoção ativa. Métricas usam o item/pedido histórico e excluem `cancelado`, `aguardando_pagamento` e `pendente`; não derivam faturamento do preço atual.
- O Dialog de produto consome funções agregadas exclusivamente por route handlers administrativos com service role. Timeline usa cursor de 25 eventos e relatórios aceitam no máximo 366 dias por consulta.
- O login atual ainda é local/client-side; por isso eventos originados por escrita direta no legado registram ator `Sistema` e origem técnica verificável, sem atribuir falsamente um funcionário. Sessão administrativa server-side é uma evolução separada.

### 8. WhatsApp

- O Electron de WhatsApp (quando presente como app desktop irmão) oferece atendimento manual: detecta o contato aberto, monta um pedido e envia o resumo no chat.
- O serviço Evolution (quando presente) recebe webhooks da Evolution API e trabalha com fila por conversa, contexto da loja, catálogo, memória do cliente, rascunho de pedido e outbox resiliente.
- Tabelas `whatsapp_*` guardam conversas, mensagens, memória, rascunhos, notificações, outbox, aliases e falhas de resolução de produto.
- O bot usa Supabase JS normalmente e tem fallback de consulta pela Management API; configurações e catálogo usam Realtime com polling de cinco minutos como segurança.
- `/admin/whatsapp` separa conexão, pausa total da Carol e pausa somente dos modelos conversacionais. A pausa de IA preserva o fluxo determinístico; o painel mostra períodos explícitos para métricas persistidas e identifica telemetria de provedor como acumulada desde o último boot. DeepSeek e OpenAI possuem detalhes expansíveis com chamadas, tokens por classe, cache, falhas, latência e custo estimado em USD pelas tarifas cadastradas do modelo, sem consulta adicional aos provedores.

## Supabase/PostgreSQL

### Projeto ativo

| Campo | Valor |
|---|---|
| Project ref | `olkzbualikbyudupizxz` |
| URL | `https://olkzbualikbyudupizxz.supabase.co` |
| Produto | Bar da Ladeira |

O `.env.local` da aplicação principal aponta para esse projeto (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). A instância anterior da base (`bawysvqqeqwxasmggfcn` / nome técnico `edienai`) não é mais o alvo do app. O inventário estrutural abaixo foi medido na instância antiga e precisa ser revalidado neste projeto.

### Inventário estrutural

- 52 relações públicas: 50 tabelas e 2 views.
- 647 colunas, 160 constraints, 199 índices, 82 funções públicas e 36 triggers.
- A Management API lista apenas duas migrations no histórico remoto, embora o schema seja muito maior. O histórico de migrations, sozinho, não reconstrói o banco atual.

### Domínios de dados

| Domínio | Tabelas/views |
|---|---|
| Catálogo | `produtos`, `bebidas`, `combos`, `combo_itens`, `adicionais`, `categorias_adicionais`, `produto_adicionais`, `categorias_cardapio` |
| Pedido e pagamento | `pedidos`, `itens_pedido`, `item_adicionais`, `formas_pagamento`, `pagamentos_pedido`, `pagamentos_online`, `cupons`, `cupons_usos` |
| Operação e identidade | `configuracoes_loja`, `bairros`, `mesas`, `entregas`, `fila_impressao`, `atividade_garcom`, `funcionarios`, `usuarios_sistema`, `usuarios_cliente`, `notification_preferences`, `anotacoes_painel` |
| Financeiro | `caixas`, `caixa_automacao_config`, `categorias_caixa`, `movimentacoes_caixa`, `pagamentos_entregadores`, `crediario_contas`, `crediario_movimentos` |
| Estoque, alertas e histórico de produto | campos de estoque em `produtos`/`itens_pedido`; `produto_historico_eventos`, `produto_promocoes_historico`, `custos_itens_pedido_admin`, `notificacoes_admin`, `notificacoes_admin_leituras`, `notificacoes_admin_preferencias`, `funcionarios_pagamento_config`, `funcionarios_pagamentos` |
| Produtividade | `produtividade_config` (pesos/metas; fechada para `anon`) + funções `produtividade_*` |
| Histórico | `historico_caixas`, `historico_entregas`, `historico_item_adicionais`, `historico_itens_pedido`, `historico_movimentacoes_caixa`, `historico_pedidos`, `resumo_anual` |
| WhatsApp | `whatsapp_conversations`, `whatsapp_customer_memory`, `whatsapp_messages`, `whatsapp_order_drafts`, `whatsapp_order_notifications`, `whatsapp_outbox`, `whatsapp_product_aliases`, `whatsapp_product_lookup_misses`, `whatsapp_session` |
| Views | `vw_crediario_contas_resumo`, `vw_usuarios_cliente_metricas` |

### Acoplamentos por trigger

`pedidos` é o principal agregado do sistema. Seus triggers cuidam de:

- número do pedido;
- timestamps e limpeza após exclusão;
- vínculo/cadastro de cliente;
- sincronização com caixa e crediário;
- criação/manutenção da fila de impressão e comportamento específico do Electron.

Outros triggers importantes atualizam snapshots de itens/fila, saldo do crediário, total de usos do cupom e `updated_at` de entidades.

### Realtime

- Catálogo, pedidos, mesas, caixa, entregas e fila de impressão continuam publicados em `supabase_realtime`.
- Tabelas de WhatsApp, histórico e resumo anual foram retiradas da publication em 2026-06-22 para reduzir egress/WAL.
- Os clientes que precisam dessas tabelas usam consulta/polling, não eventos Realtime.

## Integrações externas

| Integração | Uso | Código principal |
|---|---|---|
| Supabase | Banco, RPC e Realtime | `src/lib/supabase.ts`, `src/lib/server/supabase-admin.ts` |
| Mercado Pago | PIX, webhook e conciliação | `src/app/api/pagamentos/mercado-pago/`, `src/lib/server/mercado-pago.ts`, `src/lib/server/pagamento-online.ts` |
| Backblaze B2 | Imagens de catálogo/avatar | `src/app/api/upload/route.ts`, `src/lib/servicoUploadImagem.ts`, `src/lib/backblaze.ts` |
| Evolution API | WhatsApp automatizado | serviço bot externo (quando configurado), `src/app/api/bot/` |
| Impressoras locais | Ticket cozinha/cliente | `src/lib/impressora/`, app Electron de impressão (quando presente) |

## Stack e decisões arquiteturais

| Decisão | Escolha atual | Consequência | Data confirmada |
|---|---|---|---|
| Renderização web | Next.js App Router, com telas operacionais majoritariamente client components | Estado e acesso ao Supabase ficam próximos da UI | 2026-07-12 |
| Persistência | Supabase/PostgreSQL acessado diretamente por vários clientes | Banco e triggers funcionam como núcleo de integração | 2026-07-12 |
| Atualização operacional | Realtime com polling de fallback em serviços críticos | Baixa latência sem depender apenas do canal WebSocket | 2026-07-12 |
| Impressão | Outbox persistente em `fila_impressao` com snapshots/deduplicação | Web não precisa acessar a impressora diretamente | 2026-07-12 |
| Temas | Variáveis CSS semânticas + Tailwind; `next-themes` | Claro/escuro compartilham os mesmos componentes | 2026-07-12 |
| UI compartilhada | Primitivos shadcn/Radix em `src/components/ui` e Kibo UI em `src/components/kibo-ui` | Novas telas devem reutilizar essas bases | 2026-07-12 |
| Arquivos | Backblaze B2 via API compatível com S3 | URLs públicas ficam salvas nas entidades | 2026-07-12 |
| Estoque de produtos | Postgres reserva/restaura por `itens_pedido.produto_id`; bloqueio de saldo vale para `pedidos.origem = site`; ajustes usam RPC `SECURITY INVOKER` | O site respeita “Esgotado”, enquanto Admin/Garçom preservam a venda física | 2026-08-21 |
| Histórico de produto | Audit trail append-only por trigger, episódios promocionais identificados e snapshot em `itens_pedido`; leitura somente pelo route handler admin | Alterações não dependem da UI e métricas não usam preço atual; histórico administrativo começa na migration | 2026-08-22 |

## Hotspots e dependências sensíveis

Arquivos grandes e com alto acoplamento funcional exigem leitura dirigida antes de qualquer edição:

- `src/app/admin/pdv/page.tsx` — cerca de 2,9 mil linhas.
- `src/components/ModalCarrinho.tsx` — cerca de 2,7 mil linhas.
- `src/app/admin/pedidos/novo/page.tsx` — cerca de 2,5 mil linhas.
- `src/components/admin/ModalDetalhesPedido.tsx` e `src/app/admin/produtos/page.tsx` — mais de 2,3 mil linhas.
- `src/app/admin/mesas/page.tsx`, `src/app/garcom/novo/page.tsx`, `PainelCrediario.tsx` e `useCaixa.ts` — entre 1,5 mil e 2,1 mil linhas.

Uma mudança em pedido pode refletir em `itens_pedido`, pagamentos, entrega, mesa, caixa, crediário, impressão e notificações. O menor escopo seguro deve mapear esses consumidores antes do patch.

## Restrições e não-negociáveis

- Preservar os contratos e padrões já usados; não introduzir arquitetura ou dependência sem alinhamento.
- Consultar e administrar o banco exclusivamente pela Supabase Management API; não usar MCP.
- Nunca persistir access tokens ou outras credenciais em código/documentação.
- Não executar SQL de escrita ou migration sem autorização explícita para a tarefa correspondente.
- Não usar Playwright.
- O estado atual depende de acesso direto dos clientes ao Supabase e de triggers. Qualquer mudança de autenticação, grants, RLS, status ou trigger exige migração coordenada entre web, Electron e bot.

## Lacunas conhecidas de documentação

- Não existe uma especificação formal de regras comerciais para cada status e exceção.
- O schema remoto não está integralmente reproduzido em migrations locais/versionadas.
- As tabelas TypeScript de `src/lib/supabase.ts` cobrem somente parte do schema real.
- Não há suíte ampla de testes para os fluxos web; há um teste local isolado e uma suíte mais completa no serviço Evolution.

## Glossário de domínio

- **Pedido:** agregado de venda que conecta itens, pagamentos, entrega, mesa, cliente e impressão.
- **Dia operacional:** janela de trabalho usada para agrupar pedidos/caixa, não necessariamente o dia civil simples.
- **Mesa/comanda/local externo:** tipos de ponto de atendimento presencial em `mesas`.
- **Fila de impressão:** outbox persistente consumida pela impressora Electron.
- **Escopo de impressão:** pedido completo ou somente itens novos.
- **Crediário:** conta corrente do cliente formada por consumos e pagamentos.
- **Pagamento parcial:** divisão do total do pedido em registros de `pagamentos_pedido`.
- **Diária:** pagamento avulso a diarista (nome livre), lançado em Finanças; grava `financas_diarias` e despesa em `movimentacoes_caixa`.
- **Gaveta / caixa operacional:** dinheiro físico da sessão aberta; sangria/suprimento e fechamento conferem só Dinheiro (PIX/cartão são informativos).
- **Carol:** atendente do serviço WhatsApp via Evolution API.
- **Outbox:** fila persistente de mensagens a enviar pelo bot.
- **Estoque consumido:** quantidade efetivamente retirada do saldo para um item; pode ser menor que a quantidade vendida quando o bloqueio está desligado e é a base da restauração exata.
- **migracao_edienai_antigo:** valor técnico de `crediario_contas.origem` herdado da base; **não** rebatizar no banco. A UI exibe “Sistema antigo”.
