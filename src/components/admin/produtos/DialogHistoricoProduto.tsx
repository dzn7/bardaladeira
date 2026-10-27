'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Pulse as Activity, ArrowDown, ChartBar as BarChart3, CalendarDots as CalendarDays, Eye, EyeSlash as EyeOff, ClockCounterClockwise as History, Package as PackageCheck, BoxArrowUp as PackageMinus, BoxArrowDown as PackagePlus, Tag, TrendDown as TrendingDown, TrendUp as TrendingUp } from '@phosphor-icons/react'
import { type Icon } from '@phosphor-icons/react'
import { CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip as ChartTooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Botao, Chip, Entrada, Esqueleto, Gaveta, Segmentos, Selo } from '@/components/admin/ui'
import { supabase } from '@/lib/supabase'

ChartJS.register(CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, ChartTooltip)

type ProdutoParaHistorico = {
  id: string
  nome: string
  categoria: string
  preco: number
  preco_original?: number | null
  desconto?: number | null
  imagem_url?: string
  disponivel: boolean
  estoque_quantidade?: number
  estoque_minimo?: number
  bloquear_venda_sem_estoque?: boolean
}

type CategoriaTimeline = 'tudo' | 'alteracao' | 'estoque' | 'promocao' | 'visibilidade' | 'comercial'
type Periodo = '7d' | '30d' | '90d' | 'mes' | 'personalizado'

type EventoHistorico = {
  id: string
  tipo: string
  categoria: CategoriaTimeline
  ocorreu_em: string
  actor_type: string
  actor_name_snapshot: string
  origem: string
  referencia_origem: string | null
  pedido_id: string | null
  pedido_numero: number | null
  promocao_id: string | null
  antes: Record<string, unknown>
  depois: Record<string, unknown>
  metadados: Record<string, unknown>
}

type PromocaoHistorica = {
  id: string
  iniciada_em: string
  encerrada_em: string | null
  preco_normal: number | string
  preco_promocional: number | string
  desconto_percentual: number | string
  pedidos: number | string
  unidades: number | string
  faturamento: number | string
  desconto_concedido: number | string
}

type PontoPreco = {
  ocorreu_em: string
  preco: number | string | null
  preco_original: number | string | null
  tipo: string
}

type InteligenciaProduto = {
  unidades_vendidas?: number | string
  pedidos?: number | string
  faturamento?: number | string
  ticket_medio_produto?: number | string
  preco_medio_realizado?: number | string
  desconto_promocional?: number | string
  entradas_estoque?: number | string
  saidas_estoque?: number | string
  ajustes_manuais?: number | string
  unidades_reservadas?: number | string
  unidades_restauradas?: number | string
  vezes_esgotado?: number | string
  segundos_esgotado?: number | string
  vezes_oculto?: number | string
  segundos_oculto?: number | string
  ultima_alteracao_em?: string | null
  ultima_venda_em?: string | null
  precos?: PontoPreco[]
  promocoes?: PromocaoHistorica[]
}

type CursorHistorico = {
  ocorreuEm: string
  id: string
}

type PaginaHistorico = {
  eventos: EventoHistorico[]
  cursorProximo: CursorHistorico | null
}

type Props = {
  aberto: boolean
  onAbertoChange: (aberto: boolean) => void
  produto: ProdutoParaHistorico | null
}

const formatarDinheiro = (valor: unknown) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(valor || 0))

const numero = (valor: unknown) => {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : 0
}

const formatarDataHora = (valor: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(valor))

