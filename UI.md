# UI — Bar da Ladeira

> Fonte da verdade visual confirmada em 2026-07-12. Consulte este documento e os componentes compartilhados antes de criar UI.

## Fundamentos

- Tailwind CSS 3 com tokens definidos em `src/app/globals.css` e mapeados em `tailwind.config.js`.
- shadcn no estilo `new-york`, base `slate`, sem prefixo e com CSS variables.
- Tema por classe via `next-themes`, padrão `system`.
- Interface em português do Brasil.
- Ícones predominantemente `lucide-react`; alguns ícones de domínio ficam em `src/components/icons/`.

## Tipografia

| Uso | Fonte | Token/classe |
|---|---|---|
| Corpo, títulos e UI | Geist (única, igual Juridiq) | `--font-geist` via `geist.className` no `layout.tsx` |
| Valores monoespaçados | `font-mono tabular-nums` (stack do tema) | Totais/preços no PDV e cards; sem JetBrains dedicado |

Pesos Geist carregados: 100–900 (`public/fonts/Geist-*.woff2`). Manrope / Bricolage / Outfit / JetBrains no PDV removidos.

## Design tokens

### Tokens semânticos obrigatórios

`background`, `foreground`, `card`, `card-foreground`, `surface-raised`, `popover`, `popover-foreground`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `border`, `input` e `ring`.

Há tokens equivalentes para sidebar. Novos componentes devem preferir esses nomes às escalas de cor diretas.

### Paleta atual (alinhada ao Juridiq)

- **Primário / ações:** `primaryBlue` `#0296F9` (`--primary` em claro e escuro). Escala: `secondaryBlue` `#0D9DFD`, `tertiaryBlue` `#5EBDFD`, `quaternaryBlue` `#86CEFD`.
- **Claro:** fundo branco, cards brancos, texto slate (`222.2 84% 4.9%`), borders `214.3 31.8% 91.4%` — tokens do `global.css` Juridiq.
- **Escuro:** fundo `222.2 84% 4.9%`, cards `#1D1E1E` (`180 2% 12%`), texto quase branco; sem primário dourado.
- Aliases históricos `laranja`/`bordo`/`dourado` no CSS apontam ao azul Juridiq por compatibilidade.
- Estados operacionais: emerald/rose/amber; acento de UI preferir `primaryBlue` / `primary` em vez de `sky-*`.

### Paleta do cardápio público (Bar da Ladeira)

Escopo **somente** `/`, `/preview-mobile-frame` e os overlays do cliente. Classe `tema-publico` no wrapper da Home **e** em `document.documentElement` (para Drawers/portais). **Não** alterar `:root` — o admin, garçom, entregador e `/dzn` continuam Juridiq azul `#0296F9`.

- **Claro:** pergaminho `36 32% 93%`, texto espresso, primário terracota do telhado da marca `16 52% 38%`, cards creme, bordas taupey.
- **Escuro:** fundo madeira quase preta `24 18% 7%` (como o logo), texto creme, primário terracota mais claro `18 48% 50%`.
- CTAs, chips ativos, badge do carrinho e confirmação de pedido usam `primary` / `primary-foreground`.
- Pedido enviado no checkout é **Drawer** (mesmo `Drawer` do Vaul do checkout), não overlay `modal-overlay`.

### Forma e elevação

- Radius global: `0.625rem`.
- Controles operacionais usam em geral `rounded-md`/`rounded-lg`.
- Modais compartilhados usam `rounded-xl`, borda semântica e sombra baixa.
- Evitar excesso de cards, cantos muito arredondados e sombras dramáticas.

### Movimento

Animações disponíveis incluem `fade-in`, `slide-up`, `scaleIn`, `shimmer` e rotações/spinners. Framer Motion é usado em telas específicas. Movimento deve comunicar transição/estado, não decorar controles rotineiros.

## Primitivos compartilhados

Todos ficam em `src/components/ui/` e devem ser reutilizados antes de criar qualquer base local.

| Grupo | Componentes | Quando usar |
|---|---|---|
| Ações | `Button`, `Toggle`, `ToggleGroup`, `DropdownMenu`, `MenuAcoes`, `Command` | Ações, alternâncias e menus; preferir `MenuAcoes` para menus ⋯ de lista/card |
| Entrada | `Input`, `Textarea`, `Select`, `Checkbox`, `Field`, `Label` | Formulários; preferir `Field` para composição nova |
| Overlay | `Dialog`, `AlertDialog`, `Sheet`, `Drawer`, `ModalSheet`, `Popover`, `Tooltip` | Modal, confirmação, painel mobile e ajuda contextual |
| Navegação | `Tabs`, `Pagination`, `ScrollArea` | Alternância de seções, listas extensas e paginação |
| Dados/estado | `Table`, `Badge`, `Progress`, `Skeleton`, `Empty`, `Separator`, `Avatar` | Tabelas, status, loading, vazio e avatar Radix |
| Filtros admin | `FiltrosAtivosChips`, `ListaVazia`, `GradeSkeleton`/`ListaSkeleton`/`TabelaSkeleton`, `chip-classes` | Pills Juridiq + chips ativos + estados de lista em `/admin` |
| Especial | `Iphone` | Moldura do preview mobile administrativo |

Primitivos Kibo UI disponíveis:

- `MiniCalendar` e subcomponentes em `src/components/kibo-ui/mini-calendar/`.
- `Pill`, `PillStatus`, `PillIndicator` e `PillIcon` em `src/components/kibo-ui/pill/`.

## Componentes de produto existentes

### Público/cardápio

