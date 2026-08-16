import type { TourConfig } from '../types'

/**
 * Onboarding da tela de Finanças (/admin/financas).
 *
 * Cobre o módulo inteiro: lucro e privacidade dos valores, lançar receita /
 * despesa / salário, cards de recebido x pago, período e filtros, lista de
 * lançamentos, e a área de **Diárias** (calendário, lista e nova diária).
 *
 * A diária de exemplo é simulada no cliente (demo/financas-demo-store.ts) e
 * entra no calendário/lista REAIS — nunca grava em `financas_diarias` nem em
 * `movimentacoes_caixa`. Não inicia sozinho: só pelo botão Ajuda.
 */
export const financasTour: TourConfig = {
  id: 'financas',
  name: 'Finanças',
  module: 'Análise',
  routes: ['/admin/financas'],
  descricao: 'Lucro, receitas, despesas, salários e diárias em um só lugar.',
  order: 2,
  autoStart: false,
  steps: [
    {
      id: 'problema',
      kind: 'problema',
      title: 'Vender muito não é o mesmo que lucrar',
      body: 'O caixa enche no fim de semana e mesmo assim falta dinheiro no dia 10. Sem separar o que entrou do que saiu — gás, carne, embalagem, salário, diarista — você trabalha o mês inteiro sem saber se sobrou ou faltou.',
      placement: 'center',
    },
    {
      id: 'beneficio',
      kind: 'beneficio',
      title: 'A conta do mês, fechada sozinha',
      body: 'O Financeiro junta tudo: as vendas viram receita automaticamente, você lança as despesas, os salários e as diárias, e o lucro aparece pronto no topo da tela. Dá para ver o mês inteiro ou só o dia de hoje.',
      placement: 'center',
    },
    {
      id: 'lucro',
      kind: 'beneficio',
      title: 'Seu lucro fica sempre à vista',
      body: 'Aqui em cima aparece o lucro do período: verde quando sobrou, vermelho quando faltou. O olhinho do lado esconde todos os valores da tela — útil quando tem cliente ou funcionário olhando o balcão.',
      target: '[data-onboarding="financas-lucro"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'receita',
      kind: 'pratica',
      title: 'Lançar uma receita que não veio de pedido',
      body: 'As vendas já entram sozinhas. Este botão é para o dinheiro que entra por fora: uma encomenda combinada por fora do sistema, a venda de um freezer velho, um troco a mais. Clique nele quando precisar registrar uma entrada manual.',
      target: '[data-onboarding="financas-receita"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'despesa',
      kind: 'pratica',
      title: 'Toda saída precisa ser registrada',
      body: 'Gás, carne, pão, embalagem, energia, aluguel. É aqui que a despesa entra, com valor, data e categoria. Sem lançar as saídas, o lucro que aparece na tela é ilusão — parece que sobrou mais do que sobrou de verdade.',
      target: '[data-onboarding="financas-despesa"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'salario',
      kind: 'pratica',
      title: 'Salário sai por um caminho próprio',
      body: 'O botão Salário lança o pagamento já ligado ao funcionário, então além de virar despesa fica registrado quem recebeu e quando. Bom para não misturar pagamento de equipe com compra de mercadoria.',
      target: '[data-onboarding="financas-salario"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'cards',
      kind: 'beneficio',
      title: 'Quanto já entrou e quanto já saiu',
      body: 'Os dois cards mostram o realizado do período: em Receitas, o que já foi recebido de fato; em Despesas, o que já foi pago. O anel preenche conforme o período avança — é o retrato rápido de como o mês está indo.',
      target: '[data-onboarding="financas-cards"]',
      skipIfMissing: true,
      placement: 'top',
    },
    {
      id: 'periodo',
      kind: 'pratica',
      title: 'Escolha o período que quer enxergar',
      body: 'Use "Hoje" para fechar o dia, as setas para navegar entre os meses, e os filtros rápidos para ver só receitas, só despesas ou o que ainda está a receber. A tela inteira acompanha o período escolhido.',
      target: '[data-onboarding="financas-periodo"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'lancamentos',
      kind: 'pratica',
      title: 'Cada movimento do período, linha a linha',
      body: 'Esta é a lista de tudo que entrou e saiu no período: descrição, valor, forma de pagamento e data. Dá para editar ou apagar um lançamento errado pelo menu de cada linha — o total lá de cima se ajusta na hora.',
      target: '[data-onboarding="financas-lancamentos"]',
      skipIfMissing: true,
      placement: 'top',
    },
    {
      id: 'toggle-diarias',
      kind: 'demonstracao',
      title: 'Agora as Diárias',
      body: 'Este botão troca a área principal entre "Lançamentos" e "Diárias". Clique em Diárias — é onde você controla quem trabalhou avulso e quanto recebeu.',
      target: '[data-onboarding="financas-toggle-principal"]',
      advanceOn: { type: 'element-visible', selector: '[data-onboarding="financas-nova-diaria"]' },
      placement: 'bottom',
      // Caminho de um clique: o tour troca a aba sozinho. Sem isto, quem
      // apertasse "Avançar" pularia todas as etapas de Diárias.
      demo: {
        label: 'Abrir as Diárias para mim',
        actions: [
          {
            click: '[data-onboarding="financas-toggle-principal"] [aria-label="Diárias"]',
            waitFor: '[data-onboarding="financas-nova-diaria"]',
          },
          { wait: 600 },
        ],
      },
    },
    {
      id: 'diarias-problema',
      kind: 'problema',
      title: 'Diarista é a despesa que mais some do controle',
      body: 'Chamou alguém para ajudar no fim de semana, pagou em dinheiro na hora e ninguém anotou. No fim do mês o dinheiro sumiu do caixa e não existe em lugar nenhum. As Diárias existem para fechar esse buraco.',
      placement: 'center',
    },
    {
      id: 'diarias-nova',
      kind: 'pratica',
      title: 'Registrar uma diária',
      body: 'Em "Nova diária" você informa quem trabalhou, o valor e a data. O nome é livre — não precisa ser funcionário cadastrado. Ao salvar, a diária vira automaticamente uma despesa no financeiro, então o lucro do mês já sai correto.',
      target: '[data-onboarding="financas-nova-diaria"]',
      skipIfMissing: true,
      placement: 'left',
    },
    {
      id: 'diarias-calendario',
      kind: 'pratica',
      title: 'O mês inteiro de diárias em um calendário',
      body: 'Cada dia mostra quem recebeu e quanto — deixei uma diária de exemplo no dia de hoje para você ver. Clicar em um dia vazio já abre o registro daquela data; clicar em uma diária abre os detalhes, com a opção de excluir.',
      target: '[data-onboarding="financas-diarias-conteudo"]',
      skipIfMissing: true,
      placement: 'top',
    },
    {
      id: 'diarias-vista',
      kind: 'pratica',
      title: 'Calendário ou lista, como preferir',
      body: 'O calendário é bom para enxergar os dias cheios e os vazios do mês. Já a lista mostra tudo em sequência com os valores somados — mais prático na hora de conferir quanto foi gasto com diárias no período.',
      target: '[data-onboarding="financas-diarias-vista"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'analise',
      kind: 'beneficio',
      title: 'Análise e Pagamentos, para fechar o mês',
      body: 'Em "Análise" ficam os gráficos: fluxo de caixa, de onde vem a receita e o lucro mês a mês. Em "Pagamentos" você vê os recebimentos e o que ainda está em aberto — pedidos não pagos e fiado pendente.',
      target: '[data-onboarding="financas-tabs"]',
      skipIfMissing: true,
      placement: 'top',
    },
    {
      id: 'proximo-passo',
      kind: 'proximo-passo',
      title: 'Pronto! Agora é só manter o hábito',
      body: 'Lance as despesas no dia em que acontecem, registre a diária na hora de pagar e confira o lucro no fim do mês. A diária de exemplo já vai sumir. Sempre que precisar, o botão de Ajuda traz este tutorial de volta.',
      placement: 'center',
    },
  ],
}
