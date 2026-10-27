'use client'

import { useState, useMemo } from 'react'
import { MagnifyingGlass as Search, Truck, Funnel as Filter } from '@phosphor-icons/react'
import { Botao, Campo, Cartao, Entrada, Gaveta, Lista, ListaVazia, Segmentos, Selecao, Selo } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import type { EntregaHistorico } from '@/lib/tipos-anos-anteriores'

type EntregasAnoAnteriorProps = {
  entregas: EntregaHistorico[]
  ano: number
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatarDataHora = (data: string | undefined): string => {
  if (!data) return '-'
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  })
}

const tomStatus = (status: string): 'neutro' | 'primario' | 'sucesso' | 'alerta' | 'perigo' => {
  switch (status?.toLowerCase()) {
    case 'pendente':
      return 'alerta'
    case 'em_transito':
    case 'em transito':
    case 'em trânsito':
      return 'primario'
    case 'entregue':
      return 'sucesso'
    case 'cancelada':
      return 'perigo'
    default:
      return 'neutro'
  }
}

const formatarStatus = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'pendente': return 'Pendente'
    case 'em_transito':
    case 'em transito':
    case 'em trânsito': return 'Em trânsito'
    case 'entregue': return 'Entregue'
    case 'cancelada': return 'Cancelada'
    default: return status || 'Desconhecido'
  }
}

export default function EntregasAnoAnterior({ entregas, ano }: EntregasAnoAnteriorProps) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroBairro, setFiltroBairro] = useState<string>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 20

  // Lista de bairros únicos
  const bairrosUnicos = useMemo(() => {
    const bairros = new Set<string>()
    entregas.forEach(e => {
      if (e.bairro) bairros.add(e.bairro)
    })
    return Array.from(bairros).sort()
  }, [entregas])

  const entregasFiltradas = useMemo(() => {
    return entregas.filter(entrega => {
      const buscaLower = busca.toLowerCase()
      const matchBusca = !busca ||
        entrega.entregador_nome?.toLowerCase().includes(buscaLower) ||
        entrega.endereco_entrega?.toLowerCase().includes(buscaLower) ||
        entrega.bairro?.toLowerCase().includes(buscaLower) ||
        entrega.pedido_id?.toLowerCase().includes(buscaLower)

      const matchStatus = filtroStatus === 'todos' || entrega.status?.toLowerCase() === filtroStatus
      const matchBairro = filtroBairro === 'todos' || entrega.bairro === filtroBairro

      return matchBusca && matchStatus && matchBairro
    })
  }, [entregas, busca, filtroStatus, filtroBairro])

  const totalPaginas = Math.ceil(entregasFiltradas.length / itensPorPagina)
  const entregasPaginadas = entregasFiltradas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  )

  // Estatísticas
  const estatisticas = useMemo(() => {
    const total = entregas.length
    const entregues = entregas.filter(e => e.status?.toLowerCase() === 'entregue').length
    const totalTaxas = entregas.reduce((sum, e) => sum + (Number(e.taxa_entrega) || 0), 0)
    const tempoMedio = entregas
      .filter(e => e.tempo_real)
      .reduce((sum, e, _, arr) => sum + (e.tempo_real || 0) / arr.length, 0)

    return { total, entregues, totalTaxas, tempoMedio }
  }, [entregas])

  const filtrosAtivos = (filtroStatus !== 'todos' ? 1 : 0) + (filtroBairro !== 'todos' ? 1 : 0)
  const kpis = [
    { rotulo: 'Entregas', valor: String(estatisticas.total) },
    { rotulo: 'Concluídas', valor: String(estatisticas.entregues) },
    { rotulo: 'Total em taxas', valor: `R$ ${formatarMoeda(estatisticas.totalTaxas)}` },
    { rotulo: 'Tempo médio', valor: estatisticas.tempoMedio > 0 ? `${Math.round(estatisticas.tempoMedio)} min` : '–' },
  ]

  return (
    <div className="space-y-4">
      <Cartao className="grid grid-cols-2 md:grid-cols-4">
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
            <p className="mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-foreground md:text-xl">
              {kpi.valor}
            </p>
          </div>
        ))}
      </Cartao>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Entrada
            type="search"
            placeholder="Buscar por endereço, bairro ou entregador"
            aria-label="Buscar entrega"
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
        {entregasFiltradas.length} {entregasFiltradas.length === 1 ? 'entrega' : 'entregas'} em {ano}
      </p>

      {entregasFiltradas.length === 0 ? (
        <ListaVazia
          icone={<Truck />}
          titulo="Nenhuma entrega encontrada"
          descricao={busca || filtrosAtivos ? 'Tente outra busca ou limpe os filtros.' : undefined}
          acao={
            busca || filtrosAtivos ? (
              <Botao
                variante="contorno"
                onClick={() => {
                  setBusca('')
                  setFiltroStatus('todos')
                  setFiltroBairro('todos')
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
          {entregasPaginadas.map((entrega) => (
            <li key={entrega.id} className="flex items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="truncate font-medium text-foreground">
                    {entrega.bairro || entrega.endereco_entrega || `Pedido #${entrega.pedido_id?.slice(0, 8).toUpperCase()}`}
                  </p>
                  <Selo tom={tomStatus(entrega.status)}>{formatarStatus(entrega.status)}</Selo>
                </div>
                {entrega.endereco_entrega && entrega.bairro && (
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{entrega.endereco_entrega}</p>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-muted-foreground">
                  <span className="tabular-nums">{formatarDataHora(entrega.created_at)}</span>
                  {entrega.entregador_nome && (<><span aria-hidden>·</span><span>{entrega.entregador_nome}</span></>)}
                  {entrega.tempo_real && (<><span aria-hidden>·</span><span className="tabular-nums">{entrega.tempo_real} min</span></>)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                R$ {formatarMoeda(entrega.taxa_entrega)}
              </span>
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
        titulo="Filtrar entregas"
        rodape={
          <>
            <Botao
              variante="contorno"
              onClick={() => {
                setFiltroStatus('todos')
                setFiltroBairro('todos')
                setPaginaAtual(1)
              }}
            >
              Limpar
            </Botao>
            <Botao onClick={() => setMostrarFiltros(false)}>Ver {entregasFiltradas.length} entregas</Botao>
          </>
        }
      >
        <div className="space-y-5">
          <Campo rotulo="Situação">
            <Segmentos
              opcoes={[
                { valor: 'todos', rotulo: 'Todas' },
                { valor: 'pendente', rotulo: 'Pendente' },
                { valor: 'em_transito', rotulo: 'Em trânsito' },
                { valor: 'entregue', rotulo: 'Entregue' },
                { valor: 'cancelada', rotulo: 'Cancelada' },
              ]}
              valor={filtroStatus}
              aoMudar={(valor) => {
                setFiltroStatus(valor)
                setPaginaAtual(1)
              }}
              rotuloAcessivel="Situação da entrega"
            />
          </Campo>
          <Campo rotulo="Bairro" htmlFor="entregas-ano-bairro">
            <Selecao
              id="entregas-ano-bairro"
              value={filtroBairro}
              onChange={(e) => {
                setFiltroBairro(e.target.value)
                setPaginaAtual(1)
              }}
            >
              <option value="todos">Todos os bairros</option>
              {bairrosUnicos.map(bairro => (
                <option key={bairro} value={bairro}>{bairro}</option>
              ))}
            </Selecao>
          </Campo>
        </div>
      </Gaveta>
    </div>
  )
}
