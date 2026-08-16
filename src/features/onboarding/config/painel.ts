import type { TourConfig } from '../types'

/**
 * Onboarding do Painel de produção (/admin/painel).
 *
 * Ensina o quadro Kanban: as três colunas do fluxo, o que o card mostra,
 * como avançar o pedido, o menu de ações, o arraste e a busca.
 *
 * O pedido de exemplo é simulado no cliente (demo/painel-demo-store.ts) e
 * entra na coluna "Em análise" do board REAL — nunca grava em `pedidos`, nem
 * muda status, nem imprime. Não inicia sozinho: só pelo botão Ajuda.
 */
export const painelTour: TourConfig = {
  id: 'painel',
  name: 'Painel',
  module: 'Operações',
  routes: ['/admin/painel'],
  descricao: 'O quadro da produção: do pedido novo até pronto para entrega.',
  order: 3,
  autoStart: false,
  steps: [
    {
      id: 'problema',
      kind: 'problema',
      title: 'Pedido que some entre o balcão e a chapa',
      body: 'No aperto, o pedido é gritado para a cozinha, anotado num papel e esquecido. Aí o cliente cobra, ninguém sabe se já saiu, se está na chapa ou se nunca foi feito — e alguém acaba comendo o prejuízo.',
      placement: 'center',
    },
    {
      id: 'beneficio',
      kind: 'beneficio',
      title: 'Um quadro onde todo pedido tem um lugar',
      body: 'O Painel mostra a produção inteira em três colunas: o que chegou agora, o que está sendo feito e o que já está pronto. Qualquer pessoa bate o olho e sabe exatamente em que pé está cada pedido.',
      placement: 'center',
    },
    {
      id: 'resumo',
      kind: 'beneficio',
      title: 'O resumo do movimento',
      body: 'Aqui no topo ficam os contadores de cada coluna e o total de pedidos ativos. É o termômetro do movimento: se a coluna do meio está entupida, a cozinha está atrasando.',
      target: '[data-onboarding="painel-resumo"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'colunas',
      kind: 'beneficio',
      title: 'As três etapas do pedido',
      body: 'Em análise: acabou de chegar e precisa ser conferido. Em produção: confirmado, a cozinha está fazendo. Prontos para entrega: finalizado, esperando sair ou ser retirado. O pedido caminha sempre da esquerda para a direita.',
      target: '[data-onboarding="painel-board"]',
      skipIfMissing: true,
      placement: 'top',
    },
    {
      id: 'card',
      kind: 'pratica',
      title: 'O que cada card conta',
      body: 'Deixei um pedido de exemplo na primeira coluna. O card traz o cliente, os itens, o total e o canal — a barra colorida na esquerda diz se é entrega, mesa ou retirada. Clicar no card abre os detalhes completos.',
      target: '[data-onboarding="painel-card"]',
      skipIfMissing: true,
      placement: 'right',
      spotlightPadding: 8,
    },
    {
      id: 'avancar',
      kind: 'pratica',
      title: 'Um toque move o pedido adiante',
      body: 'Este botão é o caminho normal do dia a dia: ele empurra o pedido para a próxima etapa. Conferiu o pedido novo? Avança para produção. Saiu da chapa? Avança para pronto. O quadro se reorganiza sozinho.',
      target: '[data-onboarding="painel-avancar"]',
      skipIfMissing: true,
      placement: 'right',
      spotlightPadding: 6,
    },
    {
      id: 'menu',
      kind: 'pratica',
      title: 'As demais ações ficam no menu',
      body: 'No menu (⋯) do card estão as ações secundárias: imprimir a via da cozinha, editar os itens, confirmar pagamento, mover para outra coluna ou excluir. Tudo sem sair do quadro.',
      target: '[data-onboarding="painel-menu"]',
      skipIfMissing: true,
      placement: 'left',
      spotlightPadding: 6,
    },
    {
      id: 'arrastar',
      kind: 'pratica',
      title: 'Ou arraste o card com a mão',
      body: 'Se preferir, segure por esta alcinha e arraste o card para outra coluna. É o mesmo efeito de avançar o status — vale a que for mais rápida para você no meio do movimento.',
      target: '[data-onboarding="painel-arrastar"]',
      skipIfMissing: true,
      placement: 'right',
      spotlightPadding: 6,
    },
    {
      id: 'pills-mobile',
      kind: 'pratica',
      title: 'No celular, salte entre as colunas',
      body: 'Na tela pequena o quadro rola na horizontal e estes atalhos levam direto para a coluna que você quer ver, sem precisar arrastar a tela inteira.',
      target: '[data-onboarding="painel-pills"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'busca',
      kind: 'pratica',
      title: 'Ache um pedido específico na hora',
      body: 'Cliente ligou perguntando do pedido dele? Busque pelo nome, telefone ou número e o quadro filtra na hora — útil quando há muitos cards abertos ao mesmo tempo.',
      target: '[data-onboarding="painel-busca"]',
      skipIfMissing: true,
      placement: 'bottom',
    },
    {
      id: 'proximo-passo',
      kind: 'proximo-passo',
      title: 'Pronto! A produção sob controle',
      body: 'Mantenha o quadro limpo: confira o que chega, avance conforme a cozinha entrega e não deixe card parado na coluna errada. O pedido de exemplo já vai sumir. O botão de Ajuda traz este tutorial de volta quando precisar.',
      placement: 'center',
    },
  ],
}
