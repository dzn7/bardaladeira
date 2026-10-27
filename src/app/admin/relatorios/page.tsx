'use client'

import { useState, useEffect } from 'react'
import { ChartBar as BarChart3, Calendar, FileText, ArrowsClockwise as RefreshCw, CreditCard, Money as Banknote, DeviceMobile as Smartphone, Wallet, Truck, Storefront as Store, Package, MapPin } from '@phosphor-icons/react'
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
import { toast } from 'sonner'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Chip,
  Entrada,
  Esqueleto,
  Lista,
  ListaVazia,
  Pagina,
  Secao,
} from '@/components/admin/ui'
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
      toast.error('Não foi possível carregar os relatórios.', { id: 'relatorios-erro', description: 'Confira a internet e toque em Atualizar.' })
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

  const corCrescimento =
    dados && dados.estatisticas.crescimento >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'

  const kpis = dados
    ? [
        { rotulo: 'Vendas', valor: `R$ ${formatarMoeda(dados.estatisticas.receitaTotal)}` },
        { rotulo: 'Pedidos', valor: String(dados.estatisticas.pedidosTotal) },
        { rotulo: 'Ticket médio', valor: `R$ ${formatarMoeda(dados.estatisticas.ticketMedio)}` },
        {
          rotulo: 'Comparado ao período anterior',
          valor: `${dados.estatisticas.crescimento >= 0 ? '+' : ''}${dados.estatisticas.crescimento.toFixed(1)}%`,
          classe: corCrescimento,
        },
      ]
    : []

  const tiposPedido = dados
    ? [
        { rotulo: 'Entregas', icone: Truck, ...dados.pedidosPorTipo.entregas },
        { rotulo: 'Retiradas', icone: Package, ...dados.pedidosPorTipo.retiradas },
        { rotulo: 'No local', icone: Store, ...dados.pedidosPorTipo.local },
      ]
    : []

  const entregasPeriodo = dados
    ? [
        { rotulo: 'Hoje', ajuda: 'Entregas concluídas', icone: MapPin, valor: dados.entregasPorPeriodo.hoje },
        { rotulo: 'Esta semana', ajuda: 'Desde domingo', icone: Calendar, valor: dados.entregasPorPeriodo.semana },
        { rotulo: 'Este mês', ajuda: 'Desde o dia 1', icone: BarChart3, valor: dados.entregasPorPeriodo.mes },
      ]
    : []

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina className="max-w-6xl">
          <CabecalhoPagina
            titulo="Relatórios"
            descricao="Vendas e desempenho do período escolhido."
            acoes={
              <>
                <Botao
                  variante="contorno"
                  className="h-11 md:h-10"
                  onClick={exportarPDF}
                  disabled={!dados || loading}
                  aria-label="Exportar PDF"
                >
                  <FileText />
                  Baixar PDF
                </Botao>
                <Botao
                  variante="contorno"
                  className="h-11 md:h-10"
                  onClick={() => void carregarDados()}
                  disabled={loading}
                  aria-label="Atualizar relatórios"
                >
                  <RefreshCw className={cn(loading && 'animate-spin')} />
                  Atualizar
                </Botao>
              </>
            }
          />

          <Cartao className="space-y-4 p-4 md:p-5">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Período</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Período rápido">
                {[7, 15, 30, 90].map((dias) => (
                  <Chip
                    key={dias}
                    ativo={periodo === dias}
                    onClick={() => aplicarPeriodoRapido(dias)}
                    className="h-11 normal-case md:h-9"
                  >
                    Últimos {dias} dias
                  </Chip>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-md">
              <Campo rotulo="De" htmlFor="relatorio-data-inicio">
                <Entrada
                  id="relatorio-data-inicio"
                  type="date"
                  value={dataInicio}
                  min={dataMinima}
                  onChange={(e) => {
                    const novaData = e.target.value
                    setDataInicio(novaData < dataMinima ? dataMinima : novaData)
                  }}
                />
              </Campo>
              <Campo rotulo="Até" htmlFor="relatorio-data-fim">
                <Entrada
                  id="relatorio-data-fim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </Campo>
            </div>
          </Cartao>

          {loading && !dados ? (
            <div className="space-y-5" aria-busy="true" aria-label="Carregando relatórios">
              <Esqueleto className="h-[76px] w-full rounded-xl" />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Esqueleto className="h-72 w-full rounded-xl" />
                <Esqueleto className="h-72 w-full rounded-xl" />
              </div>
              <Esqueleto className="h-56 w-full rounded-xl" />
            </div>
          ) : !dados ? (
            <ListaVazia
              icone={<BarChart3 />}
              titulo="Não deu para carregar os relatórios"
              descricao="Confira a internet e tente de novo."
              acao={
                <Botao variante="contorno" onClick={() => void carregarDados()}>
                  Tentar de novo
                </Botao>
              }
            />
          ) : (
            <>
              <Cartao
                className={cn(
                  'grid grid-cols-2 md:grid-cols-4 transition-opacity',
                  loading && 'opacity-60',
                )}
                aria-busy={loading || undefined}
              >
                {kpis.map((kpi, indice) => (
                  <div
                    key={kpi.rotulo}
                    className={cn(
                      'min-w-0 px-4 py-3.5 md:px-5 md:py-4',
                      indice % 2 === 1 && 'border-l border-border/70',
                      indice >= 2 && 'border-t border-border/70 md:border-t-0',
                      indice === 2 && 'md:border-l',
                    )}
                  >
                    <p className="truncate text-[13px] text-muted-foreground">{kpi.rotulo}</p>
                    <p
                      className={cn(
                        'mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-foreground md:text-xl',
                        kpi.classe,
                      )}
                    >
                      {kpi.valor}
                    </p>
                  </div>
                ))}
              </Cartao>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Secao titulo="Pedidos por tipo">
                  <Cartao className="p-4 md:p-5">
                    <ul className="divide-y divide-border/70">
                      {tiposPedido.map((tipo) => {
                        const Icone = tipo.icone
                        return (
                          <li key={tipo.rotulo} className="flex min-h-12 items-center gap-3 py-2 first:pt-0">
                            <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{tipo.rotulo}</span>
                            <span className="text-sm tabular-nums text-muted-foreground">{tipo.quantidade}</span>
                            <span className="w-28 text-right text-sm font-medium tabular-nums text-foreground">
                              R$ {formatarMoeda(tipo.total)}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="mt-3 h-48">
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
                  </Cartao>
                </Secao>

                <Secao titulo="Entregas feitas">
                  <Lista>
                    {entregasPeriodo.map((linha) => {
                      const Icone = linha.icone
                      return (
                        <li key={linha.rotulo} className="flex min-h-14 items-center gap-3 px-4 py-3">
                          <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">{linha.rotulo}</p>
                            <p className="text-[13px] text-muted-foreground">{linha.ajuda}</p>
                          </div>
                          <p className="text-xl font-semibold tabular-nums text-foreground">{linha.valor}</p>
                        </li>
                      )
                    })}
                    <li className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="text-sm text-muted-foreground">Média por dia no mês</span>
                      <span className="text-sm font-medium tabular-nums text-foreground">
                        {dados.entregasPorPeriodo.mes > 0
                          ? (dados.entregasPorPeriodo.mes / new Date().getDate()).toFixed(1)
                          : '0'}{' '}
                        entregas
                      </span>
                    </li>
                  </Lista>
                </Secao>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Secao titulo="Vendas por dia">
                  <Cartao className="p-4 md:p-5">
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
                  </Cartao>
                </Secao>

                <Secao titulo="Horários de mais movimento">
                  <Cartao className="p-4 md:p-5">
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
                  </Cartao>
                </Secao>
              </div>

              <Secao titulo="Vendas por forma de pagamento">
                {dados.faturamentoPorPagamento.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
                    <Lista>
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
                          <li key={item.forma} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Icone className={cn('size-4 shrink-0', config.cor)} aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{config.nome}</p>
                                <p className="text-[13px] text-muted-foreground">
                                  {item.quantidade} {item.quantidade === 1 ? 'pagamento' : 'pagamentos'} · {percentual}%
                                </p>
                              </div>
                              <p className="text-sm font-semibold tabular-nums text-foreground">
                                R$ {formatarMoeda(item.total)}
                              </p>
                            </div>
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full transition-all duration-500 motion-reduce:transition-none"
                                style={{
                                  width: `${Math.min(100, Number(percentual))}%`,
                                  backgroundColor: config.chartCor,
                                }}
                              />
                            </div>
                          </li>
                        )
                      })}
                    </Lista>
                    <Cartao className="p-4">
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
                                borderWidth: 0,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { position: 'bottom' },
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
                    </Cartao>
                  </div>
                ) : (
                  <ListaVazia icone={<CreditCard />} titulo="Nenhum pagamento no período" />
                )}
              </Secao>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Secao titulo="10 produtos mais vendidos">
                  {dados.produtosMaisVendidos.length > 0 ? (
                    <Lista>
                      {dados.produtosMaisVendidos.map((produto, index) => (
                        <li key={`${produto.nome}-${index}`} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                          <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{produto.nome}</span>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-foreground">{produto.quantidade}x</p>
                            <p className="text-[13px] tabular-nums text-muted-foreground">
                              R$ {formatarMoeda(produto.receita)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </Lista>
                  ) : (
                    <ListaVazia icone={<Package />} titulo="Nenhum produto vendido no período" />
                  )}
                </Secao>

                <Secao titulo="Vendas por categoria">
                  <Cartao className="p-4 md:p-5">
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
                              borderWidth: 0,
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
                  </Cartao>
                </Secao>
              </div>

              {dados.entregasPorBairro && dados.entregasPorBairro.length > 0 && (
                <Secao
                  titulo="Entregas por bairro"
                  descricao={`${dados.entregasPorBairro.reduce((acc, b) => acc + b.quantidade, 0)} entregas · R$ ${formatarMoeda(dados.entregasPorBairro.reduce((acc, b) => acc + b.taxaTotal, 0))} em taxas`}
                >
                  <Lista>
                    {dados.entregasPorBairro.map((item, index) => (
                      <li key={item.bairro} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                        <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.bairro}</span>
                        <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">
                          {item.quantidade} {item.quantidade === 1 ? 'entrega' : 'entregas'}
                        </span>
                        <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                          R$ {formatarMoeda(item.taxaTotal)}
                        </span>
                      </li>
                    ))}
                  </Lista>
                </Secao>
              )}
            </>
          )}
        </Pagina>
      </AdminLayout>
    </ProtectedRoute>
  )
}