| Componente | Caminho | Responsabilidade |
|---|---|---|
| `Header` | `src/components/Header.tsx` | Cabeçalho, marca e ações do cardápio |
| `CartaoProduto` | `src/components/CartaoProduto.tsx` | Item de produto |
| `CartaoBebida` | `src/components/CartaoBebida.tsx` | Item de bebida |
| `CartaoCombo` | `src/components/CartaoCombo.tsx` | Item de combo |
| `ModalComplementos` | `src/components/ModalComplementos.tsx` | Quantidade, adicionais e observações |
| `ModalCarrinho` | `src/components/ModalCarrinho.tsx` | Checkout completo; confirmação de pedido enviado no mesmo Drawer |
| `AjudaPedidoPublica` | `src/components/AjudaPedidoPublica.tsx` | Drawer de “Como pedir”, aberto somente pela navbar, com contato por WhatsApp |
| `ModalSelecionarMesa` | `src/components/ModalSelecionarMesa.tsx` | Escolha do ponto local |
| `ModalPedidosCliente` | `src/components/ModalPedidosCliente.tsx` | Consulta de pedidos por cliente |
| `ModalNotificacao` | `src/components/ModalNotificacao.tsx` | Feedback padronizado legado |
| `ImagemOtimizada` | `src/components/ImagemOtimizada.tsx` | Exibição de imagem com fallback |

### Administração

