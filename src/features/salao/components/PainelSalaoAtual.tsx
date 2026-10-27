'use client'

import { useMemo, useState } from 'react'
import { format, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Warning as AlertTriangle, List, ArrowsClockwise as RefreshCw, MagnifyingGlass as Search, UserCheck, UserPlus, Wallet, X } from '@phosphor-icons/react'
import { ListaVazia, GradeSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Botao, Chip, Entrada, Gaveta, Selo } from '@/components/admin/ui'
import ModalDetalhesPedido from '@/components/admin/ModalDetalhesPedido'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'
import { TEMPO_AVISO_MESA_MINUTOS } from '@/lib/mesas-tempo'
import IconeMesa from '@/components/icons/IconeMesa'
import { estaNoDiaOperacionalAtual } from '@/lib/dia-operacional'
import { pedidoTemPagamentoPendente } from '@/lib/pedidos-utils'
import { cn } from '@/lib/utils'
import { CardMesaSalao } from './CardMesaSalao'

type TipoPontoSalao = 'mesa' | 'comanda' | 'local_externo'

type PontoSalao = {
  id: string
  numero: number
  tipo: TipoPontoSalao
  status: 'livre' | 'ocupada'
  nome_cliente: string | null
  ocupada_em: string | null
  liberar_em: string | null
  tempo_limite_minutos: number | null
  pedido_id: string | null
  codigo_qr: string
  identificador: string | null
  updated_at: string
}

type ItemPedidoSalao = {
  id: string
  nome_item: string | null
  quantidade: number
  subtotal: number
  observacoes: string | null
  created_at: string | null
  adicionado_por_garcom_id: string | null
  nome_garcom?: string | null
}

type AtividadeGarcomSalao = {
  id: string
  garcom_id: string
  tipo_acao: string
  pedido_id: string | null
  item_pedido_id: string | null
  descricao: string | null
  created_at: string | null
  nome_garcom?: string | null
}

type PedidoSalao = {
  id: string
  numero_pedido: number | null
  nome_cliente: string
  telefone: string | null
  endereco: string | null
  bairro: string | null
  tipo_entrega: string
  status: string
  created_at: string
  observacoes: string | null
  forma_pagamento: string | null
  pagamento_online?: boolean | null
  pagamento_online_status?: string | null
  troco_para: number | null
  subtotal: number
  taxa_entrega: number
  taxa_servico: number
  total: number
  mesa: number | null
  comanda: number | null
  mesa_id: string | null
  garcom_id: string | null
  nome_garcom?: string | null
  itens_pedido: ItemPedidoSalao[]
  atividades_garcom: AtividadeGarcomSalao[]
}

type PedidoEdicao = {
  id: string
  nome_cliente: string
  telefone?: string
  endereco?: string
  bairro?: string
  tipo_entrega: string
  status: string
  subtotal: number
  taxa_entrega: number
  taxa_servico?: number
  total: number
  created_at: string
  forma_pagamento?: string
  troco_para?: number | null
  observacoes?: string
  mesa?: number | null
  comanda?: number | null
}

type EventoTimelineSalao = {
  id: string
  data: string
  titulo: string
  detalhe: string
  garcom: string | null
  tipo: 'item' | 'atividade'
}

type GarcomSalao = {
  id: string
  nome: string
}

type PainelSalaoAtualProps = {
  mesas: PontoSalao[]
  pedidos: PedidoSalao[]
  tipo?: TipoPontoSalao
  garcons?: GarcomSalao[]
  carregando?: boolean
  atualizandoPonto?: string | null
  atribuindoPedidoId?: string | null
  mostrarAtribuicao?: boolean
  permitirEdicaoInterna?: boolean
  onAtualizar: () => void
  onAbrirPedido: (ponto: PontoSalao) => void | Promise<void>
  onLiberarMesa?: (ponto: PontoSalao) => void | Promise<void>
  onEstenderMesa?: (ponto: PontoSalao, minutos: number) => void | Promise<void>
  onEditarPedido?: (pedido: PedidoSalao) => void | Promise<void>
  onAtribuirGarcom?: (pedido: PedidoSalao, garcomId: string | null) => void | Promise<void>
  onEnviarCrediario?: (pedido: PedidoSalao) => void | Promise<void>
  onImprimirPedido?: (pedido: PedidoSalao) => void | Promise<void>
  onConfirmarPagamento?: (pedido: PedidoSalao) => void | Promise<void>
  onExcluirPedido?: (pedido: PedidoSalao) => void | Promise<void>
  acoesPedido?: Record<string, Partial<Record<'pagamento' | 'impressao' | 'excluir', boolean>>>
  pontosEmFechamento?: Record<string, boolean>
}

