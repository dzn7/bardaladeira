'use client'

import { useState, useMemo } from 'react'
import { MagnifyingGlass as Search, ShoppingCart, Funnel as Filter, CaretRight } from '@phosphor-icons/react'
import { Botao, Campo, Entrada, Gaveta, Lista, ListaVazia, Segmentos, Selo } from '@/components/admin/ui'
import { rotuloTipoPedidoHistorico, tomStatusPedidoHistorico } from './ModalDetalhesPedidoHistorico'
import type { PedidoHistorico } from '@/lib/tipos-anos-anteriores'

type PedidosAnoAnteriorProps = {
  pedidos: PedidoHistorico[]
  ano: number
  onVerDetalhes: (pedido: PedidoHistorico) => void
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatarDataHora = (data: string): string => {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  })
}

export default function PedidosAnoAnterior({
  pedidos,
  ano,
  onVerDetalhes
}: PedidosAnoAnteriorProps) {
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 20

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(pedido => {
      const buscaLower = busca.toLowerCase()
      const matchBusca = !busca || 
        pedido.nome_cliente.toLowerCase().includes(buscaLower) ||
        pedido.telefone?.toLowerCase().includes(buscaLower) ||
        pedido.id.toLowerCase().includes(buscaLower)

      const matchTipo = filtroTipo === 'todos' || pedido.tipo_entrega === filtroTipo
      const matchStatus = filtroStatus === 'todos' || pedido.status?.toLowerCase() === filtroStatus

      return matchBusca && matchTipo && matchStatus
    })
  }, [pedidos, busca, filtroTipo, filtroStatus])

  const totalPaginas = Math.ceil(pedidosFiltrados.length / itensPorPagina)
  const pedidosPaginados = pedidosFiltrados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  )

  const opcoesTipo = [
    { valor: 'todos', rotulo: 'Todos' },
    { valor: 'entrega', rotulo: 'Entrega' },
    { valor: 'retirada', rotulo: 'Retirada' },
    { valor: 'local', rotulo: 'No local' },
  ]
  const opcoesStatus = [
    { valor: 'todos', rotulo: 'Todos' },
    { valor: 'pendente', rotulo: 'Pendente' },
    { valor: 'preparando', rotulo: 'Preparando' },
    { valor: 'pronto', rotulo: 'Pronto' },
    { valor: 'entregue', rotulo: 'Entregue' },
    { valor: 'cancelado', rotulo: 'Cancelado' },
  ]
  const filtrosAtivos = (filtroTipo !== 'todos' ? 1 : 0) + (filtroStatus !== 'todos' ? 1 : 0)

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Entrada
            type="search"
            placeholder="Buscar por nome, telefone ou código"
            aria-label="Buscar pedido"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value)
              setPaginaAtual(1)
            }}
            className="pl-9"
          />
        </div>
        <Botao
          variante="contorno"
          className="h-11 md:h-10"
          onClick={() => setMostrarFiltros(true)}
          aria-label={filtrosAtivos ? `Filtros (${filtrosAtivos} ativos)` : 'Filtros'}
        >
          <Filter />
          <span className="hidden sm:inline">Filtros</span>
          {filtrosAtivos > 0 && <Selo tom="primario">{filtrosAtivos}</Selo>}
        </Botao>
      </div>

      <p className="px-1 text-sm text-muted-foreground">
        {pedidosFiltrados.length} {pedidosFiltrados.length === 1 ? 'pedido' : 'pedidos'} em {ano}
      </p>

      {pedidosFiltrados.length === 0 ? (
        <ListaVazia
          icone={<ShoppingCart />}
          titulo="Nenhum pedido encontrado"
          descricao={busca || filtrosAtivos ? 'Tente outra busca ou limpe os filtros.' : undefined}
          acao={
            busca || filtrosAtivos ? (
              <Botao
                variante="contorno"
                onClick={() => {
                  setBusca('')
                  setFiltroTipo('todos')
                  setFiltroStatus('todos')
                  setPaginaAtual(1)
                }}
              >
                Limpar busca e filtros
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <Lista>
          {pedidosPaginados.map((pedido) => (
            <li key={pedido.id}>
              <button
                type="button"
                onClick={() => onVerDetalhes(pedido)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{pedido.nome_cliente}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span className="tabular-nums">{formatarDataHora(pedido.created_at)}</span>
                    <span aria-hidden>·</span>
                    <span>{rotuloTipoPedidoHistorico(pedido.tipo_entrega)}</span>
                    <Selo tom={tomStatusPedidoHistorico(pedido.status)} className="capitalize">{pedido.status}</Selo>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  R$ {formatarMoeda(pedido.total)}
                </span>
                <CaretRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </Lista>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <Botao
            variante="contorno"
            className="h-11 md:h-10"
            onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
            disabled={paginaAtual === 1}
          >
            Anterior
          </Botao>
          <span className="text-sm tabular-nums text-muted-foreground">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <Botao
            variante="contorno"
            className="h-11 md:h-10"
            onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
            disabled={paginaAtual === totalPaginas}
          >
            Próxima
          </Botao>
        </div>
      )}

      <Gaveta
        aberto={mostrarFiltros}
        aoFechar={() => setMostrarFiltros(false)}
        titulo="Filtrar pedidos"
        rodape={
          <>
            <Botao
              variante="contorno"
              onClick={() => {
                setFiltroTipo('todos')
                setFiltroStatus('todos')
                setPaginaAtual(1)
              }}
            >
              Limpar
            </Botao>
            <Botao onClick={() => setMostrarFiltros(false)}>Ver {pedidosFiltrados.length} pedidos</Botao>
          </>
        }
      >
        <div className="space-y-5">
          <Campo rotulo="Tipo de pedido">
            <Segmentos
              opcoes={opcoesTipo}
              valor={filtroTipo}
              aoMudar={(valor) => {
                setFiltroTipo(valor)
                setPaginaAtual(1)
              }}
              rotuloAcessivel="Tipo de pedido"
            />
          </Campo>
          <Campo rotulo="Situação">
            <Segmentos
              opcoes={opcoesStatus}
              valor={filtroStatus}
              aoMudar={(valor) => {
                setFiltroStatus(valor)
                setPaginaAtual(1)
              }}
              rotuloAcessivel="Situação do pedido"
            />
          </Campo>
        </div>
      </Gaveta>
    </div>
  )
}
