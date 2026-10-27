'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ClockCounterClockwise, SlidersHorizontal } from '@phosphor-icons/react'
import { Botao, Chip, Gaveta, Lista, ListaCarregando, ListaVazia, Selecao, Selo } from '@/components/admin/ui'
import { obterIntervaloDiaOperacionalAtual } from '@/lib/dia-operacional'
import type { ProdutoComEstoque } from '@/lib/estoque'
import { cn } from '@/lib/utils'

export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste'

export type Movimentacao = {
  id: string
  item_id: string
  item_tipo: 'produto' | 'bebida'
  item_nome: string
  ocorreu_em: string
  tipo: TipoMovimentacao
  quantidade: number
  saldo_antes: number | null
  saldo_depois: number
  origem: string
  pedido_id: string | null
  pedido_numero: number | null
}

type FiltroPeriodo = 'hoje' | '7d' | '30d' | 'tudo'
type FiltroTipo = 'todos' | TipoMovimentacao

type ParametrosBusca = {
  itemId?: string | null
  tipo?: TipoMovimentacao | null
  inicio?: Date | null
  cursor?: string | null
  limite?: number
}

export async function buscarMovimentacoes({ itemId, tipo, inicio, cursor, limite = 30 }: ParametrosBusca) {
  const parametros = new URLSearchParams({ limite: String(limite) })
  if (itemId) parametros.set('item', itemId)
  if (tipo) parametros.set('tipo', tipo)
  if (inicio) parametros.set('inicio', inicio.toISOString())
  if (cursor) parametros.set('cursor', cursor)

  const headers = new Headers()
  const token = window.localStorage.getItem('adminToken')
  if (token) headers.set('x-admin-token', token)

  const resposta = await fetch(`/api/admin/estoque/movimentacoes?${parametros}`, { headers, cache: 'no-store' })
  const json = (await resposta.json().catch(() => null)) as
    | { sucesso: true; movimentacoes: Movimentacao[]; cursorProximo: string | null }
    | { sucesso: false; erro?: string }
    | null
  if (!resposta.ok || !json || !json.sucesso) {
    throw new Error((json && !json.sucesso && json.erro) || 'Não foi possível carregar as movimentações.')
  }
  return json
}

const ROTULO_TIPO: Record<TipoMovimentacao, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
}

const TOM_TIPO = { entrada: 'sucesso', saida: 'neutro', ajuste: 'alerta' } as const

const ICONE_TIPO = { entrada: ArrowDownLeft, saida: ArrowUpRight, ajuste: SlidersHorizontal }

export const descreverOrigem = (movimentacao: Movimentacao) => {
  const pedido = movimentacao.pedido_numero ? `#${movimentacao.pedido_numero}` : ''
  switch (movimentacao.origem) {
    case 'reserva_pedido':
      return pedido ? `Venda · Pedido ${pedido}` : 'Venda'
    case 'reabertura_pedido':
      return pedido ? `Pedido ${pedido} reaberto` : 'Pedido reaberto'
    case 'cancelamento_pedido':
      return pedido ? `Pedido ${pedido} cancelado` : 'Pedido cancelado'
    case 'restauracao_item_pedido':
      return pedido ? `Item removido do pedido ${pedido}` : 'Item removido do pedido'
    case 'ajuste_estoque':
      return movimentacao.quantidade > 0 ? 'Reposição manual' : 'Ajuste manual'
    default:
      return 'Sistema'
  }
}

const formatarQuantidade = (quantidade: number) => (quantidade > 0 ? `+${quantidade}` : `−${Math.abs(quantidade)}`)

const formatarDataCurta = (valor: string) => new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(valor))

const formatarDataLonga = (valor: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeStyle: 'short',
}).format(new Date(valor))

export const Saldo = ({ valor, className }: { valor: number; className?: string }) => (
  <span className={cn('tabular-nums', valor < 0 && 'text-destructive', className)}>
    {valor < 0 ? `−${Math.abs(valor)}` : valor}
  </span>
)

const inicioDoPeriodo = (periodo: FiltroPeriodo) => {
  if (periodo === 'tudo') return null
  if (periodo === 'hoje') return obterIntervaloDiaOperacionalAtual().inicio
  const dias = periodo === '7d' ? 7 : 30
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
}