const LABEL_ACOES: Record<string, string> = {
  item_adicionado: 'Item adicionado',
  mesa_atribuida: 'Mesa atribuída',
  pedido_modificado: 'Pedido alterado',
  item_removido: 'Item removido',
  item_atualizado: 'Item alterado',
  pedido_criado: 'Pedido criado',
  pedido_finalizado: 'Pedido finalizado',
}

const formatarMoeda = (valor: number) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

const normalizarBusca = (valor: string) =>
  valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const formatarHora = (valor: string | null | undefined) => {
  if (!valor) return '--:--'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '--:--'
  return format(data, 'HH:mm', { locale: ptBR })
}

const formatarDataHora = (valor: string | null | undefined) => {
  if (!valor) return 'Sem horário'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Sem horário'
  return format(data, "dd/MM 'às' HH:mm", { locale: ptBR })
}

const pedidoAbertoNoDia = (pedido: PedidoSalao) => {
  const status = String(pedido.status || '').trim().toLowerCase()
  return status !== 'entregue' && status !== 'cancelado' && estaNoDiaOperacionalAtual(pedido.created_at)
}

const obterPedidoPonto = (ponto: PontoSalao, pedidos: PedidoSalao[]) => {
  const pedidosAtivos = pedidos.filter(pedidoAbertoNoDia)

  if (ponto.pedido_id) {
    const porId = pedidosAtivos.find((pedido) => pedido.id === ponto.pedido_id)
    if (porId) return porId
  }

  if (ponto.id) {
    const porMesaId = pedidosAtivos.find((pedido) => pedido.mesa_id === ponto.id)
    if (porMesaId) return porMesaId
  }

  if (ponto.tipo === 'local_externo') return null

  return pedidosAtivos.find((pedido) => (ponto.tipo === 'comanda' ? pedido.comanda === ponto.numero : pedido.mesa === ponto.numero)) || null
}

const obterTempoPonto = (ponto: PontoSalao) => {
  if (!ponto.ocupada_em) return { texto: 'Aberta agora', urgente: false }

  const minutosAberta = Math.max(0, differenceInMinutes(new Date(), new Date(ponto.ocupada_em)))
  if (!ponto.liberar_em) return { texto: `${minutosAberta} min aberta`, urgente: false }

  const minutosRestantes = differenceInMinutes(new Date(ponto.liberar_em), new Date())
  if (minutosRestantes <= 0) return { texto: 'Tempo esgotado', urgente: true }

  return {
    texto: `${minutosAberta} min aberta · ${minutosRestantes} min restantes`,
    urgente: minutosRestantes <= TEMPO_AVISO_MESA_MINUTOS,
  }
}

const montarEventosTimeline = (pedido: PedidoSalao | null): EventoTimelineSalao[] => {
  if (!pedido) return []

  const eventosItens = pedido.itens_pedido.map((item) => ({
    id: `item-${item.id}`,
    data: item.created_at || pedido.created_at,
    titulo: `${item.quantidade}x ${item.nome_item || 'Item'}`,
    detalhe: item.observacoes ? `Obs.: ${item.observacoes}` : `Subtotal ${formatarMoeda(item.subtotal)}`,
    garcom: item.nome_garcom || pedido.nome_garcom || null,
    tipo: 'item' as const,
  }))

  const eventosAtividade = pedido.atividades_garcom.map((atividade) => ({
    id: `atividade-${atividade.id}`,
    data: atividade.created_at || pedido.created_at,
    titulo: LABEL_ACOES[atividade.tipo_acao] || atividade.tipo_acao.replaceAll('_', ' '),
    detalhe: atividade.descricao || 'Alteração registrada',
    garcom: atividade.nome_garcom || pedido.nome_garcom || null,
    tipo: 'atividade' as const,
  }))

  return [...eventosItens, ...eventosAtividade].sort((a, b) => {
    const dataA = new Date(a.data).getTime()
    const dataB = new Date(b.data).getTime()
    return dataB - dataA
  })
}

