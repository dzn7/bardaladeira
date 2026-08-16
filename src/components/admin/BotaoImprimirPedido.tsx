'use client'

/**
 * Componente de botão para imprimir pedido
 * Pode ser usado em qualquer lugar do admin
 */

import { useState } from 'react'
import { Printer, Loader2, Check, X, ChefHat, FileText } from 'lucide-react'
import { useImpressoraOpcional } from '@/contexts/ImpressoraContext'
import { DadosPedidoImpressao, TipoTicket } from '@/lib/impressora/types'
import { obterNumeroPedidoExibicao } from '@/lib/pedidos/numero-diario'
import { supabase } from '@/lib/supabase'

interface ItemPedido {
  id: string
  produto_nome: string
  quantidade: number
  preco_unitario: number
  preco_total: number
  observacoes?: string
  adicionais?: Array<{
    nome: string
    preco: number
    quantidade?: number
  }>
}

interface Pedido {
  id: string
  numero_pedido?: number | null
  numero_pedido_diario?: number | null
  nome_cliente: string
  telefone?: string
  endereco?: string
  bairro?: string
  tipo_entrega: 'entrega' | 'retirada' | 'local'
  forma_pagamento: string
  subtotal: number
  taxa_entrega: number
  taxa_servico?: number
  total: number
  observacoes?: string
  mesa_numero?: number
  comanda?: number
  created_at: string
  itens?: ItemPedido[]
  troco_para?: number | null
  pagamentosDivididos?: Array<{
    forma: string
    valor: number
  }>
}

interface BotaoImprimirPedidoProps {
  pedido: Pedido
  itens?: ItemPedido[]
  variante?: 'botao' | 'icone' | 'menu'
  mostrarOpcoes?: boolean
  className?: string
}

