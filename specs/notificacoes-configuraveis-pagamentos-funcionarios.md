# SPEC — Notificações configuráveis e pagamentos de funcionários

## Objetivo

Permitir que cada administrador escolha as categorias exibidas na Central e mantenha, em Finanças, uma agenda mensal de pagamentos por funcionário. Pagamentos próximos ou atrasados geram ocorrência urgente persistente, deduplicada e resolvida somente quando a competência for paga ou a agenda deixar de valer.

## Regras de pagamento

- Cada funcionário pode ter uma agenda ativa com dia mensal de vencimento (1–31), antecedência (0–30 dias) e valor previsto opcional.
- O dia 29, 30 ou 31 é ajustado ao último dia de meses mais curtos.
- A agenda começa na competência do mês em que é criada; não cria dívida histórica retroativa.
- Cada competência mensal aceita um único pagamento principal.
- Registrar o pagamento cria, na mesma transação, uma saída em `movimentacoes_caixa` e o registro da competência.
- A data informada é a data efetiva do pagamento. Valor monetário usa `numeric(12,2)` no banco.
- A ocorrência nasce quando `hoje >= vencimento - antecedência`, é urgente e usa a chave `pagamento_funcionario:<funcionario>:<AAAA-MM>`.
- Uma competência não paga permanece atrasada nos meses seguintes. Pagá-la resolve sua ocorrência; uma competência futura é uma nova ocorrência.
- Funcionário inativo ou agenda desativada resolve as ocorrências ainda ativas daquela agenda.

## Preferências de notificação

- Preferências são por administrador e persistidas no banco.
- Categorias configuráveis: estoque (baixo e esgotado), pedidos novos e pagamentos de funcionários.
- Desativar uma categoria apenas a oculta daquele administrador no badge, modal, lista e ação “marcar todas”; não apaga nem resolve a ocorrência global.
- Reativar volta a exibir ocorrências que continuarem ativas.
- “Avisar ao entrar” continua independente das categorias.

## API e segurança

- Agenda e pagamentos são acessados somente por route handler administrativo com a autorização legada existente e Supabase service role no servidor.
- As novas tabelas terão RLS ativo, nenhum grant para `anon`/`authenticated` e grant mínimo para `service_role`.
- Funções administrativas terão `search_path` vazio, nomes qualificados e execução exclusiva de `service_role`.
- Entradas são validadas no servidor; UUID, datas, competência, limites e valor não são confiados ao cliente.

## UX

- Finanças terá um fluxo “Pagamentos da equipe” adaptado ao `ActionDialog` existente, com lista de funcionários, status da competência, configuração e registro do pagamento.
- A Central manterá a superfície visual própria do repositório, sem componentes `@/components/ui/*`, e exibirá configurações com o `Interruptor` existente.
- Mobile usa uma única área rolável, rodapé com safe area e campos com tamanho adequado para teclado móvel.

## Aceite

- Agenda salva e reaparece após refresh.
- Vencimento em até 3 dias e atraso geram alerta urgente contextual para Finanças.
- Reconciliações repetidas não duplicam a mesma competência.
- Pagamento resolve a competência sem perder histórico e atualiza Finanças/Notificações.
- Estoque, pedidos e pagamentos podem ser ativados/desativados independentemente.