const formatarTempo = (segundos: unknown) => {
  const total = Math.max(0, Math.round(numero(segundos)))
  const dias = Math.floor(total / 86400)
  const horas = Math.floor((total % 86400) / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const partes = [dias ? `${dias}d` : '', horas ? `${horas}h` : '', minutos ? `${minutos}min` : ''].filter(Boolean)
  return partes.join(' ') || '0min'
}

const rotuloData = (valor: string) => {
  const data = new Date(valor)
  const hoje = new Date()
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()
  const inicioData = new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime()
  const diferenca = Math.round((inicioHoje - inicioData) / 86400000)
  if (diferenca === 0) return 'Hoje'
  if (diferenca === 1) return 'Ontem'
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' }).format(data)
}

const tituloEvento: Record<string, string> = {
  produto_criado: 'Produto criado',
  produto_atualizado: 'Produto atualizado',
  preco_alterado: 'Preço alterado',
  promocao_iniciada: 'Promoção iniciada',
  promocao_alterada: 'Promoção alterada',
  promocao_encerrada: 'Promoção encerrada',
  produto_ocultado: 'Produto ocultado',
  produto_publicado: 'Produto publicado novamente',
  estoque_ajustado: 'Estoque ajustado',
  estoque_esgotado: 'Produto esgotado',
  estoque_recuperado: 'Estoque recuperado',
  estoque_reservado_pedido: 'Venda registrada',
  estoque_restaurado_pedido: 'Estoque restaurado',
  estoque_minimo_alterado: 'Estoque mínimo alterado',
  controle_estoque_alterado: 'Controle de estoque alterado',
}

const iconeEvento = (tipo: string): Icon => {
  if (tipo.startsWith('promocao')) return Tag
  if (tipo.includes('ocultado')) return EyeOff
  if (tipo.includes('publicado')) return Eye
  if (tipo.includes('reservado')) return TrendingDown
  if (tipo.includes('restaurado') || tipo.includes('recuperado')) return TrendingUp
  if (tipo.includes('esgotado')) return PackageMinus
  if (tipo.includes('estoque')) return PackagePlus
  if (tipo.includes('preco')) return Activity
  return History
}

const nomeCampo: Record<string, string> = {
  nome: 'Nome',
  descricao: 'Descrição',
  categoria: 'Categoria',
  imagem_url: 'Imagem',
  preco: 'Preço',
  preco_original: 'Preço normal',
  desconto: 'Desconto',
  disponivel: 'Visível no cardápio',
  custo_unitario: 'Custo unitário',
  estoque_quantidade: 'Estoque',
  estoque_minimo: 'Estoque mínimo',
  bloquear_venda_sem_estoque: 'Bloquear venda sem estoque',
}

const valorCampo = (campo: string, valor: unknown) => {
  if (valor === null || valor === undefined || valor === '') return 'Não definido'
  if (['preco', 'preco_original', 'custo_unitario'].includes(campo)) return formatarDinheiro(valor)
  if (campo === 'desconto') return `${numero(valor)}%`
  if (['disponivel', 'bloquear_venda_sem_estoque'].includes(campo)) return valor === true ? 'Sim' : 'Não'
  return String(valor)
}

const alteracoesDoEvento = (evento: EventoHistorico) => Array.from(new Set([
  ...Object.keys(evento.antes || {}),
  ...Object.keys(evento.depois || {}),
])).filter((campo) => JSON.stringify(evento.antes?.[campo]) !== JSON.stringify(evento.depois?.[campo]))

const periodoInicial = (periodo: Periodo) => {
  const fim = new Date()
  const inicio = new Date(fim)
  if (periodo === '7d') inicio.setUTCDate(inicio.getUTCDate() - 7)
  if (periodo === '30d') inicio.setUTCDate(inicio.getUTCDate() - 30)
  if (periodo === '90d') inicio.setUTCDate(inicio.getUTCDate() - 90)
  if (periodo === 'mes') inicio.setUTCDate(1)
  return { inicio, fim }
}

const LIMITE_PAGINA = 25

const buscarHistoricoProduto = async (
  produtoId: string,
  categoria: CategoriaTimeline,
  cursor?: CursorHistorico | null,
): Promise<PaginaHistorico> => {
  const { data, error } = await supabase.rpc('listar_historico_produto', {
    p_produto_id: produtoId,
    p_categoria: categoria,
    p_ocorreu_antes: cursor?.ocorreuEm || null,
    p_id_antes: cursor?.id || null,
    p_limite: LIMITE_PAGINA + 1,
  })
  if (error) throw new Error('Não foi possível carregar o histórico do produto.')

  const linhas = (Array.isArray(data) ? data : []) as EventoHistorico[]
  const possuiProximaPagina = linhas.length > LIMITE_PAGINA
  const eventos = possuiProximaPagina ? linhas.slice(0, LIMITE_PAGINA) : linhas
  const ultimoEvento = eventos.at(-1)

  return {
    eventos,
    cursorProximo: possuiProximaPagina && ultimoEvento
      ? { ocorreuEm: ultimoEvento.ocorreu_em, id: ultimoEvento.id }
      : null,
  }
}

const buscarInteligenciaProduto = async (produtoId: string, inicio: Date, fim: Date) => {
  const { data, error } = await supabase.rpc('obter_inteligencia_produto', {
    p_produto_id: produtoId,
    p_inicio: inicio.toISOString(),
    p_fim: fim.toISOString(),
  })
  if (error) throw new Error('Não foi possível carregar o desempenho do produto.')
  return (data || {}) as InteligenciaProduto
}

function ConteudoTimeline({
  carregando,
  erro,
  eventos,
  cursorProximo,
  aoCarregarMais,
  carregandoMais,
}: {
  carregando: boolean
  erro: string | null
  eventos: EventoHistorico[]
  cursorProximo: CursorHistorico | null
  aoCarregarMais: () => void
  carregandoMais: boolean
}) {
  const grupos = useMemo(() => eventos.reduce<Record<string, EventoHistorico[]>>((acumulado, evento) => {
    const chave = rotuloData(evento.ocorreu_em)
    acumulado[chave] = [...(acumulado[chave] || []), evento]
    return acumulado
  }, {}), [eventos])

  if (carregando) {
    return <div className="space-y-4"><Esqueleto className="h-24 w-full rounded-xl" /><Esqueleto className="h-24 w-full rounded-xl" /><Esqueleto className="h-24 w-full rounded-xl" /></div>
  }
  if (erro) return <p className="text-sm text-destructive" role="alert">{erro}</p>
  if (eventos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
        Nada registrado nesta seleção. O histórico começa em 22/08/2026.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {Object.entries(grupos).map(([data, eventosDoDia]) => (
        <section key={data}>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{data}</h3>
          <ol className="space-y-3 border-l border-border/80 pl-4">
            {eventosDoDia.map((evento) => {
              const Icone = iconeEvento(evento.tipo)
              const alteracoes = alteracoesDoEvento(evento)
              const delta = numero(evento.metadados?.delta_estoque)
              return (
                <li key={evento.id} className="relative rounded-xl border border-border/70 bg-card p-3">
                  <span className="absolute -left-[1.65rem] top-4 flex size-5 items-center justify-center rounded-full border border-border bg-background">
                    <Icone className="size-3 text-primary" aria-hidden="true" />
                  </span>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{tituloEvento[evento.tipo] || 'Atualização do produto'}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatarDataHora(evento.ocorreu_em)} · {evento.actor_name_snapshot || 'Sistema'}
                      </p>
                    </div>
                    {evento.categoria === 'estoque' && delta !== 0 ? (
                      <Selo tom={delta > 0 ? 'sucesso' : 'neutro'} className="shrink-0 tabular-nums">
                        {delta > 0 ? '+' : ''}{delta} un.
                      </Selo>
                    ) : null}
                  </div>
                  {evento.pedido_id ? (
                    <Link href={`/admin/pedidos?pedido=${evento.pedido_id}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline md:min-h-0 md:pt-1">
                      Pedido #{evento.pedido_numero || evento.pedido_id.slice(0, 8)}
                    </Link>
                  ) : null}
                  {alteracoes.length > 0 ? (
                    <dl className="mt-3 space-y-1.5 border-t border-border/60 pt-2.5 text-xs">
                      {alteracoes.map((campo) => (
                        <div key={campo} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
                          <dt className="truncate text-muted-foreground">{nomeCampo[campo] || campo}</dt>
                          <ArrowDown className="size-3 rotate-[-90deg] text-muted-foreground" aria-hidden="true" />
                          <dd className="truncate text-right font-medium">{valorCampo(campo, evento.depois?.[campo])}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      {cursorProximo ? (
        <Botao variante="contorno" className="h-11 w-full" onClick={aoCarregarMais} carregando={carregandoMais}>
          Carregar mais
        </Botao>
      ) : null}
    </div>
  )
}

function ConteudoInteligencia({ carregando, erro, inteligencia, periodo }: {
  carregando: boolean
  erro: string | null
  inteligencia: InteligenciaProduto | null
  periodo: string
}) {
  if (carregando) {
    return <div className="space-y-3"><Esqueleto className="rounded-xl h-28 w-full" /><Esqueleto className="rounded-xl h-40 w-full" /><Esqueleto className="rounded-xl h-24 w-full" /></div>
  }
  if (erro) return <p className="text-sm text-destructive" role="alert">{erro}</p>
  const dados = inteligencia || {}
  const precos = dados.precos || []
  const dadosGrafico = {
    labels: precos.map((ponto) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(ponto.ocorreu_em))),
    datasets: [{
      label: 'Preço praticado',
      data: precos.map((ponto) => numero(ponto.preco)),
      borderColor: 'hsl(var(--primary))',
      backgroundColor: 'hsl(var(--primary) / 0.12)',
      fill: true,
      tension: 0.25,
      pointRadius: 3,
    }],
  }
  const opcoesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { ticks: { callback: (valor: string | number) => formatarDinheiro(valor) } } },
  }
  const metricas = [
    ['Unidades vendidas', numero(dados.unidades_vendidas).toLocaleString('pt-BR')],
    ['Pedidos', numero(dados.pedidos).toLocaleString('pt-BR')],
    ['Faturamento', formatarDinheiro(dados.faturamento)],
    ['Preço médio realizado', formatarDinheiro(dados.preco_medio_realizado)],
    ['Ticket médio do produto', formatarDinheiro(dados.ticket_medio_produto)],
    ['Desconto concedido', formatarDinheiro(dados.desconto_promocional)],
  ]

  return (
    <div className="space-y-4">
      <section>
        <p className="mb-2 text-sm font-medium text-muted-foreground">{periodo}</p>
        <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border/70">
          {metricas.map(([rotulo, valor]) => <div key={rotulo} className="border-b border-r border-border/70 p-3 odd:border-r-0 sm:odd:border-r">
            <dt className="text-[11px] text-muted-foreground">{rotulo}</dt><dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{valor}</dd>
          </div>)}
        </dl>
      </section>
      <section className="rounded-xl border border-border/70 p-3">
        <div className="mb-3 flex items-center gap-2"><BarChart3 className="size-4 text-primary" /><h3 className="text-sm font-semibold">Evolução de preço</h3></div>
        {precos.length > 0 ? <div className="h-44"><Line data={dadosGrafico} options={opcoesGrafico} /></div> : <p className="text-sm text-muted-foreground">As alterações de preço aparecerão aqui a partir do primeiro evento auditado.</p>}
      </section>
      <section className="rounded-xl border border-border/70 p-3">
        <div className="mb-3 flex items-center gap-2"><PackageCheck className="size-4 text-primary" /><h3 className="text-sm font-semibold">Estoque no período</h3></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">Entradas</dt><dd className="font-mono font-semibold">+{numero(dados.entradas_estoque)} un.</dd></div>
          <div><dt className="text-xs text-muted-foreground">Saídas</dt><dd className="font-mono font-semibold">-{numero(dados.saidas_estoque)} un.</dd></div>
          <div><dt className="text-xs text-muted-foreground">Esgotou</dt><dd className="font-semibold">{numero(dados.vezes_esgotado)} vez(es)</dd></div>
          <div><dt className="text-xs text-muted-foreground">Tempo esgotado</dt><dd className="font-semibold">{formatarTempo(dados.segundos_esgotado)}</dd></div>
        </dl>
      </section>
      <section>
        <div className="mb-2 flex items-center gap-2"><Tag className="size-4 text-primary" /><h3 className="text-sm font-semibold">Promoções</h3></div>
        {(dados.promocoes || []).length > 0 ? <div className="space-y-2">{dados.promocoes?.map((promocao) => <article key={promocao.id} className="rounded-xl border border-border/70 p-3 text-sm">
          <div className="flex items-start justify-between gap-2"><p className="font-semibold">{new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(promocao.iniciada_em))} — {promocao.encerrada_em ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(promocao.encerrada_em)) : 'ativa'}</p><Selo tom="alerta" className="shrink-0">-{numero(promocao.desconto_percentual).toFixed(0)}%</Selo></div>
          <p className="mt-1 text-muted-foreground">De {formatarDinheiro(promocao.preco_normal)} por {formatarDinheiro(promocao.preco_promocional)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{numero(promocao.pedidos)} pedidos · {numero(promocao.unidades)} unidades · {formatarDinheiro(promocao.faturamento)} faturados</p>
        </article>)}</div> : <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">Nenhuma promoção auditada neste período.</p>}
      </section>
    </div>
  )
}

export function DialogHistoricoProduto({ aberto, onAbertoChange, produto }: Props) {
  const [categoria, setCategoria] = useState<CategoriaTimeline>('tudo')
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [inicioPersonalizado, setInicioPersonalizado] = useState('')
  const [fimPersonalizado, setFimPersonalizado] = useState('')
  const [eventos, setEventos] = useState<EventoHistorico[]>([])
  const [cursorProximo, setCursorProximo] = useState<CursorHistorico | null>(null)
  const [inteligencia, setInteligencia] = useState<InteligenciaProduto | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [carregandoInteligencia, setCarregandoInteligencia] = useState(false)
  const [erroTimeline, setErroTimeline] = useState<string | null>(null)
  const [erroInteligencia, setErroInteligencia] = useState<string | null>(null)
  const categoriaCarregada = useRef<CategoriaTimeline | null>(null)
  const periodoCarregado = useRef<string | null>(null)

  const intervalo = useMemo(() => {
    if (periodo !== 'personalizado') return periodoInicial(periodo)
    const agora = new Date()
    const inicio = inicioPersonalizado ? new Date(`${inicioPersonalizado}T00:00:00`) : periodoInicial('30d').inicio
    const fim = fimPersonalizado ? new Date(`${fimPersonalizado}T23:59:59`) : agora
    return { inicio, fim }
  }, [fimPersonalizado, inicioPersonalizado, periodo])

  const chavePeriodo = `${intervalo.inicio.toISOString()}:${intervalo.fim.toISOString()}`

  const lerHistorico = useCallback(async (cursor?: CursorHistorico | null) => {
    if (!produto) return { eventos: [], cursorProximo: null }
    return buscarHistoricoProduto(produto.id, categoria, cursor)
  }, [categoria, produto])

  const lerInteligencia = useCallback(async () => {
    if (!produto) return {}
    return buscarInteligenciaProduto(produto.id, intervalo.inicio, intervalo.fim)
  }, [intervalo.fim, intervalo.inicio, produto])

  useEffect(() => {
    if (!aberto || !produto) {
      categoriaCarregada.current = null
      periodoCarregado.current = null
      return
    }
    let ativo = true
    categoriaCarregada.current = categoria
    periodoCarregado.current = chavePeriodo
    setCarregando(true)
    setCarregandoInteligencia(true)
    setErroTimeline(null)
    setErroInteligencia(null)
    void Promise.all([lerHistorico(), lerInteligencia()]).then(([historico, dados]) => {
      if (!ativo) return
      setEventos(historico.eventos || [])
      setCursorProximo(historico.cursorProximo || null)
      setInteligencia(dados || {})
    }).catch((erro: unknown) => {
      if (!ativo) return
      const mensagem = erro instanceof Error ? erro.message : 'Não foi possível carregar os dados do produto.'
      setErroTimeline(mensagem)
      setErroInteligencia(mensagem)
    }).finally(() => {
      if (!ativo) return
      setCarregando(false)
      setCarregandoInteligencia(false)
    })
    return () => { ativo = false }
  // A abertura carrega Timeline e Inteligência juntas; os filtros seguintes são independentes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, produto?.id])

  useEffect(() => {
    if (!aberto || !produto || categoriaCarregada.current === categoria) return
    let ativo = true
    categoriaCarregada.current = categoria
    setCarregando(true)
    setErroTimeline(null)
    void lerHistorico().then((historico) => {
      if (!ativo) return
      setEventos(historico.eventos || [])
      setCursorProximo(historico.cursorProximo || null)
    }).catch((erro: unknown) => {
      if (ativo) setErroTimeline(erro instanceof Error ? erro.message : 'Não foi possível carregar o histórico.')
    }).finally(() => {
      if (ativo) setCarregando(false)
    })
    return () => { ativo = false }
  }, [aberto, categoria, lerHistorico, produto])

  useEffect(() => {
    if (!aberto || !produto || periodoCarregado.current === chavePeriodo) return
    let ativo = true
    periodoCarregado.current = chavePeriodo
    setCarregandoInteligencia(true)
    setErroInteligencia(null)
    void lerInteligencia().then((dados) => {
      if (ativo) setInteligencia(dados || {})
    }).catch((erro: unknown) => {
      if (ativo) setErroInteligencia(erro instanceof Error ? erro.message : 'Não foi possível carregar os relatórios.')
    }).finally(() => {
      if (ativo) setCarregandoInteligencia(false)
    })
    return () => { ativo = false }
  }, [aberto, chavePeriodo, lerInteligencia, produto])

  const carregarMais = async () => {
    if (!cursorProximo) return
    setCarregandoMais(true)
    try {
      const proximaPagina = await lerHistorico(cursorProximo)
      setEventos((atuais) => [...atuais, ...(proximaPagina.eventos || [])])
      setCursorProximo(proximaPagina.cursorProximo || null)
    } catch (erro) {
      setErroTimeline(erro instanceof Error ? erro.message : 'Não foi possível carregar mais eventos.')
    } finally {
      setCarregandoMais(false)
    }
  }

  const legendaPeriodo = periodo === 'personalizado' ? 'Período selecionado' : {
    '7d': 'Últimos 7 dias', '30d': 'Últimos 30 dias', '90d': 'Últimos 90 dias', mes: 'Este mês', personalizado: 'Período selecionado',
  }[periodo]

  const [aba, setAba] = useState<'timeline' | 'relatorios'>('timeline')

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={() => onAbertoChange(false)}
      largura="xl"
      titulo={produto ? produto.nome : 'Histórico do produto'}
      descricao={
        <span id="historico-produto-descricao">
          Histórico do produto
          {produto ? ` · ${produto.categoria} · ${formatarDinheiro(produto.preco)} · ${produto.estoque_quantidade ?? 0} em estoque` : ''}
        </span>
      }
      cabecalho={
        produto ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {produto.imagem_url ? (
                <span className="relative mr-1 size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                  <Image src={produto.imagem_url} alt="" fill sizes="32px" className="object-cover" />
                </span>
              ) : null}
              <Selo tom={produto.disponivel ? 'sucesso' : 'neutro'}>{produto.disponivel ? 'No cardápio' : 'Fora do cardápio'}</Selo>
              {produto.preco_original && produto.preco_original > produto.preco ? <Selo tom="alerta">Em promoção</Selo> : null}
            </div>
            <Segmentos
              rotuloAcessivel="O que ver"
              valor={aba}
              aoMudar={setAba}
              opcoes={[
                { valor: 'timeline', rotulo: 'O que mudou' },
                { valor: 'relatorios', rotulo: 'Vendas e estoque' },
              ]}
            />
            {aba === 'timeline' ? (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:-mx-6 md:px-6" role="group" aria-label="Filtrar por tipo">
                {OPCOES_CATEGORIA.map((opcao) => (
                  <Chip key={opcao.valor} ativo={categoria === opcao.valor} onClick={() => setCategoria(opcao.valor)}>
                    {opcao.rotulo}
                  </Chip>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-hide md:-mx-6 md:px-6" role="group" aria-label="Período">
                  {OPCOES_PERIODO.map((opcao) => (
                    <Chip key={opcao.valor} ativo={periodo === opcao.valor} onClick={() => setPeriodo(opcao.valor)}>
                      {opcao.valor === 'personalizado' ? <CalendarDays className="size-4" /> : null}
                      {opcao.rotulo}
                    </Chip>
                  ))}
                </div>
                {periodo === 'personalizado' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Entrada type="date" value={inicioPersonalizado} onChange={(evento) => setInicioPersonalizado(evento.target.value)} aria-label="Início do período" />
                    <Entrada type="date" value={fimPersonalizado} onChange={(evento) => setFimPersonalizado(evento.target.value)} aria-label="Fim do período" />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ) : undefined
      }
    >
      {produto ? (
        aba === 'timeline' ? (
          <ConteudoTimeline carregando={carregando} erro={erroTimeline} eventos={eventos} cursorProximo={cursorProximo} aoCarregarMais={carregarMais} carregandoMais={carregandoMais} />
        ) : (
          <ConteudoInteligencia carregando={carregandoInteligencia} erro={erroInteligencia} inteligencia={inteligencia} periodo={legendaPeriodo} />
        )
      ) : null}
    </Gaveta>
  )
}

const OPCOES_CATEGORIA: { valor: CategoriaTimeline; rotulo: string }[] = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'alteracao', rotulo: 'Alterações' },
  { valor: 'estoque', rotulo: 'Estoque' },
  { valor: 'comercial', rotulo: 'Vendas' },
  { valor: 'promocao', rotulo: 'Promoções' },
  { valor: 'visibilidade', rotulo: 'Visibilidade' },
]

const OPCOES_PERIODO: { valor: Periodo; rotulo: string }[] = [
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
  { valor: '90d', rotulo: '90 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'personalizado', rotulo: 'Escolher datas' },
]