| Componente | Caminho | Responsabilidade |
|---|---|---|
| `AdminLayout` | `src/components/admin/AdminLayout.tsx` | Sidebar, header, comandos, atalhos, tema, alertas de salão e Central de Notificações; personalização via `SidebarPersonalizarModal` + API |
| Dashboard | `src/app/admin/dashboard/page.tsx` | Faixa KPI (hoje/mês) + loja compacta + fila impressão + pedidos (tabela desktop / cards mobile); sem aviso de jogo |
| `ControleStatusLoja` | `src/components/admin/ControleStatusLoja.tsx` | Status abrir/fechar + auto; edição de grade semanal em Dialog; AlertDialog de confirmação |
| `AvisoJogoBot` | `src/components/admin/AvisoJogoBot.tsx` | Config de aviso de jogo do bot — vive na aba Jogo de `/admin/whatsapp` |
| `/admin/whatsapp` | `src/app/admin/whatsapp/page.tsx` + `ConfiguracoesBot` | Conexão Evolution, notificações e automação da Carol; pausa total e pausa somente da IA são controles distintos; métricas sempre informam período e telemetria de modelo é desde o último boot; DeepSeek/OpenAI são accordions acessíveis com gasto estimado, tokens, cache, chamadas e latência por provedor |
| `AvatarUsuario` | `src/components/admin/AvatarUsuario.tsx` | Avatar Juridiq: foto ou iniciais (1ª+última palavra) + `cor`; sizes `xs`–`lg`; usa `ui/avatar` |
| `SidebarPersonalizarModal` | `src/components/admin/SidebarPersonalizarModal.tsx` | Ocultar/reordenar/renomear grupos; drag HTML5; Eye/EyeOff; persiste em `admin_sidebar_config`; no mobile fecha o Drawer da sidebar ao abrir |
| `GerenciadorVisibilidadeTelas` | `src/components/dzn/GerenciadorVisibilidadeTelas.tsx` | `/dzn`: login próprio e toggles globais por perfil; usa `Interruptor`, linhas densas e tokens semânticos |
| `GerenciadorPermissoesEquipe` | `src/components/admin/GerenciadorPermissoesEquipe.tsx` | Permissões visuais por cargo/usuário; no modo DZN também controla manutenção |
| `CardPedido` | `src/components/admin/CardPedido.tsx` | Card operacional: canal (entrega/mesa/retirada), status, itens, total; em dívida crediária o CTA explicita “Concluir e quitar”; conta quitada nunca mantém selo nem barra de Crediário; ⋯ para detalhes/editar/WhatsApp/PDF |
| `ModalDetalhesPedido` | `src/components/admin/ModalDetalhesPedido.tsx` | Visão completa e ações do pedido; aberto também via `?pedido=` em `/admin/pedidos` (deep-link do Crediário) |
| `ModalFormaPagamentoItens` | `src/components/admin/pagamento/ModalFormaPagamentoItens.tsx` | Itens, quantidades disponíveis e formas permitidas | Reutilizar para pagamento parcial no Pedido e quitação de item do Crediário; o Crediário não habilita a própria forma Crediário |
| `ModalEditarPedido` | `src/components/admin/ModalEditarPedido.tsx` | Edição de pedido existente; em `entrega` a seção Dados traz **seletor de bairro** e a taxa é derivada dele (nunca fixa). Bairro fora do cadastro continua selecionável e pedido sem bairro preserva a taxa já gravada |
| `ColunaKanban`/`CardPedidoKanban` | `src/components/admin/painel/` | Painel de produção Juridiq: board horizontal snap + cards densos + MenuAcoes; pills de coluna no mobile |
| `PainelSalaoAtual` | `src/features/salao/components/PainelSalaoAtual.tsx` | Salão: pills de filtro + busca + grade de `CardMesaSalao`; dialogs de histórico/garçom |
| `CardMesaSalao` | `src/features/salao/components/CardMesaSalao.tsx` | Card operacional da mesa (tempo crítico, total, timeline, ações primárias + `MenuAcoes`) |
| `DialogNovoPedidoSalao` | `src/features/salao/components/DialogNovoPedidoSalao.tsx` | Entrada de pedido a partir do salão |
| Análise diária | `src/app/admin/analise-diaria/page.tsx` + `src/features/analise-diaria/` | Header Crediário: KPIs **inline** (sem grid de cards) + `SeletorDiaOperacional` (Popover); seções `SecaoRelatorio`; produtos = ranking denso (qtd/pedidos/%/barra); listas `divide-y` |
| Relatórios | `src/app/admin/relatorios/page.tsx` | Faixa KPI Juridiq + filtros período (pills) + seções com charts/PDF; loading Skeleton; tokens semânticos |
| Combos | `src/app/admin/combos/page.tsx` | Shell `max-w-6xl` + header card; busca por nome; cards densos + `MenuAcoes`; Dialog form; Empty; toast sonner |
| `BarraPagamentoParcial` | `src/components/admin/BarraPagamentoParcial.tsx` | Progresso e saldo de pagamentos |
| `PainelFinancas` | `src/features/financas/components/PainelFinancas.tsx` | Finanças Juridiq: resultado de caixa ocultável; Receitas/Despesas/Pagamentos da equipe; análise separa caixa de lucro bruto histórico |
| `GestaoPagamentosFuncionarios` | `src/features/financas/components/GestaoPagamentosFuncionarios.tsx` | Agenda mensal por funcionário, competência, estado e baixa transacional no caixa |
| `ResumoLucroProdutos` | `src/features/financas/components/ResumoLucroProdutos.tsx` | Receita coberta, CMV conhecido, lucro/margem bruta e ranking sem inventar custo histórico |
| `CentralNotificacoes` | `src/features/notificacoes/CentralNotificacoes.tsx` | Sino e badge no Header; painel desktop/bottom sheet mobile, leitura, dispensa, navegação contextual e preferências por categoria |
| `ModalNotificacoesEntrada` | `src/features/notificacoes/ModalNotificacoesEntrada.tsx` | Ocorrências ainda não apresentadas, com preferência reversível para não abrir automaticamente |
| `CardRadialFinancas` | `src/features/financas/components/CardRadialFinancas.tsx` | Card Receitas/Despesas (verde/laranja/azul + donut Chart.js) espelhando `ChartRadialStacked` do Juridiq |
| `ListaMovimentacoes` | `src/features/financas/components/ListaMovimentacoes.tsx` | Desktop: tabela Juridiq (borda-l verde/vermelho, status centralizado, row clicável). Mobile: `CardMovimentacaoFinancas`. Paginação default 15 |
| `CardMovimentacaoFinancas` | `src/features/financas/components/CardMovimentacaoFinancas.tsx` | Card mobile estilo Juridiq `FinanceTransactionCard` para lançamentos |
| `ListaPagamentos` / `ListaPedidosNaoPagos` / `ListaCrediarioPendente` | `src/features/financas/components/` | Tabelas Juridiq + cards mobile + Empty/Skeleton + paginação 15 |
| `PaginacaoFinancas` | `src/features/financas/components/PaginacaoFinancas.tsx` | Paginação estilo Juridiq (15/30/50/100 + setas) |
| `PainelCrediario` | `src/features/crediario/components/PainelCrediario.tsx` | Crediário Juridiq: faixa de resumo, pills, tabela/cards, paginação 15; modais em linguagem leiga (fiado / ainda deve); refetch silencioso; deep-link “Abrir pedido” → `/admin/pedidos?pedido=`; cobrança individual pede e salva o telefone ausente, depois exige confirmação mostrando destinatário/saldo |
| `CardContaCrediario` | `src/features/crediario/components/CardContaCrediario.tsx` | Card mobile da conta (nome + “ainda deve” + badges + `MenuAcoes`); conta aberta com saldo exibe ação direta verde com o `IconeWhatsApp` real, mesmo sem telefone cadastrado |
| `MenuAcoes` | `src/components/ui/menu-acoes.tsx` | Dropdown ⋯ padrão Juridiq (itens com ícone + variantes) — reusar em listas; `onSelect` sem `preventDefault` (fecha antes de abrir modal) |
| `PainelProdutividade` | `src/features/produtividade/components/PainelProdutividade.tsx` | Produtividade dos garçons (`/admin/produtividade`): header com pills de período (Hoje/Semana/Mês/Período) + faixa KPI inline (pontos, pedidos, entregues, vendas, perdidos, líder) |
| `CardMetasProdutividade` | `src/features/produtividade/components/` | Metas dia/semana/mês em janelas **fixas** (não seguem o filtro), com barra de progresso e CTA “Ajustar pontuação” |
| `RankingGarcons` | `src/features/produtividade/components/` | Ranking Juridiq: troféu nos 3 primeiros, selo de qualidade, tabela desktop / accordion mobile, `MenuAcoes`; quem não trabalhou no período vai para o fim sem posição |
| `GraficoPontosGarcom` / `GraficoEvolucaoPontos` | `src/features/produtividade/components/` | Barras empilhadas ganhos × perdas (Chart.js) e linha por dia operacional; com período de um dia só, a evolução cai para o mês corrente e avisa no subtítulo |
| `ListaOcorrencias` | `src/features/produtividade/components/` | “Pontos perdidos”: pedido, motivo, valor descontado; filtro por garçom em pills, paginação 15 e deep-link `/admin/pedidos?pedido=` |
| `DetalheGarcomDialog` / `ModalConfigPontuacao` | `src/features/produtividade/components/` | Composição dos pontos do garçom (quantidade × peso) e edição de pesos/metas |
| `PainelGarcons` / `ListaGarcons` | `src/components/admin/garcons/` | Dia operacional até **3h**; KPIs criados/editados/**vendas**; mobile **accordion** (avatar + Ver pedidos); sem ícone decorativo de talheres |
| Caixa operacional | `src/app/admin/caixa/page.tsx` + `src/components/admin/caixa/` | Gaveta do dia: saldo dinheiro, sangria/suprimento, fechamento com conferência; extrato estilo Crediário (`Wallet`); Finanças intocada |
| `FiltroAvancado` | `src/components/admin/filtros/FiltroAvancado.tsx` | Padrão Juridiq: botão Filtrar → Dropdown (desktop) / Sheet (mobile) com abas laterais + Limpar/Aplicar |
| `CampoSelectFiltro` | `src/components/admin/filtros/CampoSelectFiltro.tsx` | Label + Select padrão para conteúdo das abas do Filtrar |
| `FiltroPedidosAdmin` | `src/features/pedidos/components/FiltroPedidosAdmin.tsx` | Status + tipo — `/admin/pedidos` |
| `FiltroEntregasAdmin` | `src/features/entregas/components/FiltroEntregasAdmin.tsx` | Período + status + entregador — `/admin/entregas` |
| `FiltroProdutosAdmin` | `src/components/admin/produtos/FiltroProdutosAdmin.tsx` | Status / tipo / foto / categoria — `/admin/produtos` |
| `ModalFormularioProduto` | `src/components/admin/produtos/ModalFormularioProduto.tsx` | Criar/editar produto ou bebida em Dialog; ambos incluem custo, quantidade, mínimo e bloqueio de venda |
| `DialogHistoricoProduto` | `src/components/admin/produtos/DialogHistoricoProduto.tsx` | Ícone discreto no card de produto final; desktop com Timeline e desempenho em duas colunas, filtros independentes, cursor e gráfico Chart.js; mobile usa abas Timeline/Relatórios no Drawer responsivo |
| `ControleEstoqueProduto` | `src/components/admin/estoque/ControleEstoqueProduto.tsx` | `−` / input / `+` / Zerar; RPC atômica, otimista, rollback e lock por linha |
| `/admin/estoque` | `src/app/admin/estoque/page.tsx` | KPIs inline, busca, pills de estado, categoria, toggle “Esgotado no site”, tabela/cards, paginação e deep-link `?produto=` |
| `FiltroEstoqueAdmin` | `src/components/admin/estoque/FiltroEstoqueAdmin.tsx` | Categoria via `FiltroAvancado` na tela de estoque |
| `FiltroFuncionariosAdmin` | `src/components/admin/funcionarios/FiltroFuncionariosAdmin.tsx` | Função + status — `/admin/funcionarios` |
| `FiltroPedidosGarcom` | `src/components/admin/garcons/FiltroPedidosGarcom.tsx` | Abas Geral / Pagamento / Período para monitoramento de pedidos do garçom |
| `PedidosCriadosGarcom` | `src/components/admin/garcons/PedidosCriadosGarcom.tsx` | Default **hoje (3h)**; KPI **Vendas** = total do filtro (não da página); lista mobile densa com ícone por canal |
| `GerenciadorFuncionarios` | `src/components/admin/GerenciadorFuncionarios.tsx` | Funcionários Juridiq: faixa de resumo, pills, tabela/cards, Dialog shadcn, `MenuAcoes`; no **novo** funcionário, toggle **Criar acesso ao sistema** (pré-ativado) com foto, login, senha, papel e cor |
| `GerenciadorUsuariosClientes` | `src/components/admin/GerenciadorUsuariosClientes.tsx` | Clientes Juridiq: faixa de resumo, busca + pills, tabela/cards, `MenuAcoes`; modal detalhes 2 colunas (padrão Crediário); WhatsApp via `IconeWhatsApp` |
| `GerenciadorUsuariosSistema` | `src/components/admin/GerenciadorUsuariosSistema.tsx` | Acessos sistema: resumo, busca + chips função, tabela/cards, Dialog p-0, `MenuAcoes`, avatar via `ModalRecorteAvatar`; select sem `senha_hash`; no **novo** usuário, toggle **Cadastrar como funcionário** (pré-ativado) com função e telefone |
| `/admin/usuarios` | `src/app/admin/usuarios/page.tsx` | Shell Juridiq (header + Tabs); default aba clientes |
| `AppToaster` | `src/components/AppToaster.tsx` | Sonner: topo no mobile (`top-center`), topo-direita no desktop; estilos ricos |
| `ModalMovimentacao` | `src/features/financas/components/ModalMovimentacao.tsx` | Modal criar/editar receita ou despesa (layout Juridiq: descrição, valor, data, categoria, forma) |
| `StatCardsFinanceiros` | `src/features/financas/components/StatCardsFinanceiros.tsx` | Resumo legado (lucro/pedidos/a receber); substituído na tela principal pelo `CardRadialFinancas` |
| `GerenciadorImpressao` | `src/components/admin/GerenciadorImpressao.tsx` | Estado e reprocessamento da fila |
| `ConteudoPreview`/`ModalPreviewMobile` | `src/components/admin/` | Preview do cardápio público |
| `ModalRecorteImagem`/`ModalRecorteAvatar` | `src/components/admin/` | Crop em Dialog Juridiq (`primary`, header/body/footer); produto retangular / avatar circular |

### Login e perfis

| Componente | Caminho | Responsabilidade |
|---|---|---|
| `TelaSelecaoPerfil` | `src/components/login/TelaSelecaoPerfil.tsx` | Seleção visual de usuário |
| `CardPerfilUsuario` | `src/components/login/CardPerfilUsuario.tsx` | Card de perfil |
| `ModalSenhaLogin` | `src/components/login/ModalSenhaLogin.tsx` | Entrada de senha |
| `TransicaoLogin` | `src/components/login/TransicaoLogin.tsx` | Transição após autenticação |
| `GarcomLayout` | `src/components/garcom/GarcomLayout.tsx` | Shell das telas do garçom |
| Novo pedido do garçom | `src/app/garcom/novo/page.tsx` | Em `entrega`, **bairro é obrigatório** (select do cadastro, acima do endereço) e a taxa vem dele; pré-preenchido pelo cliente salvo e por "repetir pedido", mas só vale se o nome existir no cadastro ativo |

## Padrões de layout

### Cardápio público

- Mobile-first, com busca, categorias horizontais e grade responsiva.
- Cards de produto têm imagem dominante, nome/preço e ação direta.
- Checkout é modal por etapas e precisa caber em `100dvh` sem perder ações.
- O carrinho e dados básicos do cliente persistem localmente.
- No mobile, adicionar item não interrompe a escolha; o carrinho é acessado pelo item `Carrinho` do menu inferior, sem CTA adicional sobre o catálogo.
- A adição confirma por toast curto com ação opcional `Ver carrinho`; produtos com complementos seguem o mesmo feedback e nunca abrem o checkout automaticamente.
- O checkout usa o `Drawer` real do projeto no mobile, com conteúdo rolável e rodapé de total/ação sempre visível.
- Enquanto um fluxo modal estiver aberto, o menu inferior não é renderizado; superfícies Vaul usam overlay em `z-[1000]` e conteúdo em `z-[1001]`. O seletor de mesa **e o seletor de bairro** são `DrawerNested` dentro do checkout; os overlays legados de alerta e PIX permanecem acima da superfície.
- O checkout usa `repositionInputs={false}` no `Drawer` e mede o teclado virtual por `useAjusteTecladoVirtual` (`src/hooks/`), aplicando `height`/`maxHeight`/`bottom` em px no `DrawerContent`. O reposicionamento nativo do Vaul não serve para painel alto com formulário: ele alterna um booleano a cada `visualViewport.resize` e Safari/Chromium emitem vários por animação de teclado, congelando o painel em uma altura curta.
- Ajuda abre o `AjudaPedidoPublica` exclusivamente pela navbar; WhatsApp aparece dentro desse Drawer quando estiver configurado.
- O service worker do cardápio não roda em desenvolvimento e nunca armazena HTML nem payload RSC; misturar documentos e chunks de versões diferentes provoca divergência de hidratação.

### Administração desktop

- No Dashboard, “Pedidos hoje”, “Receita hoje” e a lista “Pedidos do dia” seguem o dia operacional 03:00→03:00 em `America/Sao_Paulo`; o resumo mensal continua usando o mês civil selecionado. Em `/admin/pedidos`, a lista preserva todo o histórico e o cabeçalho separa a contagem do dia operacional da contagem do resultado atual.
- O `AdminLayout` é o dono do scroll vertical (`data-admin-scroll-container`) e sempre volta ao topo ao mudar de rota; telas paginadas devem reposicionar esse container sem animação antes de trocar a altura do conteúdo.
- O service worker do admin nunca armazena navegações HTML nem payloads RSC (`RSC`, `_rsc`, `text/x-component`); esses documentos precisam vir da mesma versão dos chunks do Next.
- Sidebar colapsável: **112 px** fechada (estilo Juridiq) e 224 px aberta; logo `/logo.webp` + “Bar da Ladeira”; item ativo com barra esquerda absoluta + `bg-primary/10` (ícones opticamente centralizados quando fechada); grupos com abreviação de 3 letras e divisores no estado colapsado.
- Scroll da sidebar desktop é preservado entre navegações (`renderSidebarContent` + restore de `scrollTop`); não redefinir o menu como componente interno do layout.
- Largura via `--largura-sidebar-admin` (`AdminLayout`); sombra leve na rail.
- Ícones da sidebar (`admin-sidebar-routes.ts`): cada rota com ícone distinto — Caixa `Wallet`, Crediário `Coins`, Finanças `Landmark`, Usuários `UserCog`, Funcionários `Contact`, Produtos `CookingPot`, Estoque `Package`, Combos `Layers`, Adicionais `ListPlus`.
- `Button` (`ui/button`): variantes com tokens (`primary` / `border-border/70` / `destructive`) — sem `bordo`/`zinc`.
- Personalizar sidebar: botão no rodapé; itens ocultos no menu **Mais**; renomear grupos (lápis); config por usuário em Postgres (`admin_sidebar_config`). No mobile, abrir Personalizar fecha o Drawer do menu.
- Visibilidade global: `/dzn` controla admin e garçom. Tela desativada globalmente não aparece em nenhum menu, em **Mais**, na busca, nos atalhos ou no personalizador.
- Permissões da equipe: `/admin/usuarios` permite ao admin ajustar garçons e entregadores após reautenticação. Cargo usa switches; usuário usa `Padrão do cargo`, `Permitir` ou `Bloquear`.
- Modo manutenção: exclusivo do `/dzn`; módulo pausado some do menu e mostra estado bloqueado ao abrir a rota.
- Esses controles são visuais. A interface deve nomeá-los assim e nunca apresentá-los como segurança de banco.
- Avatares de usuário/funcionário/login: sempre `AvatarUsuario` (não `div` circular ad-hoc).
- Atalhos globais: `Ctrl/Cmd+K` para comando e `Alt+<tecla>` para rotas frequentes.
- Preferir faixas compactas, tabelas, listas e linhas densas às pilhas de cards.
- Conteúdo precisa continuar utilizável com sidebar colapsada e em viewport menor.
- Páginas de catálogo polidas (`/admin/bairros`, `/admin/adicionais`, `/admin/combos`): shell `mx-auto w-full max-w-5xl|6xl space-y-5`; header card `rounded-xl border border-border/70 bg-card p-4 sm:p-5` com ícone `text-primary`, contagem no subtítulo e CTAs outline+primary; listas densas com `MenuAcoes` para ações secundárias; empty via `@/components/ui/empty`.

### Estoque (`/admin/estoque`)

- Shell `max-w-6xl`; resumo inline Em estoque / Estoque baixo / Esgotados, sem grid de metric cards.
- Busca normaliza acento/caixa; pills de estado + `FiltroAvancado` de categoria; tabela semântica desktop e cards mobile.
- Ajuste rápido (`−` / input / `+` / Zerar): Enter confirma, Escape restaura, blur vazio restaura, lock somente na linha e alvos de 44px.
- Cada produto ou bebida mostra o `Interruptor` “Esgotado no site”: ligado + quantidade zero desabilita o item apenas no cardápio público; o pedido físico continua permitido.
- Paginação 15/30/50/100; deep-link `?produto=<uuid>` destaca o produto; mutation reconcilia somente a linha alterada.
- Quantidade do modal nunca entra no `insert`/`update` geral: ela passa exclusivamente pela RPC atômica correspondente a produto ou bebida.
- Histórico de produto: abrir pelo ícone `History` com `Tooltip`; não oferecer edição/exclusão de eventos. Desktop mantém Timeline (~55%) e desempenho (~45%) em colunas com cabeçalho persistente; mobile usa as abas do `Dialog` responsivo. Skeleton inicial não bloqueia a leitura do cabeçalho do produto.

### Administração mobile

- Sidebar vira `Drawer` (vaul, bottom sheet) no padrão Juridiq.
- Modais usam `Dialog` responsivo (Drawer abaixo de 768px) ou `ModalSheet`.
- Listas densas (finanças, crediário, pagamentos): **cards Juridiq no mobile** (`md:hidden`) e **tabela no desktop** (`hidden md:block`).
- Paginação padrão: **15 itens/página** (opções 15/30/50/100).
- Ações primárias devem permanecer alcançáveis sem rolagem horizontal.
- Formulários longos devem agrupar campos por tarefa, sem textos explicativos redundantes.
- Evitar grid de metric cards genéricos (ícone + número em 4 colunas); preferir faixa de resumo inline no header.

### Painel Kanban (`/admin/painel`)

- Board **horizontal** no mobile (como Tarefas Juridiq): colunas `~88vw/320px`, `overflow-x-auto` + `snap-x` — **nunca** empilhar com `grid-cols-1`.
- Desktop (`md+`): as 3 colunas usam `flex-1` e ocupam 100% da largura útil (`overflow-x` desligado).
- Mobile: pills de coluna no topo (salta/scrollIntoView) + IntersectionObserver na coluna ativa.
- Cards densos: borda esquerda por canal, `MenuAcoes` para secundárias, um CTA de avanço de status; mover coluna via menu (além do drag).
- Header de coluna: badge colorido + contador circular.

### Painel Caixa (`/admin/caixa`)

- Shell Juridiq `max-w-6xl`: header com status Aberto/Fechado, saldo gaveta, CTAs Abrir / Sangria / Suprimento / Sync / Fechar.
- Tabs: **Hoje** (movimentos da sessão), **Pedidos** (sync), **Extrato** (sessões).
- Extrato desktop: tabela estilo Crediário — borda-l + `Wallet` (aberto) / `CheckCircle2` (fechado), `MenuAcoes`, paginação 15.
- Fechamento: confere **dinheiro contado** vs esperado; PIX/cartão só informativos.
- Finanças permanece independente (não redesenhar aqui).

### Operação/PDV

- Prioridade é velocidade de leitura e ação.
- Status, totais e ações devem ter hierarquia mais forte que ornamentos.
- Preservar densidade, atalhos e feedback imediato por toast.
- Visual: tokens semânticos (`background`/`card`/`primary`/`border-border/70`), Geist herdado do layout; sem tema light forçado nem hex locais. Cards de produto `rounded-lg` com hover `accent`; totais em `font-mono tabular-nums text-primary`.

### Novo pedido (`/admin/pedidos/novo`)

- Desktop (`xl+`): catálogo à esquerda; coluna direita Atendimento → Cliente → Pagamento → Ticket com resumo `sticky`.
- Mobile: stepper 4 etapas (Local/Entrega/Retirada → Itens → Pessoa → Resumo); prévia do carrinho na etapa Itens; barra fixa com total + CTA.
- Catálogo: 1 toque adiciona/incrementa; botão Personalizar abre modal (obs./desconto).
- Tipo de atendimento só no card/etapa de atendimento (chip-resumo + Trocar nos dados — sem `<select>` duplicado).
- Cada canal presencial só aparece quando possui cadastro correspondente em `mesas`: Mesa, Comanda e Parceiro são ocultados independentemente. Sem nenhum deles, restam Entrega (quando `entregas_online_ativas` não for `false`) e Retirada; se entrega estiver desligada, Retirada é selecionada e o mobile avança direto para Itens.
- O campo manual de nome do cliente ocupa a largura completa do card de Cliente e usa alvo de 44 px.
- Tokens Juridiq em todos os cards; campos inválidos com `border-destructive` / `aria-invalid` e scroll ao foco.
- Observação geral do pedido no resumo (grava `pedidos.observacoes`).

### Cadastro casado funcionário ↔ acesso

- Os dois modais de **criação** trazem um toggle **pré-ativado** que cria o outro lado do cadastro; na **edição** o toggle não aparece (quem já existe é ajustado na tela dele).
- Regras em `src/lib/cadastro-equipe.ts` — mapa papel↔função, sugestão de login e vínculo. Não duplicar essa lógica nas telas.
- Login é sugerido a partir do nome no padrão da base (`joao_pedro`, `md_chefe`) e ganha sufixo se já existir (`nome_usuario` é UNIQUE); se o admin digitar um login à mão, a sugestão para de sobrescrever.
- Ao criar o usuário com o toggle ligado, um funcionário de **mesmo nome** (ignorando acento/caixa) é reaproveitado em vez de duplicado — a base já tinha pares como “Bom Parto”/“Bom parto”.
- Falha no segundo passo não desfaz o primeiro: o toast diz o que ficou pendente, e repetir a operação reaproveita em vez de duplicar.

### Produtividade (`/admin/produtividade`)

- Shell Juridiq `max-w-6xl`; período por pills + datas nativas só no modo Período.
- Todos os recortes usam o **dia operacional 03:00→03:00**; as metas usam janelas fixas (hoje/semana/mês) e dizem isso na própria descrição.
- Pontos ganhos por pedido criado (qualquer status), entregue, item adicionado, edição e cadastro completo; descontos por nome genérico e falta de telefone/endereço. Pesos e metas editáveis no modal, valendo para todo o histórico.
- Ranking e “pontos perdidos” contam a mesma coisa: a soma dos descontos da lista bate com a coluna Perdidos do ranking.
- Números vêm de route handler (`/api/admin/produtividade*`); a tela **não** consulta o Supabase pelo client.

### Finanças / Diárias

- No card principal de `/admin/financas`, toggle **Lançamentos | Diárias** (mesmo nível; Diárias não fica nas tabs de baixo).
- Diárias: Calendário (FullCalendar mês) ou Lista; clique no dia abre modal; cada diária vira despesa em `movimentacoes_caixa` + linha em `financas_diarias`.
- Mobile: toggle full-width, CTA `min-h-11`, toolbar do calendário empilhada, detalhe em `Dialog` bottom-friendly.

### Fila de impressão

- `GerenciadorImpressao` aparece no dashboard e em `/admin/impressora`.
- O botão Ativa/Pausada controla a fila automática persistida; não é estado local.
- A faixa de horário aceita período que cruza meia-noite. Horários iguais representam funcionamento contínuo.
- O controle de itens adicionados na edição é independente da fila geral.
- Impressões manuais não devem ser desabilitadas pela janela automática.

## Estados de interface

| Estado | Padrão preferido |
|---|---|
| Loading de bloco | `Skeleton` com a geometria aproximada do conteúdo |
| Loading de ação | Botão desabilitado com spinner e rótulo curto |
| Vazio | `Empty` com título curto e, quando útil, uma ação |
| Erro recuperável | Toast `sonner` ou mensagem próxima ao campo, com ação de tentar novamente |
| Confirmação destrutiva | `AlertDialog` |
| Sucesso operacional | Toast curto; não abrir modal se a ação já estiver evidente |
| Status persistente | `Badge` ou `Pill` com texto, nunca apenas cor |

O `AppToaster` posiciona notificações no **topo** (`top-center` no mobile, `top-right` no desktop). Alertas de mesa do salão podem ser ligados/desligados no menu do avatar (`Alertas de mesa`).

## Responsividade

- Evitar largura fixa fora de shells especializados como o preview de iPhone.
- Usar `min-w-0`, quebra de texto e `overflow-x-auto` em tabelas quando necessário.
- Datas nativas possuem correções globais para Safari/mobile.
- `html` e `body` bloqueiam overflow horizontal global; componentes não devem depender de conteúdo vazando.
- **Mobile (abaixo de 768px):** `Dialog` vira bottom sheet Vaul (`Drawer`) com handle e swipe para fechar (padrão Juridiq). Preferir `ModalSheet` / `Dialog` a overlays `fixed inset` manuais. Sidebar admin mobile usa o mesmo `Drawer`. `AlertDialog` sobe de baixo com handle visual (sem Vaul, para preservar Action/Cancel).
- **Modais com formulário longo:** `DialogContent` com `flex flex-col gap-0 overflow-hidden p-0`; body `min-h-0 flex-1 overflow-y-auto`; `DialogFooter` sticky com botões `h-11 w-full` no mobile e `pb-[max(1rem,env(safe-area-inset-bottom))]`. Não colocar footer dentro da área que rola.
- Desktop: `Dialog` centrado; sidebar fixa.
- Listas admin (pedidos, entregas, finanças, clientes): loading com `Skeleton` (não spinner de página inteira); vazio com `Empty`/`ListaVazia`; filtros rápidos em `ToggleGroup` pill (`CHIP_FILTRO_*`); resumo com `FiltrosAtivosChips` + Limpar tudo.

## Acessibilidade mínima

- Manter foco visível com `focus-visible:ring-*`.
- Botões somente com ícone precisam de `aria-label`.
- Dialogs precisam de `DialogTitle`; descrição deve existir quando agregar contexto.
- Não comunicar status apenas por cor; combinar texto/ícone.
- Preservar navegação por teclado dos componentes Radix.
- Tabelas devem usar headers semânticos; paginação compartilhada já possui rótulos em português.
- Respeitar `disabled` e evitar elementos clicáveis montados em `div` sem teclado.

## Anti-padrões

- Criar primitivas locais quando existe equivalente em `src/components/ui/` ou Kibo UI.
- Hardcode de hex/HSL e cores de tema dentro de componentes novos.
- Usar aliases históricos de cor como decisão visual nova; preferir tokens semânticos.
- Empilhar cards para cada pequeno dado em dashboards.
- Excesso de radius, sombras, gradientes e animação em superfícies operacionais.
- Copy longa explicando o que o controle já mostra.
- Taxa de entrega vinda de constante (`TAXA_ENTREGA_FIXA`) em tela que edita ou cria pedido — os bairros cadastrados custam R$ 2, R$ 3 ou R$ 5 e alguns são `entrega_gratis`. A taxa se deriva do bairro, como em `/admin/pedidos/novo`.
- Mudar a aparência do cardápio público como efeito colateral de uma tarefa administrativa.
- Usar Playwright para validação.
- `grid-auto-rows: 1fr` (`auto-rows-fr`) sem container com altura definida — infla linhas e gera scroll vazio após a lista/paginação.
- `h-screen` / `min-h-screen` / `calc(100vh-…)` como altura de conteúdo **dentro** do `AdminLayout` (`h-[100dvh]` + `main` com scroll) — preferir `100dvh` descontando header/padding ou altura pelo conteúdo (`py-*`).
- Sidebar mobile lateral (`Sheet` left) — no admin use `Drawer` bottom (Juridiq).
- Overlay mobile custom (`fixed inset-0` + `items-end`) — preferir `ModalSheet` / `Dialog` responsivo.
- Adicionar item e abrir o carrinho automaticamente; isso interrompe a montagem do pedido e remove o controle do usuário.
- Colocar um `DrawerContent` abaixo do próprio overlay ou reduzir localmente o z-index das primitivas compartilhadas.
- Montar um modal customizado como irmão de um Drawer modal; o pai conserva o focus trap e bloqueia os eventos do irmão. Use `DrawerNested` dentro da árvore do Drawer. Subir o `z-index` **não** resolve: o Radix põe `pointer-events:none` no `body` e o `react-remove-scroll` bloqueia `touchmove`/`wheel` fora do content — o overlay aparece, mas não recebe clique nem scroll.
- Combinar altura fixa (`h-*dvh`) com o `repositionInputs` do Vaul em drawer com formulário; os dois escrevem a mesma propriedade e o inline do Vaul vence para sempre.
- `max-h-[60vh]` / `80vh` dentro de bottom sheet mobile — `vh` ignora a barra do browser no iOS; use a cadeia flex (`min-h-0 flex-1 overflow-y-auto`) com `dvh` no container.
- Cachear `/`, respostas HTML ou `text/x-component` no service worker do Next; uma versão antiga pode hidratar com chunks novos.
- Executar transições de scroll suave enquanto uma lista paginada troca cards por skeletons; a mudança simultânea de altura pode deixar o container em uma posição intermediária.

## Onboarding (aulas guiadas dos módulos)

Módulo `src/features/onboarding/` — tour interativo + central de ajuda, montado uma vez em `src/app/admin/layout.tsx` (`OnboardingProvider` + `OnboardingRoot`). Inspirado no onboarding do Juridiq; **sem vídeos** e **sem "IA faz por você"**. Config-driven: um novo módulo = um `TourConfig` em `config/*` registrado em `config/index.ts`.

| Peça | Caminho | Responsabilidade |
|---|---|---|
| Provider/estado | `context.tsx` | Estado global (tour ativo, etapa, progresso); `usePathname`/`useRouter` (App Router); id do usuário via `useAdminAuth`. |
| Persistência | `storage.ts` | Progresso em **localStorage por usuário** (`bar-da-ladeira:onboarding:<userId>`). Sem tabela no Supabase (evita migração coordenada). |
| Spotlight | `components/spotlight.tsx` | **Overlay escuro + recorte** (SVG mask) com anel `primaryBlue` pulsante; `pointer-events:none` (tela segue clicável). |
| Popover / Sheet | `components/tour-popover.tsx` (desktop), `tour-mobile-sheet.tsx` (mobile, slider inferior com handle) | Conteúdo da etapa via `step-content.tsx` (badges, progresso, Voltar/Avançar, "Ver na prática"). Escolha por `useIsMobile`. |
| Botão Ajuda | `components/help-button.tsx` | Pílula flutuante (bottom-right, `/admin`, fora do login; some durante tour). Abre o painel. |
| Painel Ajuda | `components/help-panel.tsx` + `module-catalog.tsx` | `Sheet` (lateral desktop / inferior mobile): "Ver tutorial desta tela" + "Ver todos os treinamentos" (catálogo por grupo da sidebar, status Concluído/Continuar/Iniciar/**Em breve**) + card de progresso 🏆. |
| Engine | `engine/*` | `element-tracker` (rastreio sem polling), `positioning`, `dom` (waitForElement), `route-match`, `use-foreign-dialog`, `demo-runner` (cursor simulado). |

**Regra do dado de demonstração (ver AGENTS.md §0.2.5):** o alvo da div interativa é **simulado no cliente** — `demo/crediario-demo-store.ts` (store externa via `useSyncExternalStore`) mantém uma conta falsa (com consumos) + um flag `modalAberto` que o tour usa para pedir a abertura. **Reusa a UI REAL — nunca cria modal/linha paralelos** (AGENTS §5):
- O `PainelCrediario` lê a store (`useDemoCrediario`), mapeia a conta falsa para o shape `ContaCrediario`/`MovimentoCrediario` e a **injeta no topo de `contasFiltradas`**. Ela renderiza pela mesma linha/card real e abre o **modal real** da tela.
- Toda ação da conta demo é **guardada por `id === CONTA_DEMO_ID`**: quitar → store (client-side); pagamento/PDF/cancelar → toast de exemplo. **Nada toca o Supabase.**
- Âncoras `data-onboarding` (condicionais à conta demo): `demo-card` (linha), `demo-dropdown` (menu ⋯), e no modal real `demo-modal-visao`, `demo-pagamento`, `demo-quitar`, `demo-pdf`.
- `demo/CrediarioDemoBridge.tsx` dirige a conta pelo passo do tour: cria ao iniciar, seta `modalAberto` nas etapas `modal-*` (o painel abre/fecha o modal real via efeito), quita em `modal-quitar`, remove ao encerrar.

**Auto-start:** desligado (`autoStart: false` no tour) — o tour/ajuda **só abre ao clicar em Ajuda**, nunca ao entrar na tela.

Tours prontos (demais módulos aparecem no catálogo como "Em breve" até ganharem config):

- **Crediário** (`config/crediario.ts`): problema → benefício → onde se cria → menu ⋯ → abrir a conta → ensinar no modal real (visão, pagamento, quitar, PDF) → conclusão.
- **Finanças** (`config/financas.ts`, 16 etapas): lucro/ocultar valores → Receitas / Despesas / Salário → cards recebido×pago → período e filtros → lista de lançamentos → **Diárias** (troca de aba com demonstração ao vivo, nova diária, calendário, calendário×lista) → Análise/Pagamentos → conclusão. Diária de exemplo client-side (`demo/financas-demo-store.ts` + `FinancasDemoBridge`) injetada no calendário/lista **reais** do `PainelDiarias`, com exclusão blindada por `DIARIA_DEMO_ID`.

- **Painel** (`config/painel.ts`, 11 etapas): as três colunas do fluxo → o card (canal, itens, total) → avançar status → menu ⋯ → arrastar → atalhos de coluna no mobile → busca → conclusão. Pedido de exemplo client-side (`demo/painel-demo-store.ts` + `PainelDemoBridge`) injetado na coluna **Em análise** do board real; todas as ações passam por `comGuardaDemo` (toast, sem banco), e o arraste é inócuo porque o demo não vive no estado `pedidos`.

Âncoras de Finanças: `financas-lucro`, `financas-receita`, `financas-despesa`, `financas-salario`, `financas-cards`, `financas-periodo`, `financas-lancamentos`, `financas-toggle-principal`, `financas-nova-diaria`, `financas-diarias-conteudo`, `financas-diarias-vista`, `financas-tabs`.

Âncoras do Painel: `painel-resumo`, `painel-busca`, `painel-pills`, `painel-board` e, apenas no card de exemplo, `painel-card`, `painel-avancar`, `painel-menu`, `painel-arrastar`.

## Divergências existentes a preservar até tarefa específica

- Há componentes legados com cores diretas, radius maior e classes próprias como `.card-produto`, `.modal-overlay` e `.modal-content`.
- Há mistura de componentes compartilhados, MUI e UI específica em telas antigas (migrar para tokens ao tocar a tela).
- `Button` usa tokens semânticos (`primary`/`destructive`/`border-border/70`).

Essas divergências não autorizam refatoração incidental. Reuse o padrão dominante da tela alvo e altere o sistema visual somente quando esse for o escopo explícito.
