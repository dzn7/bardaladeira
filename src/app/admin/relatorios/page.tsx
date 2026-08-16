'use client'

import { useState, useEffect } from 'react'
import {
  BarChart3,
  Calendar,
  FileText,
  RefreshCw,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Truck,
  Store,
  Package,
  MapPin,
} from 'lucide-react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { format, subDays } from 'date-fns'
import { gerarPdfRelatorios } from '@/lib/gerarPdfRelatorios'
import { ANO_INICIO_ATUAL } from '@/lib/filtros-ano'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CHIP_FILTRO_BOTAO } from '@/components/admin/filtros/chip-classes'
import { cn } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type DadosRelatorio = {
  vendasPorDia: { data: string; total: number; quantidade: number }[]
  produtosMaisVendidos: { nome: string; quantidade: number; receita: number }[]
  vendasPorCategoria: { categoria: string; quantidade: number; receita: number }[]
  estatisticas: {
    receitaTotal: number
    pedidosTotal: number
    ticketMedio: number
    crescimento: number
  }
  horariosPico: { hora: number; quantidade: number }[]
  faturamentoPorPagamento: { forma: string; total: number; quantidade: number }[]
  // Estatísticas por tipo de pedido
  pedidosPorTipo: {
    entregas: { total: number; quantidade: number }
    retiradas: { total: number; quantidade: number }
    local: { total: number; quantidade: number }
  }
  // Entregas por período
  entregasPorPeriodo: {
    hoje: number
    semana: number
    mes: number
  }
  // Entregas por bairro
  entregasPorBairro: { bairro: string; quantidade: number; taxaTotal: number }[]
}

type FormaPagamentoConfig = { nome: string; icone: typeof Banknote; cor: string; bgCor: string; chartCor: string }

const FORMAS_PAGAMENTO_CONFIG: Record<string, FormaPagamentoConfig> = {
  dinheiro: { nome: 'Dinheiro', icone: Banknote, cor: 'text-emerald-600', bgCor: 'bg-muted/50', chartCor: 'rgba(16, 185, 129, 0.8)' },
  pix: { nome: 'PIX', icone: Smartphone, cor: 'text-primary', bgCor: 'bg-muted/50', chartCor: 'rgba(2, 150, 249, 0.8)' },
  pix_online: { nome: 'PIX Online', icone: Smartphone, cor: 'text-primary', bgCor: 'bg-muted/50', chartCor: 'rgba(14, 165, 233, 0.8)' },
  credito: { nome: 'Crédito', icone: CreditCard, cor: 'text-foreground', bgCor: 'bg-muted/50', chartCor: 'rgba(59, 130, 246, 0.8)' },
  debito: { nome: 'Débito', icone: CreditCard, cor: 'text-foreground', bgCor: 'bg-muted/50', chartCor: 'rgba(99, 102, 241, 0.8)' },
  vale_refeicao: { nome: 'Vale Refeição', icone: Wallet, cor: 'text-rose-600', bgCor: 'bg-muted/50', chartCor: 'rgba(244, 63, 94, 0.8)' },
}