type LinhaMovimentacaoProps = {
  movimentacao: Movimentacao
  mostrarProduto?: boolean
  onSelecionar?: () => void
}

/** Linha no padrão do crediário: o que/onde à esquerda, movimento e saldo à direita. */
const LinhaMovimentacao = ({ movimentacao, mostrarProduto = true, onSelecionar }: LinhaMovimentacaoProps) => {
  const Icone = ICONE_TIPO[movimentacao.tipo]
  return (
    <div
      role={onSelecionar ? 'button' : undefined}
      tabIndex={onSelecionar ? 0 : undefined}
      onClick={onSelecionar}
      onKeyDown={(evento) => {
        if (onSelecionar && (evento.key === 'Enter' || evento.key === ' ')) {
          evento.preventDefault()
          onSelecionar()
        }
      }}
      className={cn(
        'flex min-h-16 items-center gap-3 px-4 py-3',
        onSelecionar &&
          'cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground',
          movimentacao.tipo === 'entrada' && 'text-emerald-600 dark:text-emerald-400',
          movimentacao.tipo === 'ajuste' && 'text-amber-600 dark:text-amber-400',
        )}
        aria-hidden
      >
        <Icone className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">
          {mostrarProduto ? movimentacao.item_nome : descreverOrigem(movimentacao)}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {mostrarProduto ? `${descreverOrigem(movimentacao)} · ` : ''}
          {formatarDataCurta(movimentacao.ocorreu_em)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p
          className={cn(
            'font-semibold tabular-nums',
            movimentacao.quantidade > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
          )}
        >
          {formatarQuantidade(movimentacao.quantidade)}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          saldo <Saldo valor={movimentacao.saldo_depois} />
        </p>
      </div>
    </div>
  )
}

export const ListaCompactaMovimentacoes = ({
  movimentacoes,
  mostrarProduto = true,
  onSelecionar,
}: {
  movimentacoes: Movimentacao[]
  mostrarProduto?: boolean
  onSelecionar?: (movimentacao: Movimentacao) => void
}) => (
  <Lista>
    {movimentacoes.map((movimentacao) => (
      <li key={movimentacao.id}>
        <LinhaMovimentacao
          movimentacao={movimentacao}
          mostrarProduto={mostrarProduto}
          onSelecionar={onSelecionar ? () => onSelecionar(movimentacao) : undefined}
        />
      </li>
    ))}
  </Lista>
)

const DetalheMovimentacao = ({
  movimentacao,
  onFechar,
}: {
  movimentacao: Movimentacao | null
  onFechar: () => void
}) => (
  <Gaveta
    aberto={Boolean(movimentacao)}
    aoFechar={onFechar}
    titulo={movimentacao?.item_nome ?? 'Movimentação'}
    descricao={
      movimentacao ? (
        <span className="flex flex-wrap items-center gap-2">
          <Selo tom={TOM_TIPO[movimentacao.tipo]}>{ROTULO_TIPO[movimentacao.tipo]}</Selo>
          <span>{formatarDataLonga(movimentacao.ocorreu_em)}</span>
        </span>
      ) : undefined
    }
  >
    {movimentacao ? (
      <dl className="divide-y divide-border/70 rounded-xl border border-border/70">
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="text-sm text-muted-foreground">Origem</dt>
          <dd className="text-right font-medium">{descreverOrigem(movimentacao)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="text-sm text-muted-foreground">Saldo antes</dt>
          <dd className="font-medium">
            {movimentacao.saldo_antes === null ? '—' : <Saldo valor={movimentacao.saldo_antes} />}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="text-sm text-muted-foreground">Movimento</dt>
          <dd className="font-semibold tabular-nums">{formatarQuantidade(movimentacao.quantidade)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 px-4 py-3">
          <dt className="text-sm text-muted-foreground">Saldo depois</dt>
          <dd className="text-lg font-semibold"><Saldo valor={movimentacao.saldo_depois} /></dd>
        </div>
      </dl>
    ) : null}
  </Gaveta>
)

type MovimentacoesEstoqueProps = {
  itens: ProdutoComEstoque[]
  produtoId: string | null
  onProdutoChange: (produtoId: string | null) => void
}

export const MovimentacoesEstoque = ({ itens, produtoId, onProdutoChange }: MovimentacoesEstoqueProps) => {
  const [periodo, setPeriodo] = useState<FiltroPeriodo>('7d')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [selecionada, setSelecionada] = useState<Movimentacao | null>(null)
  const requisicaoRef = useRef(0)

  const filtros = useMemo(() => ({
    itemId: produtoId,
    tipo: tipo === 'todos' ? null : tipo,
    inicio: inicioDoPeriodo(periodo),
  }), [periodo, produtoId, tipo])

  const carregar = useCallback(async () => {
    const requisicao = ++requisicaoRef.current
    setCarregando(true)
    setErro(null)
    try {
      const resultado = await buscarMovimentacoes(filtros)
      if (requisicao !== requisicaoRef.current) return
      setMovimentacoes(resultado.movimentacoes)
      setCursor(resultado.cursorProximo)
    } catch (falha) {
      if (requisicao !== requisicaoRef.current) return
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar as movimentações.')
    } finally {
      if (requisicao === requisicaoRef.current) setCarregando(false)
    }
  }, [filtros])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const carregarMais = async () => {
    if (!cursor || carregandoMais) return
    const requisicao = requisicaoRef.current
    setCarregandoMais(true)
    try {
      const resultado = await buscarMovimentacoes({ ...filtros, cursor })
      if (requisicao !== requisicaoRef.current) return
      setMovimentacoes((atual) => [...atual, ...resultado.movimentacoes])
      setCursor(resultado.cursorProximo)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar as movimentações.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const temFiltro = Boolean(produtoId) || tipo !== 'todos' || periodo !== '7d'
  const limparFiltros = () => {
    onProdutoChange(null)
    setTipo('todos')
    setPeriodo('7d')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0" role="group" aria-label="Período">
          {([['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['tudo', 'Tudo']] as const).map(([valor, rotulo]) => (
            <Chip key={valor} ativo={periodo === valor} onClick={() => setPeriodo(valor)} className="h-11 md:h-9">
              {rotulo}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 md:flex">
          <Selecao
            value={produtoId ?? ''}
            onChange={(evento) => onProdutoChange(evento.target.value || null)}
            aria-label="Produto"
            className="md:w-56"
          >
            <option value="">Todos os produtos</option>
            {itens.map((item) => (
              <option key={`${item.tabela}-${item.id}`} value={item.id}>
                {item.nome}
              </option>
            ))}
          </Selecao>
          <Selecao
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as FiltroTipo)}
            aria-label="Tipo de movimentação"
            className="md:w-40"
          >
            <option value="todos">Todos os tipos</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
            <option value="ajuste">Ajustes</option>
          </Selecao>
        </div>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground">
          {carregando ? 'Carregando…' : `${movimentacoes.length}${cursor ? '+' : ''} movimentações`}
        </p>
        {temFiltro ? (
          <Botao variante="fantasma" tamanho="sm" onClick={limparFiltros}>
            Limpar filtros
          </Botao>
        ) : null}
      </div>

      {erro ? (
        <ListaVazia
          icone={<ClockCounterClockwise />}
          titulo="Não foi possível carregar"
          descricao={erro}
          acao={<Botao variante="contorno" onClick={() => void carregar()}>Tentar de novo</Botao>}
        />
      ) : carregando ? (
        <ListaCarregando linhas={6} />
      ) : movimentacoes.length === 0 ? (
        <ListaVazia
          icone={<ClockCounterClockwise />}
          titulo="Nenhuma movimentação"
          descricao={
            temFiltro
              ? 'Nada com esses filtros. Tente outro período ou produto.'
              : 'Vendas, reposições e ajustes aparecem aqui assim que acontecem.'
          }
          acao={temFiltro ? <Botao variante="contorno" onClick={limparFiltros}>Limpar filtros</Botao> : undefined}
        />
      ) : (
        <>
          <ListaCompactaMovimentacoes movimentacoes={movimentacoes} onSelecionar={setSelecionada} />
          {cursor ? (
            <div className="flex justify-center">
              <Botao variante="contorno" onClick={() => void carregarMais()} carregando={carregandoMais}>
                Carregar mais
              </Botao>
            </div>
          ) : null}
        </>
      )}

      <DetalheMovimentacao movimentacao={selecionada} onFechar={() => setSelecionada(null)} />
    </div>
  )
}
