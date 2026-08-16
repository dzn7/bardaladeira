'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  Clock3,
  DollarSign,
  Eye,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  ShoppingBag,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { CHIP_FILTRO_ALERTA, CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { PaginacaoFinancas } from '@/features/financas/components/PaginacaoFinancas'

type UsuarioClienteMetrica = {
  id: string
  telefone: string
  nome: string | null
  endereco: string | null
  bairro: string | null
  primeiro_pedido_em: string | null
  ultimo_pedido_em: string | null
  total_pedidos: number
  total_pedidos_validos: number
  total_vendas: number
  ticket_medio: number
  ultimo_pedido_data: string | null
}

type PedidoCliente = {
  id: string
  numero_pedido: number | null
  status: string | null
  tipo_entrega: string | null
  forma_pagamento: string | null
  total: number
  created_at: string
  observacoes: string | null
}

const LIMIAR_RECUPERACAO_DIAS = 30
const LIMITE_PADRAO = 15

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const formatarTelefone = (telefone: string): string => {
  const digitos = (telefone || '').replace(/\D/g, '')
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return telefone
}

const mapearStatusPedido = (status: string | null) => {
  const s = (status || '').toLowerCase()
  if (s === 'pendente') return { label: 'Pendente', classe: 'bg-amber-500/15 text-amber-800 dark:text-amber-200' }
  if (s === 'confirmado') return { label: 'Confirmado', classe: 'bg-sky-500/15 text-sky-800 dark:text-sky-200' }
  if (s === 'preparando') return { label: 'Preparando', classe: 'bg-indigo-500/15 text-indigo-800 dark:text-indigo-200' }
  if (s === 'pronto') return { label: 'Pronto', classe: 'bg-violet-500/15 text-violet-800 dark:text-violet-200' }
  if (s === 'entregue') return { label: 'Entregue', classe: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200' }
  if (s === 'cancelado') return { label: 'Cancelado', classe: 'bg-rose-500/15 text-rose-800 dark:text-rose-200' }
  return { label: status || 'Sem status', classe: 'bg-muted text-muted-foreground' }
}

const construirLinkWhatsApp = (telefone: string, nome: string | null) => {
  const digitos = telefone.replace(/\D/g, '')
  const numero = digitos.startsWith('55') ? digitos : `55${digitos}`
  const primeiroNome = (nome || 'cliente').trim().split(' ')[0]
  const mensagem = `Olá, ${primeiroNome}! Sentimos sua falta aqui no Bar da Ladeira. Quer ver as novidades de hoje?`
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}

const diasSemPedido = (dataIso: string | null): number | null => {
  if (!dataIso) return null
  const ms = Date.now() - new Date(dataIso).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

const FILTROS_CLIENTE: Array<{
  valor: 'todos' | 'ativos' | 'recuperacao'
  label: string
  alert?: boolean
}> = [
  { valor: 'todos', label: 'Todos' },
  { valor: 'ativos', label: 'Com pedidos' },
  { valor: 'recuperacao', label: 'Recuperação', alert: true },
]

const FieldGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-border/70 pt-5 first:border-t-0 first:pt-0">
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children}
  </section>
)

const InlineFact = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) => (
  <div className="flex min-w-[8rem] items-start gap-2">
    <span className="mt-0.5 text-muted-foreground [&_svg]:size-3.5" aria-hidden>
      {icon}
    </span>
    <p className="grid gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums text-foreground">{value}</span>
    </p>
  </div>
)

const DetailRow = ({
  icon,
  label,
  value,
}: {
  icon?: ReactNode
  label: string
  value?: string | null
}) => (
  <div className="flex items-start justify-between gap-3 border-b border-border/50 py-2.5 last:border-0">
    <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon ? <span className="[&_svg]:size-3.5">{icon}</span> : null}
      {label}
    </dt>
    <dd className="max-w-[60%] text-right text-sm font-medium text-foreground">{value || '—'}</dd>
  </div>
)

