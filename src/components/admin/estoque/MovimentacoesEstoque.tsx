'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Check, CaretUpDown as ChevronsUpDown, ClockCounterClockwise as History, ArrowsClockwise as RefreshCw, SlidersHorizontal } from '@phosphor-icons/react'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
  <span className={cn('font-mono tabular-nums', valor < 0 && 'font-semibold text-destructive', className)}>
    {valor < 0 ? `−${Math.abs(valor)}` : valor}
  </span>
)

export const TipoMovimentacaoRotulo = ({ tipo }: { tipo: TipoMovimentacao }) => {
  const Icone = tipo === 'entrada' ? ArrowDownLeft : tipo === 'saida' ? ArrowUpRight : SlidersHorizontal
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        tipo === 'entrada' && 'text-emerald-700 dark:text-emerald-400',
        tipo === 'saida' && 'text-foreground',
        tipo === 'ajuste' && 'text-amber-700 dark:text-amber-400',
      )}
    >
      <Icone className="h-3.5 w-3.5" aria-hidden />
      {ROTULO_TIPO[tipo]}
    </span>
  )
}

const inicioDoPeriodo = (periodo: FiltroPeriodo) => {
  if (periodo === 'tudo') return null
  if (periodo === 'hoje') return obterIntervaloDiaOperacionalAtual().inicio
  const dias = periodo === '7d' ? 7 : 30
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
}

type ListaCompactaProps = {
  movimentacoes: Movimentacao[]
  mostrarProduto?: boolean
  onSelecionar?: (movimentacao: Movimentacao) => void
}

export const ListaCompactaMovimentacoes = ({ movimentacoes, mostrarProduto = true, onSelecionar }: ListaCompactaProps) => (
  <ul className="divide-y divide-border/60">
    {movimentacoes.map((movimentacao) => {
      const conteudo = (
        <>
          <div className="min-w-0 flex-1">
            {mostrarProduto ? <p className="truncate text-sm font-medium">{movimentacao.item_nome}</p> : null}
            <p className={cn('truncate text-xs text-muted-foreground', !mostrarProduto && 'text-sm text-foreground')}>
              {descreverOrigem(movimentacao)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatarDataCurta(movimentacao.ocorreu_em)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'font-mono text-sm font-semibold tabular-nums',
                movimentacao.quantidade > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
              )}
            >
              {formatarQuantidade(movimentacao.quantidade)}
            </p>
            <p className="text-xs text-muted-foreground">
              saldo <Saldo valor={movimentacao.saldo_depois} />
            </p>
          </div>
        </>
      )
      return (
        <li key={movimentacao.id}>
          {onSelecionar ? (
            <button
              type="button"
              onClick={() => onSelecionar(movimentacao)}
              className="flex min-h-14 w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {conteudo}
            </button>
          ) : (
            <div className="flex items-center gap-3 py-3">{conteudo}</div>
          )}
        </li>
      )
    })}
  </ul>
)

const DetalheMovimentacao = ({
  movimentacao,
  onFechar,
}: {
  movimentacao: Movimentacao | null
  onFechar: () => void
}) => (
  <ModalSheet
    open={Boolean(movimentacao)}
    onOpenChange={(aberto) => {
      if (!aberto) onFechar()
    }}
    title="Detalhes da movimentação"
  >
    {movimentacao ? (
      <div className="space-y-5 p-5">
        <div>
          <TipoMovimentacaoRotulo tipo={movimentacao.tipo} />
          <h2 className="mt-1 text-base font-semibold">{movimentacao.item_nome}</h2>
          <p className="text-sm text-muted-foreground">{formatarDataLonga(movimentacao.ocorreu_em)}</p>
        </div>
        <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border/70 p-3 text-center">
          <div>
            <dt className="text-xs text-muted-foreground">Antes</dt>
            <dd className="mt-1 text-lg">
              {movimentacao.saldo_antes === null ? '—' : <Saldo valor={movimentacao.saldo_antes} />}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Movimento</dt>
            <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatarQuantidade(movimentacao.quantidade)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Depois</dt>
            <dd className="mt-1 text-lg"><Saldo valor={movimentacao.saldo_depois} /></dd>
          </div>
        </dl>
        <div>
          <p className="text-xs text-muted-foreground">Origem</p>
          <p className="text-sm font-medium">{descreverOrigem(movimentacao)}</p>
        </div>
      </div>
    ) : null}
  </ModalSheet>
)

type SeletorProdutoProps = {
  itens: ProdutoComEstoque[]
  valor: string | null
  onChange: (valor: string | null) => void
}

