'use client'

/**
 * Componente de botão para imprimir pedido
 * Pode ser usado em qualquer lugar do admin
 */

import { useState } from 'react'
import { Printer, CircleNotch as Loader2, Check, X, ChefHat, FileText } from '@phosphor-icons/react'
import { useImpressoraOpcional } from '@/contexts/ImpressoraContext'
import { DadosPedidoImpressao, TipoTicket } from '@/lib/impressora/types'
import { obterNumeroPedidoExibicao } from '@/lib/pedidos/numero-diario'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Botao } from '@/components/admin/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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
      return <Loader2 className="size-4 animate-spin" />
    }
    if (resultado === 'sucesso') {
      return <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
    }
    if (resultado === 'erro') {
      return <X className="size-4 text-destructive" />
    }
    return <Printer className="size-4" />
  }

  // Variante: apenas ícone
  if (variante === 'icone') {
    return (
      <Botao
        variante="fantasma"
        tamanho="icone"
        onClick={handleImprimirPadrao}
        disabled={!conectado || imprimindo}
        title={conectado ? 'Imprimir pedido' : 'Impressora não conectada'}
        aria-label={conectado ? 'Imprimir pedido' : 'Impressora não conectada'}
        className={cn('size-11 text-muted-foreground', className)}
      >
        {renderIcone()}
      </Botao>
    )
  }

  // Variante: menu com opções
  if (variante === 'menu' || mostrarOpcoes) {
    const opcoes: { tipo: TipoTicket; rotulo: string; Icone: typeof Printer }[] = [
      { tipo: 'cliente', rotulo: 'Ticket do cliente', Icone: FileText },
      { tipo: 'cozinha', rotulo: 'Ticket da cozinha', Icone: ChefHat },
      { tipo: 'completo', rotulo: 'Os dois', Icone: Printer },
    ]
    return (
      <Popover open={menuAberto} onOpenChange={setMenuAberto}>
        <PopoverTrigger asChild>
          <Botao variante="contorno" disabled={!conectado || imprimindo} className={cn('h-11 md:h-10', className)}>
            {renderIcone()}
            Imprimir
          </Botao>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1">
          {opcoes.map(({ tipo, rotulo, Icone }) => (
            <button
              key={tipo}
              type="button"
              onClick={() => void handleImprimir(tipo)}
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Icone className="size-4 text-muted-foreground" />
              {rotulo}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    )
  }

  // Variante: botão padrão
  return (
    <Botao
      variante="contorno"
      onClick={handleImprimirPadrao}
      disabled={!conectado || imprimindo}
      className={cn('h-11 md:h-10', className)}
    >
      {renderIcone()}
      {imprimindo ? 'Imprimindo...' : resultado === 'sucesso' ? 'Impresso' : resultado === 'erro' ? 'Erro ao imprimir' : 'Imprimir'}
    </Botao>
  )
}