export default function BotaoImprimirPedido({
  pedido,
  itens,
  variante = 'botao',
  mostrarOpcoes = false,
  className = ''
}: BotaoImprimirPedidoProps) {
  const impressora = useImpressoraOpcional()
  const [imprimindo, setImprimindo] = useState(false)
  const [resultado, setResultado] = useState<'sucesso' | 'erro' | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)

  // Se não tiver provider de impressora, não renderiza
  if (!impressora) {
    return null
  }

  const { status, imprimir, configuracao } = impressora

  // Se não estiver conectado, não renderiza ou mostra desabilitado
  const conectado = status === 'conectado'

  const carregarPagamentosDivididos = async (pedidoId: string) => {
    const { data, error } = await supabase
      .from('pagamentos_pedido')
      .select('forma_pagamento, valor')
      .eq('pedido_id', pedidoId)

    if (error) {
      console.error('Erro ao carregar pagamentos divididos para impressão:', error)
      return []
    }

    return (data || [])
      .map((pagamento: { forma_pagamento?: string | null; valor?: number | null }) => ({
        forma: String(pagamento.forma_pagamento || ''),
        valor: Number(pagamento.valor || 0)
      }))
      .filter((pagamento: { forma: string; valor: number }) => pagamento.forma && pagamento.valor > 0)
  }

  // Converte pedido para formato de impressão
  const converterParaDadosImpressao = async (): Promise<DadosPedidoImpressao> => {
    const itensPedido = itens || pedido.itens || []
    let pagamentosDivididos = pedido.pagamentosDivididos || []
    const numeroPedido = obterNumeroPedidoExibicao(pedido)

    if (String(pedido.forma_pagamento || '').trim().toLowerCase() === 'dividido' && pagamentosDivididos.length === 0) {
      pagamentosDivididos = await carregarPagamentosDivididos(pedido.id)
    }
    
    return {
      numeroPedido: String(numeroPedido || pedido.id.substring(0, 8).toUpperCase()),
      dataHora: new Date(pedido.created_at),
      tipoEntrega: pedido.tipo_entrega,
      nomeCliente: pedido.nome_cliente,
      telefone: pedido.telefone,
      endereco: pedido.endereco,
      bairro: pedido.bairro,
      mesa: pedido.mesa_numero,
      comanda: pedido.comanda,
      itens: itensPedido.map(item => ({
        nome: item.produto_nome,
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
        precoTotal: item.preco_total,
        observacoes: item.observacoes,
        adicionais: item.adicionais
      })),
      subtotal: pedido.subtotal,
      taxaEntrega: pedido.taxa_entrega,
      taxaServico: pedido.taxa_servico || 0,
      total: pedido.total,
      formaPagamento: pedido.forma_pagamento,
      pagamentosDivididos: pagamentosDivididos.length > 0 ? pagamentosDivididos : undefined,
      trocoPara: pedido.troco_para || undefined,
      valorTroco:
        pedido.troco_para && pedido.troco_para > pedido.total
          ? Number((pedido.troco_para - pedido.total).toFixed(2))
          : undefined,
      observacoes: pedido.observacoes
    }
  }

  const handleImprimir = async (tipo: TipoTicket) => {
    setImprimindo(true)
    setResultado(null)
    setMenuAberto(false)

    try {
      const dados = await converterParaDadosImpressao()
      const sucesso = await imprimir(dados, tipo)
      setResultado(sucesso ? 'sucesso' : 'erro')
      
      // Limpa resultado após 3 segundos
      setTimeout(() => setResultado(null), 3000)
    } catch (erro) {
      console.error('Erro ao imprimir:', erro)
      setResultado('erro')
    } finally {
      setImprimindo(false)
    }
  }

  const handleImprimirPadrao = async () => {
    // Imprime baseado nas configurações
    if (configuracao.imprimirTicketCliente && configuracao.imprimirTicketCozinha) {
      await handleImprimir('completo')
    } else if (configuracao.imprimirTicketCozinha) {
      await handleImprimir('cozinha')
    } else {
      await handleImprimir('cliente')
    }
  }

  // Renderização do ícone de status
  const renderIcone = () => {
    if (imprimindo) {
      return <Loader2 className="w-4 h-4 animate-spin" />
    }
    if (resultado === 'sucesso') {
      return <Check className="w-4 h-4 text-green-500" />
    }
    if (resultado === 'erro') {
      return <X className="w-4 h-4 text-red-500" />
    }
    return <Printer className="w-4 h-4" />
  }

  // Variante: apenas ícone
  if (variante === 'icone') {
    return (
      <button
        onClick={handleImprimirPadrao}
        disabled={!conectado || imprimindo}
        title={conectado ? 'Imprimir pedido' : 'Impressora não conectada'}
        className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${conectado 
            ? 'hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400' 
            : 'text-zinc-300 dark:text-zinc-600'
          } ${className}`}
      >
        {renderIcone()}
      </button>
    )
  }

  // Variante: menu com opções
  if (variante === 'menu' || mostrarOpcoes) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenuAberto(!menuAberto)}
          disabled={!conectado || imprimindo}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
            ${conectado 
              ? 'bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300' 
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
            } ${className}`}
        >
          {renderIcone()}
          <span className="text-sm">Imprimir</span>
        </button>

        {menuAberto && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setMenuAberto(false)} 
            />
            <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 z-50 overflow-hidden">
              <button
                onClick={() => handleImprimir('cliente')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span>Ticket Cliente</span>
              </button>
              <button
                onClick={() => handleImprimir('cozinha')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <ChefHat className="w-4 h-4 text-amber-500" />
                <span>Ticket Cozinha</span>
              </button>
              <div className="border-t border-zinc-100 dark:border-zinc-700" />
              <button
                onClick={() => handleImprimir('completo')}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <Printer className="w-4 h-4 text-zinc-500" />
                <span>Ambos</span>
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // Variante: botão padrão
  return (
    <button
      onClick={handleImprimirPadrao}
      disabled={!conectado || imprimindo}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        ${conectado 
          ? 'bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-300' 
          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
        } ${className}`}
    >
      {renderIcone()}
      <span className="text-sm">
        {imprimindo ? 'Imprimindo...' : 
         resultado === 'sucesso' ? 'Impresso!' :
         resultado === 'erro' ? 'Erro' :
         'Imprimir'}
      </span>
    </button>
  )
}