export default function GerenciadorUsuariosClientes() {
  const [usuarios, setUsuarios] = useState<UsuarioClienteMetrica[]>([])
  const [carregando, setCarregando] = useState(true)
  const [recarregando, setRecarregando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'ativos' | 'recuperacao'>('todos')
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(LIMITE_PADRAO)
  const [usuarioDetalhe, setUsuarioDetalhe] = useState<UsuarioClienteMetrica | null>(null)
  const [pedidosDetalhe, setPedidosDetalhe] = useState<PedidoCliente[]>([])
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [editando, setEditando] = useState(false)
  const [editNome, setEditNome] = useState('')
  const [editEndereco, setEditEndereco] = useState('')
  const [editBairro, setEditBairro] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const chipsFiltroAtivo = useMemo((): ChipFiltroAtivo[] => {
    const chips: ChipFiltroAtivo[] = []
    if (busca.trim()) chips.push({ key: 'busca', label: 'Busca', value: busca.trim() })
    if (filtro !== 'todos') {
      chips.push({
        key: 'filtro',
        label: 'Segmento',
        value: FILTROS_CLIENTE.find((item) => item.valor === filtro)?.label ?? filtro,
      })
    }
    return chips
  }, [busca, filtro])

  const handleLimparFiltros = () => {
    setBusca('')
    setFiltro('todos')
    setPagina(1)
  }

  const carregarUsuarios = useCallback(async (silencioso = false) => {
    try {
      if (silencioso) setRecarregando(true)
      else setCarregando(true)

      const { data, error } = await supabase
        .from('vw_usuarios_cliente_metricas')
        .select('*')
        .order('total_vendas', { ascending: false })
        .order('total_pedidos', { ascending: false })

      if (error) throw error

      const lista = (data || []).map((item) => ({
        ...item,
        total_pedidos: Number(item.total_pedidos || 0),
        total_pedidos_validos: Number(item.total_pedidos_validos || 0),
        total_vendas: Number(item.total_vendas || 0),
        ticket_medio: Number(item.ticket_medio || 0),
      })) as UsuarioClienteMetrica[]

      setUsuarios(lista)
    } catch (erro) {
      console.error('Erro ao carregar usuários cliente:', erro)
      toast.error('Não foi possível carregar os usuários cliente.')
    } finally {
      setCarregando(false)
      setRecarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarUsuarios()
  }, [carregarUsuarios])

  const abrirDetalhes = async (usuario: UsuarioClienteMetrica) => {
    setUsuarioDetalhe(usuario)
    setPedidosDetalhe([])
    setEditando(false)
    setCarregandoDetalhe(true)

    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, status, tipo_entrega, forma_pagamento, total, created_at, observacoes')
        .eq('cliente_id', usuario.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error

      setPedidosDetalhe(
        (data || []).map((pedido) => ({
          ...pedido,
          total: Number(pedido.total || 0),
        })) as PedidoCliente[],
      )
    } catch (erro) {
      console.error('Erro ao carregar pedidos do usuário:', erro)
      toast.error('Não foi possível carregar os pedidos desse usuário.')
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const fecharDetalhes = () => {
    setUsuarioDetalhe(null)
    setEditando(false)
    setPedidosDetalhe([])
  }

  const iniciarEdicao = () => {
    if (!usuarioDetalhe) return
    setEditNome(usuarioDetalhe.nome || '')
    setEditEndereco(usuarioDetalhe.endereco || '')
    setEditBairro(usuarioDetalhe.bairro || '')
    setEditando(true)
  }

  const salvarEdicao = async () => {
    if (!usuarioDetalhe) return
    setSalvandoEdicao(true)
    try {
      const { error } = await supabase
        .from('usuarios_cliente')
        .update({
          nome: editNome.trim() || null,
          endereco: editEndereco.trim() || null,
          bairro: editBairro.trim() || null,
        })
        .eq('id', usuarioDetalhe.id)

      if (error) throw error

      const atualizado = {
        ...usuarioDetalhe,
        nome: editNome.trim() || null,
        endereco: editEndereco.trim() || null,
        bairro: editBairro.trim() || null,
      }
      setUsuarioDetalhe(atualizado)
      setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? { ...u, ...atualizado } : u)))
      setEditando(false)
      toast.success('Dados do cliente atualizados')
    } catch (erro) {
      console.error('Erro ao salvar edição:', erro)
      toast.error('Não foi possível salvar as alterações.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const abrirWhatsApp = (usuario: UsuarioClienteMetrica) => {
    window.open(construirLinkWhatsApp(usuario.telefone, usuario.nome), '_blank', 'noopener,noreferrer')
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const digitosBusca = termo.replace(/\D/g, '')

    return usuarios.filter((usuario) => {
      const matchBusca =
        !termo ||
        (usuario.nome || '').toLowerCase().includes(termo) ||
        (digitosBusca.length > 0 && usuario.telefone.includes(digitosBusca))

      if (!matchBusca) return false
      if (filtro === 'ativos') return usuario.total_pedidos_validos > 0
      if (filtro === 'recuperacao') {
        const dias = diasSemPedido(usuario.ultimo_pedido_data)
        return dias !== null && dias >= LIMIAR_RECUPERACAO_DIAS
      }
      return true
    })
  }, [usuarios, busca, filtro])

  useEffect(() => {
    setPagina(1)
  }, [busca, filtro])

  const totalPaginas = Math.max(1, Math.ceil(usuariosFiltrados.length / itensPorPagina))
  const paginaAtual = Math.min(pagina, totalPaginas)
  const usuariosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina
    return usuariosFiltrados.slice(inicio, inicio + itensPorPagina)
  }, [usuariosFiltrados, paginaAtual, itensPorPagina])

  const resumo = useMemo(() => {
    const totalUsuarios = usuarios.length
    const totalPedidos = usuarios.reduce((acc, usuario) => acc + usuario.total_pedidos_validos, 0)
    const totalVendas = usuarios.reduce((acc, usuario) => acc + usuario.total_vendas, 0)
    const ticketMedioGeral = totalPedidos > 0 ? totalVendas / totalPedidos : 0
    const emRecuperacao = usuarios.filter((usuario) => {
      const dias = diasSemPedido(usuario.ultimo_pedido_data)
      return dias !== null && dias >= LIMIAR_RECUPERACAO_DIAS
    }).length

    return { totalUsuarios, totalPedidos, totalVendas, ticketMedioGeral, emRecuperacao }
  }, [usuarios])

  const acoesCliente = (usuario: UsuarioClienteMetrica): MenuAcaoItem[] => [
    {
      key: 'detalhes',
      label: 'Detalhes',
      icon: <Eye className="h-4 w-4" strokeWidth={1.6} />,
      onSelect: () => void abrirDetalhes(usuario),
    },
    {
      key: 'whatsapp',
      label: 'WhatsApp',
      icon: <IconeWhatsApp className="h-4 w-4 text-[#25D366]" />,
      onSelect: () => abrirWhatsApp(usuario),
      variant: 'success',
    },
  ]

  const diasDetalhe = usuarioDetalhe ? diasSemPedido(usuarioDetalhe.ultimo_pedido_data) : null
  const recuperacaoDetalhe = diasDetalhe !== null && diasDetalhe >= LIMIAR_RECUPERACAO_DIAS

  return (
    <div className="min-w-0 space-y-5">
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          <div className="min-w-[72px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Clientes</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.totalUsuarios}</p>
          </div>
          <div className="min-w-[72px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Pedidos</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.totalPedidos}</p>
          </div>
          <div className="min-w-[88px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Vendas</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-600">
              {moeda.format(resumo.totalVendas)}
            </p>
          </div>
          <div className="min-w-[88px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ticket</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
              {moeda.format(resumo.ticketMedioGeral)}
            </p>
          </div>
          <div className="min-w-[88px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Recuperação</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-300">
              {resumo.emRecuperacao}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto h-9 shadow-none"
            onClick={() => void carregarUsuarios(true)}
            disabled={recarregando}
          >
            {recarregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              className="h-9 rounded-lg border-border/70 bg-background pl-9 shadow-none"
              aria-label="Buscar clientes"
            />
          </div>

          <div className="w-full overflow-x-auto">
            <ToggleGroup
              type="single"
              value={filtro}
              onValueChange={(valor) => {
                if (!valor) return
                setFiltro(valor as 'todos' | 'ativos' | 'recuperacao')
              }}
              aria-label="Filtrar clientes"
              className="flex w-max items-center justify-start gap-2"
            >
              {FILTROS_CLIENTE.map((item) => (
                <ToggleGroupItem
                  key={item.valor}
                  value={item.valor}
                  className={item.alert ? CHIP_FILTRO_ALERTA : CHIP_FILTRO_DEFAULT}
                >
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <FiltrosAtivosChips chips={chipsFiltroAtivo} onLimpar={handleLimparFiltros} />
        </div>

        <div className="mt-4">
          {carregando ? (
            <TabelaSkeleton linhas={8} />
          ) : usuariosFiltrados.length === 0 ? (
            <ListaVazia
              icone={<Users className="h-6 w-6" strokeWidth={1.6} />}
              titulo="Nenhum cliente encontrado"
              descricao="Ajuste a busca ou o segmento para ver outros clientes."
            />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-12" />
                      <TableHead>Cliente</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                      <TableHead className="text-right">Vendas</TableHead>
                      <TableHead>Último pedido</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usuariosPaginados.map((usuario) => {
                      const dias = diasSemPedido(usuario.ultimo_pedido_data)
                      const emRecuperacao = dias !== null && dias >= LIMIAR_RECUPERACAO_DIAS
                      return (
                        <TableRow
                          key={usuario.id}
                          className="cursor-pointer border-border/60"
                          onClick={() => void abrirDetalhes(usuario)}
                        >
                          <TableCell className="py-3 pl-3">
                            <div
                              className={cn(
                                'flex h-12 items-center border-l-4',
                                emRecuperacao ? 'border-amber-500' : 'border-primary/50',
                              )}
                            >
                              <span className="pl-3">
                                {emRecuperacao ? (
                                  <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                                ) : (
                                  <UserRound className="h-4 w-4 text-primary" aria-hidden />
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3">
                            <p className="truncate text-sm font-medium text-foreground">
                              {usuario.nome || 'Cliente sem nome'}
                            </p>
                            {emRecuperacao && (
                              <Badge
                                variant="secondary"
                                className="mt-1 rounded-md bg-amber-500/15 text-[10px] text-amber-800 dark:text-amber-200"
                              >
                                Recuperação
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="py-3 font-mono text-sm tabular-nums text-muted-foreground">
                            {formatarTelefone(usuario.telefone)}
                          </TableCell>
                          <TableCell className="py-3 text-sm text-muted-foreground">
                            {usuario.bairro || '—'}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm tabular-nums">
                            {usuario.total_pedidos_validos}
                          </TableCell>
                          <TableCell className="py-3 text-right font-mono text-sm font-semibold tabular-nums text-emerald-600">
                            {moeda.format(usuario.total_vendas)}
                          </TableCell>
                          <TableCell className="py-3 text-xs text-muted-foreground">
                            {usuario.ultimo_pedido_data
                              ? formatDistanceToNow(new Date(usuario.ultimo_pedido_data), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })
                              : 'Sem pedidos'}
                          </TableCell>
                          <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                            <MenuAcoes items={acoesCliente(usuario)} ariaLabel="Ações do cliente" />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 md:hidden">
                {usuariosPaginados.map((usuario) => {
                  const dias = diasSemPedido(usuario.ultimo_pedido_data)
                  const emRecuperacao = dias !== null && dias >= LIMIAR_RECUPERACAO_DIAS
                  return (
                    <button
                      key={usuario.id}
                      type="button"
                      onClick={() => void abrirDetalhes(usuario)}
                      className="flex w-full items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-left"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-l-4',
                          emRecuperacao
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-primary/50 bg-primary/10',
                        )}
                      >
                        {emRecuperacao ? (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        ) : (
                          <UserRound className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{usuario.nome || 'Cliente sem nome'}</p>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatarTelefone(usuario.telefone)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="font-mono tabular-nums">{usuario.total_pedidos_validos} pedidos</span>
                          <span className="font-mono tabular-nums text-emerald-600">
                            {moeda.format(usuario.total_vendas)}
                          </span>
                        </div>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <MenuAcoes items={acoesCliente(usuario)} />
                      </div>
                    </button>
                  )
                })}
              </div>

              <div className="mt-4">
                <PaginacaoFinancas
                  paginaAtual={paginaAtual}
                  totalPaginas={totalPaginas}
                  totalItens={usuariosFiltrados.length}
                  itensPorPagina={itensPorPagina}
                  onPaginaChange={setPagina}
                  onItensPorPaginaChange={(n) => {
                    setItensPorPagina(n)
                    setPagina(1)
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={Boolean(usuarioDetalhe)}
        onOpenChange={(aberto) => {
          if (!aberto) fecharDetalhes()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[92dvh] w-[calc(100vw-0.75rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-border/70 p-0 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] sm:h-[96dvh] sm:w-[min(1680px,98.5vw)] sm:max-w-none"
        >
          <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border/70 bg-background px-5 py-3 sm:px-6">
            <DialogTitle className="sr-only">
              {usuarioDetalhe ? `Cliente ${usuarioDetalhe.nome || 'sem nome'}` : 'Detalhes do cliente'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Histórico de pedidos e dados de contato do cliente.
            </DialogDescription>
            {usuarioDetalhe && recuperacaoDetalhe ? (
              <Badge
                variant="outline"
                className="shrink-0 rounded-lg border-0 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-100"
              >
                <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                Recuperação
              </Badge>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {usuarioDetalhe ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#25D366]"
                    onClick={() => abrirWhatsApp(usuarioDetalhe)}
                    aria-label="Abrir WhatsApp"
                  >
                    <IconeWhatsApp className="size-3.5" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-muted-foreground"
                    onClick={iniciarEdicao}
                    aria-label="Editar dados"
                  >
                    <Pencil className="size-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                </>
              ) : null}
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Fechar">
                  <X className="size-4" />
                </Button>
              </DialogClose>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-background">
            {!usuarioDetalhe ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Selecione um cliente</div>
            ) : (
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_1px_26rem]">
                <main className="min-w-0">
                  <div className="mb-7 grid gap-2">
                    {editando ? (
                      <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-nome">Nome</Label>
                          <Input
                            id="edit-nome"
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="edit-endereco">Endereço</Label>
                            <Input
                              id="edit-endereco"
                              value={editEndereco}
                              onChange={(e) => setEditEndereco(e.target.value)}
                              className="h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-bairro">Bairro</Label>
                            <Input
                              id="edit-bairro"
                              value={editBairro}
                              onChange={(e) => setEditBairro(e.target.value)}
                              className="h-10"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            className="h-10 shadow-none"
                            onClick={() => void salvarEdicao()}
                            disabled={salvandoEdicao}
                          >
                            {salvandoEdicao ? (
                              <Loader2 className="mr-1.5 size-4 animate-spin" />
                            ) : (
                              <Check className="mr-1.5 size-4" />
                            )}
                            Salvar
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 shadow-none"
                            onClick={() => setEditando(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="min-w-0 truncate text-2xl font-semibold leading-tight tracking-tight">
                          {usuarioDetalhe.nome || 'Cliente sem nome'}
                        </h2>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex min-w-0 items-center gap-1.5 font-mono tabular-nums">
                            <Phone className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{formatarTelefone(usuarioDetalhe.telefone)}</span>
                          </span>
                          {(usuarioDetalhe.endereco || usuarioDetalhe.bairro) && (
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <MapPin className="size-3.5 shrink-0" aria-hidden />
                              <span className="truncate">
                                {[usuarioDetalhe.endereco, usuarioDetalhe.bairro].filter(Boolean).join(' · ')}
                              </span>
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                    <InlineFact
                      icon={<ShoppingBag />}
                      label="Pedidos válidos"
                      value={String(usuarioDetalhe.total_pedidos_validos)}
                    />
                    <InlineFact
                      icon={<DollarSign />}
                      label="Total em vendas"
                      value={moeda.format(usuarioDetalhe.total_vendas)}
                    />
                    <InlineFact
                      icon={<UserRound />}
                      label="Ticket médio"
                      value={moeda.format(usuarioDetalhe.ticket_medio)}
                    />
                    <InlineFact
                      icon={<Clock3 />}
                      label="Último pedido"
                      value={
                        usuarioDetalhe.ultimo_pedido_data
                          ? formatDistanceToNow(new Date(usuarioDetalhe.ultimo_pedido_data), {
                              addSuffix: true,
                              locale: ptBR,
                            })
                          : 'Sem pedidos'
                      }
                    />
                  </div>

                  <FieldGroup title="Histórico de pedidos">
                    {carregandoDetalhe ? (
                      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Carregando pedidos…
                      </div>
                    ) : pedidosDetalhe.length === 0 ? (
                      <p className="py-6 text-sm text-muted-foreground">Nenhum pedido encontrado para este cliente.</p>
                    ) : (
                      <div className="space-y-2">
                        {pedidosDetalhe.map((pedido) => {
                          const status = mapearStatusPedido(pedido.status)
                          return (
                            <div
                              key={pedido.id}
                              className="rounded-lg border border-border/70 bg-card px-3 py-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    Pedido #{pedido.numero_pedido ?? '—'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", {
                                      locale: ptBR,
                                    })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                                      status.classe,
                                    )}
                                  >
                                    {status.label}
                                  </span>
                                  <span className="font-mono text-sm font-semibold tabular-nums text-emerald-600">
                                    {moeda.format(pedido.total)}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                                <span className="rounded-md bg-muted px-2 py-0.5">
                                  {pedido.tipo_entrega || '—'}
                                </span>
                                <span className="rounded-md bg-muted px-2 py-0.5">
                                  {pedido.forma_pagamento || '—'}
                                </span>
                              </div>
                              {pedido.observacoes ? (
                                <p className="mt-2 text-xs text-muted-foreground">Obs: {pedido.observacoes}</p>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </FieldGroup>
                </main>

                <div className="hidden bg-border/70 lg:block" aria-hidden />

                <aside className="grid min-w-0 content-start gap-5">
                  <FieldGroup title="Contato">
                    <dl className="grid gap-1">
                      <DetailRow
                        icon={<Phone />}
                        label="Telefone"
                        value={formatarTelefone(usuarioDetalhe.telefone)}
                      />
                      <DetailRow icon={<MapPin />} label="Endereço" value={usuarioDetalhe.endereco} />
                      <DetailRow label="Bairro" value={usuarioDetalhe.bairro} />
                    </dl>
                    <Button
                      type="button"
                      className="mt-4 h-10 w-full gap-2 bg-[#25D366] text-white shadow-none hover:bg-[#1ebe57]"
                      onClick={() => abrirWhatsApp(usuarioDetalhe)}
                    >
                      <IconeWhatsApp className="size-4" />
                      Conversar no WhatsApp
                    </Button>
                  </FieldGroup>

                  <FieldGroup title="Resumo">
                    <dl className="grid gap-1">
                      <DetailRow label="Pedidos" value={String(usuarioDetalhe.total_pedidos_validos)} />
                      <DetailRow label="Vendas" value={moeda.format(usuarioDetalhe.total_vendas)} />
                      <DetailRow label="Ticket médio" value={moeda.format(usuarioDetalhe.ticket_medio)} />
                      <DetailRow
                        label="Primeira compra"
                        value={
                          usuarioDetalhe.primeiro_pedido_em
                            ? format(new Date(usuarioDetalhe.primeiro_pedido_em), 'dd/MM/yyyy', {
                                locale: ptBR,
                              })
                            : null
                        }
                      />
                      <DetailRow
                        label="Última compra"
                        value={
                          usuarioDetalhe.ultimo_pedido_data
                            ? format(new Date(usuarioDetalhe.ultimo_pedido_data), 'dd/MM/yyyy', {
                                locale: ptBR,
                              })
                            : null
                        }
                      />
                      {recuperacaoDetalhe && diasDetalhe != null ? (
                        <DetailRow label="Dias sem pedido" value={String(diasDetalhe)} />
                      ) : null}
                    </dl>
                  </FieldGroup>
                </aside>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
