import type { TourConfig } from '../types'

/**
 * Onboarding da tela de Crediário (/admin/crediario).
 *
 * Ordem pedagógica: problema → benefício → onde se cria (em Pedidos) → menu
 * rápido (⋯) → abrir a conta de exemplo → ensinar dentro do MODAL REAL da tela
 * (visão, registrar pagamento, quitar, gerar PDF) → próximo passo.
 *
 * O alvo é uma conta FALSA simulada no cliente (demo/crediario-demo-store.ts):
 * ela entra na própria lista do painel e abre o MODAL REAL — nunca um modal
 * paralelo (AGENTS §5). As ações (quitar/pagamento/PDF) são simuladas: nada
 * grava no Supabase. Não inicia sozinho — só pelo botão Ajuda.
 */
export const crediarioTour: TourConfig = {
  id: 'crediario',
  name: 'Crediário',
  module: 'Operação',
  routes: ['/admin/crediario'],
  descricao: 'Controle o fiado do balcão: quem deve, quanto e como quitar.',
  order: 1,
  autoStart: false,
  steps: [
    {
      id: 'problema',
      kind: 'problema',
      title: 'O caderninho de fiado não fecha no fim do mês',
      body: 'Cliente leva agora e paga depois, o valor fica anotado num papel, e quando você percebe ninguém sabe ao certo quem deve, quanto deve e desde quando. Fiado esquecido é dinheiro que sai da lanchonete e não volta.',
      placement: 'center',
    },
    {
      id: 'beneficio',
      kind: 'beneficio',
      title: 'Todo fiado organizado em um só lugar',
      body: 'O Crediário guarda a conta de cada cliente: o que ele consumiu, o que já pagou e quanto ainda deve. Você vê o saldo na hora, registra pagamentos parciais e quita quando ele acerta tudo — sem caderninho, sem conta de cabeça.',
      placement: 'center',
    },
    {
      id: 'onde-criar',
      kind: 'caso-real',
      title: 'O fiado nasce em Pedidos',
      body: 'Uma conta de crediário não é criada aqui — ela nasce quando você faz um pedido e escolhe a forma de pagamento "Fiado / Crediário". Ao fechar o pedido assim, o valor cai automaticamente na conta do cliente e aparece nesta tela.',
      target: 'a[href="/admin/pedidos/novo"]',
      skipIfMissing: true,
      placement: 'right',
    },
    {
      id: 'dropdown',
      kind: 'pratica',
      title: 'Cada conta tem um menu rápido',
      body: 'Criei uma conta de exemplo aqui em cima para você praticar sem medo. O menu (⋯) de cada linha traz as ações mais usadas sem abrir nada: ver detalhes, registrar pagamento e quitar tudo.',
      target: '[data-onboarding="demo-dropdown"]',
      skipIfMissing: true,
      placement: 'left',
      spotlightPadding: 8,
    },
    {
      id: 'abrir',
      kind: 'pratica',
      title: 'Abra a conta para ver tudo',
      body: 'Toque na linha da conta de exemplo para abrir os detalhes completos — é o mesmo painel que você usa nas contas de verdade.',
      target: '[data-onboarding="demo-card"]',
      advanceOn: { type: 'click', selector: '[data-onboarding="demo-card"]' },
      placement: 'bottom',
      spotlightPadding: 8,
    },
    {
      id: 'modal-visao',
      kind: 'pratica',
      title: 'Saldo, pedidos no fiado e pagamentos',
      body: 'No topo da conta você vê o resumo: quanto o cliente ainda deve, quantos pedidos foram no fiado e quantos pagamentos ele já fez. Logo abaixo fica o histórico item por item.',
      target: '[data-onboarding="demo-modal-visao"]',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'modal-pagamento',
      kind: 'pratica',
      title: 'Recebeu só uma parte? Registre o pagamento',
      body: 'Se o cliente pagar um valor por cima da dívida, use "Receber". O saldo diminui e o restante continua em aberto, com tudo registrado no histórico.',
      target: '[data-onboarding="demo-pagamento"]',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'modal-quitar',
      kind: 'pratica',
      title: 'Pagou tudo? É só quitar',
      body: 'Quando o cliente acerta o valor cheio, clique em "Quitar" e a conta zera na hora — repare que a conta de exemplo acabou de virar Quitada, com saldo R$ 0,00.',
      target: '[data-onboarding="demo-quitar"]',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'modal-pdf',
      kind: 'pratica',
      title: 'Gere um comprovante em PDF',
      body: 'Precisa mostrar ao cliente o que ele consumiu e pagou? "PDF" monta um comprovante da conta na hora — útil para enviar no WhatsApp ou imprimir.',
      target: '[data-onboarding="demo-pdf"]',
      placement: 'bottom',
      spotlightPadding: 6,
    },
    {
      id: 'proximo-passo',
      kind: 'proximo-passo',
      title: 'Pronto! Fiado sob controle',
      body: 'Você viu o ciclo completo: o fiado nasce em Pedidos, aparece aqui como conta do cliente, você acompanha o saldo, registra pagamentos, quita e gera comprovante. A conta de exemplo já vai sumir. Sempre que precisar, o botão de Ajuda traz este tutorial de volta.',
      placement: 'center',
    },
  ],
}