const converterPedidoParaEdicao = (pedido: PedidoSalao): PedidoEdicao => ({
  id: pedido.id,
  nome_cliente: pedido.nome_cliente,
  telefone: pedido.telefone || undefined,
  endereco: pedido.endereco || undefined,
  bairro: pedido.bairro || undefined,
  tipo_entrega: pedido.tipo_entrega,
  status: pedido.status,
  subtotal: pedido.subtotal,
  taxa_entrega: pedido.taxa_entrega,
  taxa_servico: pedido.taxa_servico,
  total: pedido.total,
  created_at: pedido.created_at,
  forma_pagamento: pedido.forma_pagamento || undefined,
  troco_para: pedido.troco_para,
  observacoes: pedido.observacoes || undefined,
  mesa: pedido.mesa,
  comanda: pedido.comanda,
})

export default function PainelSalaoAtual({
  mesas,
  pedidos,
  tipo = 'mesa',
  garcons = [],
  carregando = false,
  atualizandoPonto = null,
  atribuindoPedidoId = null,
  mostrarAtribuicao = true,
  permitirEdicaoInterna = true,
  onAtualizar,
  onAbrirPedido,
  onLiberarMesa,
  onEstenderMesa,
  onEditarPedido,
  onAtribuirGarcom,
  onEnviarCrediario,
  onImprimirPedido,
  onConfirmarPagamento,
  onExcluirPedido,
  acoesPedido = {},
  pontosEmFechamento = {},
}: PainelSalaoAtualProps) {
  const [pedidoDetalhesId, setPedidoDetalhesId] = useState<string | null>(null)
  const [pedidoEdicao, setPedidoEdicao] = useState<PedidoEdicao | null>(null)
  const [pedidoTimeline, setPedidoTimeline] = useState<PedidoSalao | null>(null)
  const [pedidoAtribuicao, setPedidoAtribuicao] = useState<PedidoSalao | null>(null)
  const [buscaPonto, setBuscaPonto] = useState('')
  const [filtroRapido, setFiltroRapido] = useState<'todos' | 'urgentes' | 'sem-garcom' | 'pagamento'>('todos')
  const podeEditarPedido = Boolean(onEditarPedido) || permitirEdicaoInterna
  const ehParceiro = tipo === 'local_externo'
  const nomeTipo = tipo === 'comanda' ? 'comanda' : ehParceiro ? 'local parceiro' : 'mesa'
  const nomeTipoCapitalizado = tipo === 'comanda' ? 'Comanda' : ehParceiro ? 'Local parceiro' : 'Mesa'

  const pontosOcupados = useMemo(() => {
    if (ehParceiro) {
      // Parceiros nunca ficam com status='ocupada'; derive a lista a partir de pedidos abertos
      const parceiros = mesas.filter((ponto) => ponto.tipo === 'local_externo')
      const sintetizados: PontoSalao[] = []
      for (const pedido of pedidos) {
        if (pedido.tipo_entrega !== 'local' || !pedidoAbertoNoDia(pedido)) continue
        const parceiro = pedido.mesa_id ? parceiros.find((p) => p.id === pedido.mesa_id) || null : null
        if (!parceiro) continue
        sintetizados.push({
          ...parceiro,
          pedido_id: pedido.id,
          ocupada_em: pedido.created_at,
          nome_cliente: pedido.nome_cliente || parceiro.nome_cliente,
        })
      }
      return sintetizados
    }
    return mesas.filter((ponto) => ponto.tipo === tipo && ponto.status === 'ocupada')
  }, [ehParceiro, mesas, pedidos, tipo])

  const resumo = useMemo(() => {
    const totalPedidos = pontosOcupados.reduce((total, ponto) => {
      const pedido = obterPedidoPonto(ponto, pedidos)
      return total + Number(pedido?.total || 0)
    }, 0)

    const totalItens = pontosOcupados.reduce((total, ponto) => {
      const pedido = obterPedidoPonto(ponto, pedidos)
      return total + (pedido?.itens_pedido.length || 0)
    }, 0)

    return { totalPedidos, totalItens }
  }, [pontosOcupados, pedidos])

  const pontosFiltrados = useMemo(() => {
    const termo = normalizarBusca(buscaPonto)
    return pontosOcupados.filter((ponto) => {
      const pedido = obterPedidoPonto(ponto, pedidos)
      const tempo = obterTempoPonto(ponto)
      if (filtroRapido === 'urgentes' && (ehParceiro || !tempo.urgente)) return false
      if (filtroRapido === 'sem-garcom' && (!pedido || pedido.garcom_id)) return false
      if (filtroRapido === 'pagamento' && (!pedido || !pedidoTemPagamentoPendente(pedido))) return false
      if (!termo) return true
      const titulo = ponto.identificador || `${nomeTipoCapitalizado} ${ponto.numero}`
      const alvo = normalizarBusca(
        [
          titulo,
          ponto.nome_cliente || '',
          pedido?.nome_cliente || '',
          pedido?.numero_pedido ? String(pedido.numero_pedido) : '',
          pedido?.nome_garcom || '',
          ...(pedido?.itens_pedido || []).map((item) => item.nome_item || ''),
        ].join(' '),
      )
      return alvo.includes(termo)
    })
  }, [buscaPonto, ehParceiro, filtroRapido, nomeTipoCapitalizado, pedidos, pontosOcupados])

  const contagemFiltros = useMemo(() => {
    let urgentes = 0
    let semGarcom = 0
    let pagamento = 0
    pontosOcupados.forEach((ponto) => {
      const pedido = obterPedidoPonto(ponto, pedidos)
      const tempo = obterTempoPonto(ponto)
      if (!ehParceiro && tempo.urgente) urgentes += 1
      if (pedido && !pedido.garcom_id) semGarcom += 1
      if (pedido && pedidoTemPagamentoPendente(pedido)) pagamento += 1
    })
    return { urgentes, semGarcom, pagamento }
  }, [ehParceiro, pedidos, pontosOcupados])

  const eventosTimelineDialog = useMemo(() => montarEventosTimeline(pedidoTimeline), [pedidoTimeline])

  const atribuirGarcom = async (garcomId: string | null) => {
    if (!pedidoAtribuicao || !onAtribuirGarcom) return
    await onAtribuirGarcom(pedidoAtribuicao, garcomId)
    setPedidoAtribuicao(null)
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                {ehParceiro ? 'Locais parceiros' : 'Mesas do salão'}
              </h2>
              <Selo className="text-xs">
                {pontosOcupados.length} {ehParceiro ? 'abertos' : 'ocupadas'}
              </Selo>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {resumo.totalItens} itens · {formatarMoeda(resumo.totalPedidos)} em aberto
            </p>
          </div>

          <Botao
            variante="contorno"
            onClick={onAtualizar}
            disabled={carregando}
            className="h-11 self-start md:h-10"
          >
            <RefreshCw className={cn(carregando && 'animate-spin')} />
            Atualizar
          </Botao>
        </div>

        <div
          role="group"
          aria-label="Filtros rápidos do salão"
          className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0"
        >
          <Chip ativo={filtroRapido === 'todos'} onClick={() => setFiltroRapido('todos')} aria-label="Todas as mesas">
            <List className="size-4" />
            Todas
          </Chip>
          {!ehParceiro ? (
            <Chip ativo={filtroRapido === 'urgentes'} onClick={() => setFiltroRapido('urgentes')} aria-label="Tempo crítico">
              <AlertTriangle className="size-4" />
              Tempo crítico ({contagemFiltros.urgentes})
            </Chip>
          ) : null}
          <Chip ativo={filtroRapido === 'sem-garcom'} onClick={() => setFiltroRapido('sem-garcom')} aria-label="Sem garçom">
            <UserPlus className="size-4" />
            Sem garçom ({contagemFiltros.semGarcom})
          </Chip>
          <Chip ativo={filtroRapido === 'pagamento'} onClick={() => setFiltroRapido('pagamento')} aria-label="Pagamento pendente">
            <Wallet className="size-4" />
            Pagamento ({contagemFiltros.pagamento})
          </Chip>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Entrada
            type="search"
            value={buscaPonto}
            onChange={(event) => setBuscaPonto(event.target.value)}
            placeholder={ehParceiro ? 'Buscar parceiro, cliente ou pedido' : 'Buscar mesa, cliente, garçom ou item'}
            aria-label={ehParceiro ? 'Buscar parceiros' : 'Buscar mesas'}
            className="pl-9 pr-11"
          />
          {buscaPonto ? (
            <button
              type="button"
              onClick={() => setBuscaPonto('')}
              className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {carregando && pontosOcupados.length === 0 ? (
          <GradeSkeleton quantidade={6} className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" />
        ) : pontosOcupados.length === 0 || pontosFiltrados.length === 0 ? (
          <ListaVazia
            className="border-0 bg-transparent py-10"
            icone={buscaPonto ? <Search className="h-6 w-6" strokeWidth={1.6} /> : <IconeMesa className="h-6 w-6" />}
            titulo={
              buscaPonto || filtroRapido !== 'todos'
                ? 'Nenhum resultado'
                : ehParceiro
                  ? 'Nenhum pedido em local parceiro'
                  : `Nenhuma ${nomeTipo} ocupada`
            }
            descricao={
              buscaPonto || filtroRapido !== 'todos'
                ? 'Ajuste a busca ou o filtro para ver outras mesas.'
                : ehParceiro
                  ? 'Quando houver pedido aberto em parceiro, ele aparece aqui.'
                  : `Quando um pedido local ocupar uma ${nomeTipo}, ela aparece aqui com tempo, garçom e total.`
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pontosFiltrados.map((mesa) => {
              const pedido = obterPedidoPonto(mesa, pedidos)
              const eventos = montarEventosTimeline(pedido)
              const tempo = obterTempoPonto(mesa)
              const tituloMesa = mesa.identificador || `${nomeTipoCapitalizado} ${mesa.numero}`
              const cliente = mesa.nome_cliente || pedido?.nome_cliente || 'Cliente'
              const garcom = pedido?.nome_garcom || 'Sem garçom vinculado'
              const atualizando = atualizandoPonto === mesa.id
              const atribuida = Boolean(pedido?.garcom_id)
              const atribuindo = Boolean(pedido && atribuindoPedidoId === pedido.id)
              const pagamentoPendente = pedido ? pedidoTemPagamentoPendente(pedido) : false
              const acoesDoPedido = pedido ? acoesPedido[pedido.id] : undefined
              const confirmandoPagamento = Boolean(acoesDoPedido?.pagamento)
              const imprimindoPedido = Boolean(acoesDoPedido?.impressao)
              const excluindoPedido = Boolean(acoesDoPedido?.excluir)
              const fechandoPonto = Boolean(pontosEmFechamento[mesa.id])
              const tempoTexto = ehParceiro
                ? (() => {
                    const minAberta = mesa.ocupada_em
                      ? Math.max(0, differenceInMinutes(new Date(), new Date(mesa.ocupada_em)))
                      : 0
                    return `${minAberta} min em aberto`
                  })()
                : tempo.texto

              return (
                <CardMesaSalao
                  key={pedido ? `${mesa.id}-${pedido.id}` : mesa.id}
                  titulo={tituloMesa}
                  cliente={cliente}
                  garcom={garcom}
                  horaAbertura={formatarHora(mesa.ocupada_em)}
                  tempoTexto={tempoTexto}
                  tempoUrgente={!ehParceiro && tempo.urgente}
                  totalFormatado={formatarMoeda(pedido?.total || 0)}
                  ehParceiro={ehParceiro}
                  atribuida={atribuida}
                  pagamentoPendente={pagamentoPendente}
                  atualizando={atualizando}
                  atribuindo={atribuindo}
                  confirmandoPagamento={confirmandoPagamento}
                  imprimindoPedido={imprimindoPedido}
                  excluindoPedido={excluindoPedido}
                  fechandoPonto={fechandoPonto}
                  eventos={eventos}
                  formatarHora={formatarHora}
                  nomeTipo={nomeTipo}
                  mostrarAtribuicao={mostrarAtribuicao}
                  temPedido={Boolean(pedido)}
                  podeEstender={Boolean(onEstenderMesa) && !ehParceiro}
                  podeCrediario={Boolean(
                    pedido && onEnviarCrediario && !String(pedido.forma_pagamento || '').toLowerCase().includes('credi'),
                  )}
                  podeExcluir={Boolean(pedido && onExcluirPedido)}
                  podeImprimir={Boolean(pedido && onImprimirPedido)}
                  podeLiberar={Boolean(pedido && onLiberarMesa)}
                  onAbrir={() => (pedido ? setPedidoDetalhesId(pedido.id) : void onAbrirPedido(mesa))}
                  onEditar={podeEditarPedido ? () => {
                    if (!pedido) {
                      void onAbrirPedido(mesa)
                      return
                    }
                    if (onEditarPedido) {
                      void onEditarPedido(pedido)
                      return
                    }
                    setPedidoEdicao(converterPedidoParaEdicao(pedido))
                  } : undefined}
                  onAtribuirGarcom={pedido && onAtribuirGarcom ? () => setPedidoAtribuicao(pedido) : undefined}
                  onVerTimeline={() => setPedidoTimeline(pedido)}
                  onConfirmarPagamento={
                    pedido && onConfirmarPagamento ? () => void onConfirmarPagamento(pedido) : undefined
                  }
                  onImprimir={pedido && onImprimirPedido ? () => void onImprimirPedido(pedido) : undefined}
                  onLiberar={onLiberarMesa ? () => void onLiberarMesa(mesa) : undefined}
                  onEstender={onEstenderMesa ? (minutos) => void onEstenderMesa(mesa, minutos) : undefined}
                  onCrediario={pedido && onEnviarCrediario ? () => void onEnviarCrediario(pedido) : undefined}
                  onExcluir={pedido && onExcluirPedido ? () => void onExcluirPedido(pedido) : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      <Gaveta
        aberto={Boolean(pedidoTimeline)}
        aoFechar={() => setPedidoTimeline(null)}
        largura="lg"
        titulo={`Histórico da ${nomeTipo}`}
        descricao={
          pedidoTimeline
            ? `${pedidoTimeline.nome_cliente} · pedido #${pedidoTimeline.numero_pedido || pedidoTimeline.id.slice(0, 8)}`
            : 'Tudo que aconteceu neste pedido'
        }
      >
        {eventosTimelineDialog.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem movimentos ainda.</p>
        ) : (
          <ol className="space-y-4">
            {eventosTimelineDialog.map((evento) => (
              <li key={evento.id} className="grid grid-cols-[48px_minmax(0,1fr)] gap-3">
                <span className="pt-0.5 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                  {formatarHora(evento.data)}
                </span>
                <div className="min-w-0 border-l border-border/70 pl-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{evento.titulo}</p>
                    <Selo>{evento.tipo === 'item' ? 'Item' : 'Alteração'}</Selo>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{evento.detalhe}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {evento.garcom || 'Garçom não identificado'} · {formatarDataHora(evento.data)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Gaveta>

      <Gaveta
        aberto={Boolean(pedidoAtribuicao)}
        aoFechar={() => setPedidoAtribuicao(null)}
        bloqueada={Boolean(pedidoAtribuicao && atribuindoPedidoId === pedidoAtribuicao.id)}
        titulo={`Quem atende esta ${nomeTipo}?`}
        descricao={
          pedidoAtribuicao
            ? `${nomeTipoCapitalizado} ${pedidoAtribuicao.mesa || pedidoAtribuicao.comanda || '-'} · ${pedidoAtribuicao.nome_cliente}`
            : `Escolha o garçom responsável pela ${nomeTipo}`
        }
      >
        {garcons.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            Nenhum garçom ativo encontrado.
          </p>
        ) : (
          <div className="space-y-2">
            {garcons.map((garcom) => {
              const selecionado = pedidoAtribuicao?.garcom_id === garcom.id
              return (
                <button
                  key={garcom.id}
                  type="button"
                  aria-pressed={selecionado}
                  disabled={Boolean(pedidoAtribuicao && atribuindoPedidoId === pedidoAtribuicao.id)}
                  onClick={() => void atribuirGarcom(garcom.id)}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50',
                    selecionado
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border/70 bg-card hover:bg-accent',
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                    <UserCheck className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{garcom.nome}</span>
                  {selecionado && <Selo tom="primario">Atual</Selo>}
                </button>
              )
            })}
          </div>
        )}

        {pedidoAtribuicao?.garcom_id && (
          <Botao
            variante="perigoSuave"
            className="mt-4 h-11 w-full md:h-10"
            disabled={atribuindoPedidoId === pedidoAtribuicao.id}
            onClick={() => void atribuirGarcom(null)}
          >
            Remover garçom da {nomeTipo}
          </Botao>
        )}
      </Gaveta>

      <ModalDetalhesPedido
        pedidoId={pedidoDetalhesId}
        aberto={Boolean(pedidoDetalhesId)}
        onFechar={() => setPedidoDetalhesId(null)}
        onEditar={podeEditarPedido ? (pedido) => {
          setPedidoDetalhesId(null)
          if (onEditarPedido) {
            void onEditarPedido({
              id: pedido.id,
              numero_pedido: null,
              nome_cliente: pedido.nome_cliente,
              telefone: pedido.telefone || null,
              endereco: pedido.endereco || null,
              bairro: pedido.bairro || null,
              tipo_entrega: pedido.tipo_entrega,
              status: pedido.status,
              created_at: pedido.created_at,
              observacoes: pedido.observacoes || null,
              forma_pagamento: pedido.forma_pagamento || null,
              troco_para: pedido.troco_para || null,
              subtotal: pedido.subtotal,
              taxa_entrega: pedido.taxa_entrega,
              taxa_servico: pedido.taxa_servico || 0,
              total: pedido.total,
              mesa: pedido.mesa || null,
              comanda: pedido.comanda || null,
              mesa_id: null,
              garcom_id: pedido.garcom_id || null,
              itens_pedido: [],
              atividades_garcom: [],
            })
            return
          }
          setPedidoEdicao({
            id: pedido.id,
            nome_cliente: pedido.nome_cliente,
            telefone: pedido.telefone || undefined,
            endereco: pedido.endereco || undefined,
            bairro: pedido.bairro || undefined,
            tipo_entrega: pedido.tipo_entrega,
            status: pedido.status,
            subtotal: pedido.subtotal,
            taxa_entrega: pedido.taxa_entrega,
            taxa_servico: pedido.taxa_servico,
            total: pedido.total,
            created_at: pedido.created_at,
            forma_pagamento: pedido.forma_pagamento || undefined,
            troco_para: pedido.troco_para,
            observacoes: pedido.observacoes || undefined,
            mesa: pedido.mesa,
            comanda: pedido.comanda,
          })
        } : undefined}
      />

      <ModalEditarPedido
        pedido={pedidoEdicao}
        aberto={Boolean(pedidoEdicao)}
        onFechar={() => setPedidoEdicao(null)}
        onSucesso={() => {
          setPedidoEdicao(null)
          onAtualizar()
        }}
      />
    </section>
  )
}