// Formata valor monetário no padrão brasileiro (R$ 1.234,56)
const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default function RelatoriosPage() {
  const [dados, setDados] = useState<DadosRelatorio | null>(null)
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState(7) // dias
  const hoje = new Date()
  // Data mínima é 01/01/2026 (início do ano atual)
  const dataMinima = `${ANO_INICIO_ATUAL}-01-01`
  const dataInicioDefault = hoje.getFullYear() >= ANO_INICIO_ATUAL 
    ? format(subDays(hoje, 7), 'yyyy-MM-dd')
    : dataMinima
  const [dataInicio, setDataInicio] = useState(dataInicioDefault < dataMinima ? dataMinima : dataInicioDefault)
  const [dataFim, setDataFim] = useState(format(hoje, 'yyyy-MM-dd'))

  useEffect(() => {
    carregarDados()

    // Configurar Realtime para atualizar automaticamente
    const channel = supabase
      .channel('relatorios-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        console.log('[Relatórios] Pedido atualizado - recarregando dados')
        carregarDados()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pedido' }, () => {
        console.log('[Relatórios] Pagamento atualizado - recarregando dados')
        carregarDados()
      })
      .subscribe((status) => {
        console.log('[Relatórios] Realtime status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataInicio, dataFim])

  const carregarDados = async () => {
    setLoading(true)
    try {
      // Criar datas no timezone local e converter para ISO
      const inicio = new Date(dataInicio + 'T00:00:00')
      const fim = new Date(dataFim + 'T23:59:59.999')
      
      const inicioStr = inicio.toISOString()
      const fimStr = fim.toISOString()

      console.log('[Relatórios] Buscando pedidos de', dataInicio, 'até', dataFim)
      console.log('[Relatórios] Range ISO:', inicioStr, 'até', fimStr)

      // Buscar pedidos do período com paginação para evitar limite de 1000
      let todosPedidos: any[] = []
      let offset = 0
      const limite = 1000
      let temMais = true
      const colunasPedido =
        'id, created_at, total, tipo_entrega, bairro, status, taxa_entrega, forma_pagamento'

      while (temMais) {
        const { data: lote, error: lotError } = await supabase
          .from('pedidos')
          .select(colunasPedido)
          .gte('created_at', inicioStr)
          .lte('created_at', fimStr)
          .neq('status', 'cancelado')
          .neq('status', 'aguardando_pagamento')
          .order('created_at', { ascending: true })
          .range(offset, offset + limite - 1)

        if (lotError) {
          console.error('[Relatórios] Erro ao buscar lote:', lotError)
          throw lotError
        }

        if (lote && lote.length > 0) {
          todosPedidos = [...todosPedidos, ...lote]
          offset += limite
          temMais = lote.length === limite
        } else {
          temMais = false
        }
      }

      const pedidos = todosPedidos

      console.log('[Relatórios] Pedidos encontrados:', pedidos?.length || 0)

      const itensPorPedido = new Map<string, Array<{ nome_item?: string; quantidade: number; subtotal: number }>>()
      const idsPedidos = pedidos.map((pedido) => String(pedido.id))
      const tamanhoLoteItens = 200

      for (let i = 0; i < idsPedidos.length; i += tamanhoLoteItens) {
        const loteIds = idsPedidos.slice(i, i + tamanhoLoteItens)
        const { data: itensLote, error: erroItens } = await supabase
          .from('itens_pedido')
          .select('pedido_id, nome_item, quantidade, subtotal')
          .in('pedido_id', loteIds)

        if (erroItens) {
          console.error('[Relatórios] Erro ao buscar itens:', erroItens)
          throw erroItens
        }

        ;(itensLote || []).forEach((item) => {
          const pedidoId = String(item.pedido_id || '')
          if (!pedidoId) return
          const lista = itensPorPedido.get(pedidoId) || []
          lista.push({
            nome_item: item.nome_item,
            quantidade: Number(item.quantidade || 0),
            subtotal: Number(item.subtotal || 0),
          })
          itensPorPedido.set(pedidoId, lista)
        })
      }

      const pedidosComItens = pedidos.map((pedido) => ({
        ...pedido,
        itens_pedido: itensPorPedido.get(String(pedido.id)) || [],
      }))

      console.log('[Relatórios] Pedidos com itens:', pedidosComItens)

      // Processar dados
      const vendasPorDia = processarVendasPorDia(pedidosComItens || [])
      const produtosMaisVendidos = await processarProdutosMaisVendidos(pedidosComItens || [])
      const vendasPorCategoria = await processarVendasPorCategoria(pedidosComItens || [])
      const estatisticas = calcularEstatisticas(pedidosComItens || [])
      const horariosPico = processarHorariosPico(pedidosComItens || [])
      const faturamentoPorPagamento = await processarFaturamentoPorPagamento(inicioStr, fimStr)
      const pedidosPorTipo = processarPedidosPorTipo(pedidosComItens || [])
      const entregasPorPeriodo = await calcularEntregasPorPeriodo(inicioStr, fimStr)
      const entregasPorBairro = processarEntregasPorBairro(pedidosComItens || [])

      console.log('[Relatórios] Estatísticas:', estatisticas)
      console.log('[Relatórios] Pedidos por tipo:', pedidosPorTipo)

      setDados({
        vendasPorDia,
        produtosMaisVendidos,
        vendasPorCategoria,
        estatisticas,
        horariosPico,
        faturamentoPorPagamento,
        pedidosPorTipo,
        entregasPorPeriodo,
        entregasPorBairro
      })
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error)
    } finally {
      setLoading(false)
    }
  }

  const processarVendasPorDia = (pedidos: any[]) => {
    const vendas: { [key: string]: { total: number; quantidade: number } } = {}

    pedidos.forEach(pedido => {
      const data = format(new Date(pedido.created_at), 'dd/MM')
      if (!vendas[data]) {
        vendas[data] = { total: 0, quantidade: 0 }
      }
      vendas[data].total += pedido.total
      vendas[data].quantidade += 1
    })

    return Object.entries(vendas).map(([data, valores]) => ({
      data,
      ...valores
    }))
  }

  const processarProdutosMaisVendidos = async (pedidos: any[]) => {
    const produtos: { [key: string]: { quantidade: number; receita: number } } = {}

    pedidos.forEach(pedido => {
      pedido.itens_pedido?.forEach((item: any) => {
        const nome = item.nome_item || 'Produto'
        if (!produtos[nome]) {
          produtos[nome] = { quantidade: 0, receita: 0 }
        }
        produtos[nome].quantidade += item.quantidade
        produtos[nome].receita += item.subtotal
      })
    })

    return Object.entries(produtos)
      .map(([nome, valores]) => ({ nome, ...valores }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10)
  }

  const processarVendasPorCategoria = async (pedidos: any[]) => {
    const categorias: { [key: string]: { quantidade: number; receita: number } } = {}

    // Buscar produtos para mapear categorias
    const { data: produtos } = await supabase.from('produtos').select('nome, categoria')

    const mapaCategorias: { [key: string]: string } = {}
    produtos?.forEach(p => {
      mapaCategorias[p.nome] = p.categoria
    })

    pedidos.forEach(pedido => {
      pedido.itens_pedido?.forEach((item: any) => {
        const nome = item.nome_item || 'Produto'
        const categoria = mapaCategorias[nome] || 'Outros'
        
        if (!categorias[categoria]) {
          categorias[categoria] = { quantidade: 0, receita: 0 }
        }
        categorias[categoria].quantidade += item.quantidade
        categorias[categoria].receita += item.subtotal
      })
    })

    return Object.entries(categorias).map(([categoria, valores]) => ({
      categoria,
      ...valores
    }))
  }

  const calcularEstatisticas = (pedidos: any[]) => {
    const receitaTotal = pedidos.reduce((sum, p) => sum + p.total, 0)
    const pedidosTotal = pedidos.length
    const ticketMedio = pedidosTotal > 0 ? receitaTotal / pedidosTotal : 0

    // Calcular crescimento (comparar com período anterior)
    const metadePeriodo = Math.floor(pedidos.length / 2)
    const primeiraMetade = pedidos.slice(0, metadePeriodo)
    const segundaMetade = pedidos.slice(metadePeriodo)
    
    const receitaPrimeira = primeiraMetade.reduce((sum, p) => sum + p.total, 0)
    const receitaSegunda = segundaMetade.reduce((sum, p) => sum + p.total, 0)
    
    const crescimento = receitaPrimeira > 0 
      ? ((receitaSegunda - receitaPrimeira) / receitaPrimeira) * 100 
      : 0

    return { receitaTotal, pedidosTotal, ticketMedio, crescimento }
  }

  const processarHorariosPico = (pedidos: any[]) => {
    const horarios: { [key: number]: number } = {}

    pedidos.forEach(pedido => {
      const hora = new Date(pedido.created_at).getHours()
      horarios[hora] = (horarios[hora] || 0) + 1
    })

    return Object.entries(horarios)
      .map(([hora, quantidade]) => ({ hora: Number(hora), quantidade }))
      .sort((a, b) => a.hora - b.hora)
  }

  // Processar pedidos por tipo (entrega, retirada, local)
  const processarPedidosPorTipo = (pedidos: any[]) => {
    const tipos = {
      entregas: { total: 0, quantidade: 0 },
      retiradas: { total: 0, quantidade: 0 },
      local: { total: 0, quantidade: 0 }
    }

    pedidos.forEach(pedido => {
      const tipo = pedido.tipo_entrega?.toLowerCase() || 'local'
      const valor = Number(pedido.total) || 0

      if (tipo === 'entrega') {
        tipos.entregas.total += valor
        tipos.entregas.quantidade += 1
      } else if (tipo === 'retirada') {
        tipos.retiradas.total += valor
        tipos.retiradas.quantidade += 1
      } else {
        tipos.local.total += valor
        tipos.local.quantidade += 1
      }
    })

    return tipos
  }

  const calcularEntregasPorPeriodo = async (inicioStr: string, fimStr: string) => {
    const agora = new Date()

    const inicioHoje = new Date(agora)
    if (agora.getHours() < 10) {
      inicioHoje.setDate(inicioHoje.getDate() - 1)
    }
    inicioHoje.setHours(10, 0, 0, 0)

    const inicioSemana = new Date(agora)
    inicioSemana.setDate(agora.getDate() - agora.getDay())
    inicioSemana.setHours(10, 0, 0, 0)

    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1)
    inicioMes.setHours(10, 0, 0, 0)

    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, created_at')
      .eq('tipo_entrega', 'entrega')
      .eq('status', 'entregue')
      .gte('created_at', inicioStr)
      .lte('created_at', fimStr)

    let hoje = 0
    let semana = 0
    let mes = 0

    if (pedidos) {
      pedidos.forEach((p: { created_at: string }) => {
        const dataEntrega = new Date(p.created_at)
        if (dataEntrega >= inicioHoje) {
          hoje++
        }
        if (dataEntrega >= inicioSemana) {
          semana++
        }
        if (dataEntrega >= inicioMes) {
          mes++
        }
      })
    }

    return { hoje, semana, mes }
  }

  // Processar entregas por bairro (apenas entregas concluídas)
  const processarEntregasPorBairro = (pedidos: any[]) => {
    const bairros: { [key: string]: { quantidade: number; taxaTotal: number } } = {}

    pedidos.forEach(pedido => {
      // Só processa pedidos de entrega ENTREGUES que têm bairro
      if (pedido.tipo_entrega === 'entrega' && pedido.bairro && pedido.status === 'entregue') {
        const bairro = pedido.bairro
        if (!bairros[bairro]) {
          bairros[bairro] = { quantidade: 0, taxaTotal: 0 }
        }
        bairros[bairro].quantidade += 1
        bairros[bairro].taxaTotal += Number(pedido.taxa_entrega) || 0
      }
    })

    return Object.entries(bairros)
      .map(([bairro, valores]) => ({ bairro, ...valores }))
      .sort((a, b) => b.quantidade - a.quantidade)
  }

  const processarFaturamentoPorPagamento = async (inicioStr: string, fimStr: string) => {
    const agrupado: Record<string, { total: number; quantidade: number }> = {}

    // Função para normalizar forma de pagamento
    const normalizarForma = (formaPagamento: string): string => {
      const forma = (formaPagamento || '').toLowerCase().trim()
      if (!forma) return 'outros'
      
      // PIX Online deve vir antes do PIX normal para evitar match parcial
      if (forma === 'pix online' || forma === 'pix_online') {
        return 'pix_online'
      } else if (forma === 'pix') {
        return 'pix'
      } else if (['cartão', 'cartao', 'cartão de crédito', 'cartao de credito', 'credito', 'cartão crédito'].includes(forma)) {
        return 'credito'
      } else if (['cartão de débito', 'cartao de debito', 'debito', 'cartão débito'].includes(forma)) {
        return 'debito'
      } else if (['vale refeição', 'vale refeicao', 'vale'].includes(forma)) {
        return 'vale_refeicao'
      } else if (['dinheiro', 'espécie', 'especie'].includes(forma)) {
        return 'dinheiro'
      }
      return forma
    }

    // 1. Buscar pagamentos da tabela pagamentos_pedido (com join no pedido para filtrar cancelados)
    const { data: pagamentos } = await supabase
      .from('pagamentos_pedido')
      .select('forma_pagamento, valor, pedido_id, pedido:pedidos!inner(status)')
      .gte('created_at', inicioStr)
      .lte('created_at', fimStr)
      .neq('pedido.status', 'cancelado')

    const pedidosComPagamentoDividido = new Set<string>()
    
    if (pagamentos && pagamentos.length > 0) {
      pagamentos.forEach((pag: any) => {
        pedidosComPagamentoDividido.add(pag.pedido_id)
        const forma = normalizarForma(pag.forma_pagamento)
        if (!agrupado[forma]) {
          agrupado[forma] = { total: 0, quantidade: 0 }
        }
        agrupado[forma].total += Number(pag.valor) || 0
        agrupado[forma].quantidade += 1
      })
    }

    // 2. Buscar pedidos que NÃO têm pagamento dividido (usar forma_pagamento da tabela pedidos)
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, forma_pagamento, total')
      .gte('created_at', inicioStr)
      .lte('created_at', fimStr)
      .neq('status', 'cancelado')

    if (pedidos && pedidos.length > 0) {
      pedidos.forEach((pedido: any) => {
        // Ignorar pedidos que já têm pagamento dividido
        if (pedidosComPagamentoDividido.has(pedido.id)) return
        // Ignorar pedidos marcados como "Dividido"
        if (pedido.forma_pagamento === 'Dividido') return
        
        const forma = normalizarForma(pedido.forma_pagamento)
        if (!agrupado[forma]) {
          agrupado[forma] = { total: 0, quantidade: 0 }
        }
        agrupado[forma].total += Number(pedido.total) || 0
        agrupado[forma].quantidade += 1
      })
    }

    return Object.entries(agrupado)
      .map(([forma, dados]) => ({ forma, ...dados }))
      .sort((a, b) => b.total - a.total)
  }

  const exportarPDF = () => {
    if (!dados) return
    gerarPdfRelatorios(dados, dataInicio, dataFim, 'Bar da Ladeira')
  }

  const aplicarPeriodoRapido = (dias: number) => {
    setPeriodo(dias)
    const agora = new Date()
    let novaDataInicio = format(subDays(agora, dias), 'yyyy-MM-dd')
    // Garantir que a data de início não seja anterior a 01/01/2026
    if (novaDataInicio < dataMinima) {
      novaDataInicio = dataMinima
    }
    setDataInicio(novaDataInicio)
    setDataFim(format(agora, 'yyyy-MM-dd'))
  }

  const cardClass = 'rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5'
  const tituloSecaoClass = 'mb-4 flex items-center gap-2 text-base font-semibold tracking-tight text-foreground'

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5 p-4 md:p-6 lg:p-8">
          <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                <BarChart3 className="h-5 w-5 text-primary" aria-hidden />
                Relatórios
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Vendas e desempenho do período selecionado
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-4 md:gap-6">
              {dados ? (
                <>
                  <div className="min-w-[72px]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Receita</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                      R$ {formatarMoeda(dados.estatisticas.receitaTotal)}
                    </p>
                  </div>
                  <div className="min-w-[72px]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Pedidos</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                      {dados.estatisticas.pedidosTotal}
                    </p>
                  </div>
                  <div className="min-w-[72px]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ticket</p>
                    <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                      R$ {formatarMoeda(dados.estatisticas.ticketMedio)}
                    </p>
                  </div>
                  <div className="min-w-[72px]">
                    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Crescimento</p>
                    <p
                      className={cn(
                        'mt-0.5 text-xl font-semibold tabular-nums',
                        dados.estatisticas.crescimento >= 0 ? 'text-emerald-600' : 'text-destructive'
                      )}
                    >
                      {dados.estatisticas.crescimento >= 0 ? '+' : ''}
                      {dados.estatisticas.crescimento.toFixed(1)}%
                    </p>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-4">
                  <Skeleton className="h-12 w-20" />
                  <Skeleton className="h-12 w-16" />
                  <Skeleton className="h-12 w-20" />
                  <Skeleton className="h-12 w-16" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shadow-none"
                  onClick={exportarPDF}
                  disabled={!dados || loading}
                  aria-label="Exportar PDF"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 shadow-none"
                  onClick={() => void carregarDados()}
                  disabled={loading}
                  aria-label="Atualizar relatórios"
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
                  Atualizar
                </Button>
              </div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-sm font-medium text-foreground">Período rápido</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Período rápido">
                  {[7, 15, 30, 90].map((dias) => (
                    <button
                      key={dias}
                      type="button"
                      onClick={() => aplicarPeriodoRapido(dias)}
                      aria-pressed={periodo === dias}
                      className={CHIP_FILTRO_BOTAO}
                    >
                      {dias} dias
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="relatorio-data-inicio" className="mb-2 block text-sm font-medium text-foreground">
                  Data início
                </label>
                <Input
                  id="relatorio-data-inicio"
                  type="date"
                  value={dataInicio}
                  min={dataMinima}
                  onChange={(e) => {
                    const novaData = e.target.value
                    setDataInicio(novaData < dataMinima ? dataMinima : novaData)
                  }}
                  className="h-9 w-full shadow-none sm:w-auto"
                />
              </div>
              <div>
                <label htmlFor="relatorio-data-fim" className="mb-2 block text-sm font-medium text-foreground">
                  Data fim
                </label>
                <Input
                  id="relatorio-data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-9 w-full shadow-none sm:w-auto"
                />
              </div>
            </div>
          </div>

          {loading && !dados ? (
            <div className="space-y-5" aria-busy="true" aria-label="Carregando relatórios">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-72 w-full rounded-xl" />
                <Skeleton className="h-72 w-full rounded-xl" />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-64 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          ) : !dados ? (
            <div className={cn(cardClass, 'flex flex-col items-center justify-center gap-3 py-16 text-center')}>
              <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
              <Button type="button" size="sm" className="h-9 shadow-none" onClick={() => void carregarDados()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={cardClass}>
                  <h2 className={tituloSecaoClass}>
                    <Package className="h-4 w-4 text-primary" aria-hidden />
                    Pedidos por tipo
                  </h2>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-center sm:p-3">
                      <Truck className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
                      <p className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                        {dados.pedidosPorTipo.entregas.quantidade}
                      </p>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">Entregas</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium tabular-nums text-foreground sm:text-sm">
                        R$ {formatarMoeda(dados.pedidosPorTipo.entregas.total)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-center sm:p-3">
                      <Package className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
                      <p className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                        {dados.pedidosPorTipo.retiradas.quantidade}
                      </p>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">Retiradas</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium tabular-nums text-foreground sm:text-sm">
                        R$ {formatarMoeda(dados.pedidosPorTipo.retiradas.total)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-2 text-center sm:p-3">
                      <Store className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
                      <p className="text-lg font-semibold tabular-nums text-foreground sm:text-xl">
                        {dados.pedidosPorTipo.local.quantidade}
                      </p>
                      <p className="text-[10px] text-muted-foreground sm:text-xs">No local</p>
                      <p className="mt-0.5 truncate text-[10px] font-medium tabular-nums text-foreground sm:text-sm">
                        R$ {formatarMoeda(dados.pedidosPorTipo.local.total)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 h-48">
                    <Doughnut
                      data={{
                        labels: ['Entregas', 'Retiradas', 'No Local'],
                        datasets: [
                          {
                            data: [
                              dados.pedidosPorTipo.entregas.quantidade,
                              dados.pedidosPorTipo.retiradas.quantidade,
                              dados.pedidosPorTipo.local.quantidade,
                            ],
                            backgroundColor: [
                              'rgba(2, 150, 249, 0.85)',
                              'rgba(16, 185, 129, 0.8)',
                              'rgba(100, 116, 139, 0.75)',
                            ],
                            borderWidth: 0,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'bottom' },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className={tituloSecaoClass}>
                    <Truck className="h-4 w-4 text-primary" aria-hidden />
                    Entregas realizadas
                  </h2>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <MapPin className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Hoje</p>
                          <p className="text-xs text-muted-foreground">Entregas concluídas</p>
                        </div>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-foreground">
                        {dados.entregasPorPeriodo.hoje}
                      </p>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <Calendar className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Esta semana</p>
                          <p className="text-xs text-muted-foreground">Desde domingo</p>
                        </div>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-foreground">
                        {dados.entregasPorPeriodo.semana}
                      </p>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <BarChart3 className="h-4 w-4 text-primary" aria-hidden />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Este mês</p>
                          <p className="text-xs text-muted-foreground">Desde o dia 1</p>
                        </div>
                      </div>
                      <p className="text-2xl font-semibold tabular-nums text-foreground">
                        {dados.entregasPorPeriodo.mes}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-sm text-muted-foreground">Média diária (mês)</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {dados.entregasPorPeriodo.mes > 0
                        ? (dados.entregasPorPeriodo.mes / new Date().getDate()).toFixed(1)
                        : '0'}{' '}
                      entregas/dia
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={cardClass}>
                  <h2 className={tituloSecaoClass}>Vendas por dia</h2>
                  <div className="relative h-64">
                    <Bar
                      data={{
                        labels: dados.vendasPorDia.map((v) => v.data),
                        datasets: [
                          {
                            label: 'Receita (R$)',
                            data: dados.vendasPorDia.map((v) => v.total),
                            backgroundColor: 'rgba(2, 150, 249, 0.8)',
                            borderColor: 'rgba(2, 150, 249, 1)',
                            borderWidth: 2,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: (context: { parsed: { y: number | null } }) =>
                                `R$ ${(context.parsed.y || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                            },
                          },
                        },
                        scales: {
                          y: { beginAtZero: true },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className={tituloSecaoClass}>Horários de pico</h2>
                  <div className="relative h-64">
                    <Line
                      data={{
                        labels: dados.horariosPico.map((h) => `${h.hora}h`),
                        datasets: [
                          {
                            label: 'Pedidos',
                            data: dados.horariosPico.map((h) => h.quantidade),
                            borderColor: 'rgba(2, 150, 249, 1)',
                            backgroundColor: 'rgba(2, 150, 249, 0.1)',
                            fill: true,
                            tension: 0.4,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                        },
                        scales: {
                          y: { beginAtZero: true },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className={cardClass}>
                <h2 className={tituloSecaoClass}>
                  <CreditCard className="h-4 w-4 text-primary" aria-hidden />
                  Faturamento por forma de pagamento
                </h2>

                {dados.faturamentoPorPagamento.length > 0 ? (
                  <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {dados.faturamentoPorPagamento.map((item) => {
                      const config = FORMAS_PAGAMENTO_CONFIG[item.forma] || {
                        nome: item.forma,
                        icone: CreditCard,
                        cor: 'text-muted-foreground',
                        bgCor: 'bg-muted/50',
                        chartCor: 'rgba(100, 116, 139, 0.8)',
                      }
                      const Icone = config.icone
                      const percentual =
                        dados.estatisticas.receitaTotal > 0
                          ? ((item.total / dados.estatisticas.receitaTotal) * 100).toFixed(1)
                          : '0'

                      return (
                        <div
                          key={item.forma}
                          className={cn('rounded-lg border border-border/60 p-4', config.bgCor)}
                        >
                          <div className="mb-3 flex items-center gap-3">
                            <div className={cn('rounded-lg border border-border/60 bg-card p-2', config.cor)}>
                              <Icone className="h-4 w-4" aria-hidden />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{config.nome}</p>
                              <p className="text-xs text-muted-foreground">{item.quantidade} transações</p>
                            </div>
                          </div>
                          <div className="flex items-end justify-between gap-2">
                            <p className={cn('text-xl font-semibold tabular-nums', config.cor)}>
                              R$ {formatarMoeda(item.total)}
                            </p>
                            <span className="text-sm font-medium tabular-nums text-muted-foreground">
                              {percentual}%
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/60">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${percentual}%`,
                                backgroundColor: config.chartCor,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <CreditCard className="mx-auto mb-2 h-10 w-10 opacity-30" aria-hidden />
                    <p className="text-sm">Nenhum pagamento registrado no período</p>
                  </div>
                )}

                {dados.faturamentoPorPagamento.length > 0 && (
                  <div className="h-64">
                    <Doughnut
                      data={{
                        labels: dados.faturamentoPorPagamento.map(
                          (p) => FORMAS_PAGAMENTO_CONFIG[p.forma]?.nome || p.forma
                        ),
                        datasets: [
                          {
                            data: dados.faturamentoPorPagamento.map((p) => p.total),
                            backgroundColor: dados.faturamentoPorPagamento.map(
                              (p) => FORMAS_PAGAMENTO_CONFIG[p.forma]?.chartCor || 'rgba(100, 116, 139, 0.8)'
                            ),
                            borderWidth: 2,
                            borderColor: '#fff',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { position: 'right' },
                          tooltip: {
                            callbacks: {
                              label: (context: { label?: string; parsed: number }) => {
                                const label = context.label || ''
                                const value = context.parsed || 0
                                return `${label}: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className={cardClass}>
                  <h2 className={tituloSecaoClass}>Top 10 produtos</h2>
                  <div className="space-y-2">
                    {dados.produtosMaisVendidos.map((produto, index) => (
                      <div
                        key={`${produto.nome}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-2 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold tabular-nums text-primary">
                            {index + 1}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground">{produto.nome}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold tabular-nums text-foreground">{produto.quantidade}x</p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            R$ {formatarMoeda(produto.receita)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={cardClass}>
                  <h2 className={tituloSecaoClass}>Vendas por categoria</h2>
                  <div className="relative h-64">
                    <Doughnut
                      data={{
                        labels: dados.vendasPorCategoria.map((c) => c.categoria),
                        datasets: [
                          {
                            data: dados.vendasPorCategoria.map((c) => c.receita),
                            backgroundColor: [
                              'rgba(2, 150, 249, 0.85)',
                              'rgba(59, 130, 246, 0.8)',
                              'rgba(16, 185, 129, 0.8)',
                              'rgba(244, 63, 94, 0.75)',
                              'rgba(100, 116, 139, 0.75)',
                            ],
                            borderWidth: 2,
                            borderColor: '#fff',
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            position: 'bottom',
                          },
                          tooltip: {
                            callbacks: {
                              label: (context: { label?: string; parsed: number }) => {
                                const label = context.label || ''
                                const value = context.parsed || 0
                                return `${label}: R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                              },
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              </div>

              {dados.entregasPorBairro && dados.entregasPorBairro.length > 0 && (
                <div className={cardClass}>
                  <h2 className={tituloSecaoClass}>
                    <MapPin className="h-4 w-4 text-primary" aria-hidden />
                    Entregas por bairro
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {dados.entregasPorBairro.map((item, index) => (
                      <div
                        key={item.bairro}
                        className="rounded-lg border border-border/60 bg-muted/30 p-3"
                      >
                        <div className="mb-2 flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground',
                              index < 3 ? 'bg-primary' : 'bg-muted-foreground'
                            )}
                          >
                            {index + 1}
                          </div>
                          <p className="truncate text-sm font-medium text-foreground">{item.bairro}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {item.quantidade} {item.quantidade === 1 ? 'entrega' : 'entregas'}
                          </p>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            R$ {formatarMoeda(item.taxaTotal)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <p className="text-sm text-muted-foreground">
                      Total de entregas:{' '}
                      <span className="font-semibold tabular-nums text-foreground">
                        {dados.entregasPorBairro.reduce((acc, b) => acc + b.quantidade, 0)}
                      </span>
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      Total em taxas: R${' '}
                      {formatarMoeda(dados.entregasPorBairro.reduce((acc, b) => acc + b.taxaTotal, 0))}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}