const SeletorProduto = ({ itens, valor, onChange }: SeletorProdutoProps) => {
  const [aberto, setAberto] = useState(false)
  const selecionado = itens.find((item) => item.id === valor)
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className="h-10 w-full justify-between font-normal shadow-none sm:w-64"
        >
          <span className={cn('truncate', !selecionado && 'text-muted-foreground')}>
            {selecionado ? selecionado.nome : 'Todos os produtos'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar produto" />
          <CommandList>
            <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="todos os produtos"
                onSelect={() => {
                  onChange(null)
                  setAberto(false)
                }}
              >
                <Check className={cn('mr-2 h-4 w-4', valor ? 'opacity-0' : 'opacity-100')} aria-hidden />
                Todos os produtos
              </CommandItem>
              {itens.map((item) => (
                <CommandItem
                  key={`${item.tabela}-${item.id}`}
                  value={`${item.nome} ${item.id}`}
                  onSelect={() => {
                    onChange(item.id)
                    setAberto(false)
                  }}
                >
                  <Check className={cn('mr-2 h-4 w-4', valor === item.id ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  <span className="flex-1 truncate">{item.nome}</span>
                  <Saldo valor={item.estoque_quantidade} className="ml-2 text-xs text-muted-foreground" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

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

  const filtrado = Boolean(produtoId) || tipo !== 'todos' || periodo !== 'tudo'

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SeletorProduto itens={itens} valor={produtoId} onChange={onProdutoChange} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full overflow-x-auto sm:w-auto">
            <ToggleGroup
              type="single"
              value={periodo}
              onValueChange={(valor) => {
                if (valor) setPeriodo(valor as FiltroPeriodo)
              }}
              aria-label="Período"
              className="flex w-max items-center justify-start gap-1.5"
            >
              <ToggleGroupItem value="hoje" className={CHIP_FILTRO_DEFAULT}>Hoje</ToggleGroupItem>
              <ToggleGroupItem value="7d" className={CHIP_FILTRO_DEFAULT}>7 dias</ToggleGroupItem>
              <ToggleGroupItem value="30d" className={CHIP_FILTRO_DEFAULT}>30 dias</ToggleGroupItem>
              <ToggleGroupItem value="tudo" className={CHIP_FILTRO_DEFAULT}>Tudo</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <div className="w-full overflow-x-auto sm:w-auto">
            <ToggleGroup
              type="single"
              value={tipo}
              onValueChange={(valor) => {
                if (valor) setTipo(valor as FiltroTipo)
              }}
              aria-label="Tipo de movimentação"
              className="flex w-max items-center justify-start gap-1.5"
            >
              <ToggleGroupItem value="todos" className={CHIP_FILTRO_DEFAULT}>Todos</ToggleGroupItem>
              <ToggleGroupItem value="entrada" className={CHIP_FILTRO_DEFAULT}>Entradas</ToggleGroupItem>
              <ToggleGroupItem value="saida" className={CHIP_FILTRO_DEFAULT}>Saídas</ToggleGroupItem>
              <ToggleGroupItem value="ajuste" className={CHIP_FILTRO_DEFAULT}>Ajustes</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </div>

      {erro ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-destructive">{erro}</p>
          <Button type="button" variant="outline" className="h-10 shadow-none" onClick={() => void carregar()}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
            Tentar novamente
          </Button>
        </div>
      ) : carregando ? (
        <TabelaSkeleton linhas={8} />
      ) : movimentacoes.length === 0 ? (
        <ListaVazia
          icone={<History className="h-5 w-5" />}
          titulo="Nenhuma movimentação"
          descricao={
            filtrado
              ? 'Nada encontrado com esses filtros. Tente outro período ou produto.'
              : 'As vendas, reposições e ajustes aparecem aqui assim que acontecem.'
          }
          acao={
            filtrado ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 shadow-none"
                onClick={() => {
                  onProdutoChange(null)
                  setTipo('todos')
                  setPeriodo('tudo')
                }}
              >
                Ver tudo
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="md:hidden">
            <ListaCompactaMovimentacoes movimentacoes={movimentacoes} onSelecionar={setSelecionada} />
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-36">Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-28">Tipo</TableHead>
                  <TableHead className="w-24 text-right">Qtd.</TableHead>
                  <TableHead className="w-24 text-right">Saldo</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.map((movimentacao) => (
                  <TableRow key={movimentacao.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatarDataCurta(movimentacao.ocorreu_em)}
                    </TableCell>
                    <TableCell className="max-w-[16rem] truncate font-medium">{movimentacao.item_nome}</TableCell>
                    <TableCell><TipoMovimentacaoRotulo tipo={movimentacao.tipo} /></TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular-nums',
                        movimentacao.quantidade > 0 && 'text-emerald-700 dark:text-emerald-400',
                      )}
                    >
                      {formatarQuantidade(movimentacao.quantidade)}
                    </TableCell>
                    <TableCell className="text-right"><Saldo valor={movimentacao.saldo_depois} /></TableCell>
                    <TableCell className="text-muted-foreground">{descreverOrigem(movimentacao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {cursor ? (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="ghost"
                className="h-10"
                onClick={() => void carregarMais()}
                disabled={carregandoMais}
              >
                {carregandoMais ? 'Carregando…' : 'Carregar mais'}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <DetalheMovimentacao movimentacao={selecionada} onFechar={() => setSelecionada(null)} />
    </div>
  )
}
