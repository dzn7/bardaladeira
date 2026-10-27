'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Clock as Clock3, CurrencyDollar as DollarSign, CircleNotch as Loader2, MapPin, PencilSimple as Pencil, Phone, ArrowsClockwise as RefreshCw, MagnifyingGlass as Search, ShoppingBag, UserCircle as UserRound, Users } from '@phosphor-icons/react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import {
  Botao,
  Campo,
  Chip,
  Entrada,
  Gaveta,
  Lista,
  ListaCarregando,
  ListaVazia,
  Selo,
} from '@/components/admin/ui'
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
  { valor: 'recuperacao', label: 'Sumidos há 30+ dias', alert: true },
]

const FieldGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2">
    <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
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
  <div className="flex min-w-0 items-start gap-2">
    <span className="mt-0.5 text-muted-foreground [&_svg]:size-3.5" aria-hidden>
      {icon}
    </span>
    <p className="grid gap-0.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
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
  <div className="flex items-start justify-between gap-3 border-b border-border/70 py-2.5 last:border-0">
    <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
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

  const diasDetalhe = usuarioDetalhe ? diasSemPedido(usuarioDetalhe.ultimo_pedido_data) : null
  const recuperacaoDetalhe = diasDetalhe !== null && diasDetalhe >= LIMIAR_RECUPERACAO_DIAS

  const ultimoPedidoTexto = (data: string | null) =>
    data ? formatDistanceToNow(new Date(data), { addSuffix: true, locale: ptBR }) : 'Sem pedidos'

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-5">
        {[
          { rotulo: 'Clientes', valor: String(resumo.totalUsuarios) },
          { rotulo: 'Pedidos', valor: String(resumo.totalPedidos) },
          { rotulo: 'Vendas', valor: moeda.format(resumo.totalVendas) },
          { rotulo: 'Ticket médio', valor: moeda.format(resumo.ticketMedioGeral) },
          { rotulo: 'Sumidos há 30+ dias', valor: String(resumo.emRecuperacao) },
        ].map((item) => (
          <div key={item.rotulo} className="min-w-0">
            <p className="truncate text-[13px] text-muted-foreground">{item.rotulo}</p>
            <p className="mt-0.5 truncate text-lg font-semibold tabular-nums text-foreground">{item.valor}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1 md:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Entrada
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="pl-9"
            aria-label="Buscar clientes"
          />
        </div>
        <Botao
          variante="contorno"
          tamanho="icone"
          className="size-11 md:size-10"
          onClick={() => void carregarUsuarios(true)}
          carregando={recarregando}
          aria-label="Atualizar lista"
        >
          {!recarregando && <RefreshCw />}
        </Botao>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filtrar clientes">
        {FILTROS_CLIENTE.map((item) => (
          <Chip key={item.valor} ativo={filtro === item.valor} onClick={() => setFiltro(item.valor)} className="h-10">
            {item.label}
          </Chip>
        ))}
      </div>

      {carregando ? (
        <ListaCarregando linhas={6} />
      ) : usuariosFiltrados.length === 0 ? (
        <ListaVazia
          icone={<Users />}
          titulo="Nenhum cliente encontrado"
          descricao="Tente outro nome, telefone ou filtro."
          acao={
            busca.trim() || filtro !== 'todos' ? (
              <Botao variante="contorno" onClick={handleLimparFiltros}>Limpar filtros</Botao>
            ) : undefined
          }
        />
      ) : (
        <>
          <Lista>
            {usuariosPaginados.map((usuario) => {
              const dias = diasSemPedido(usuario.ultimo_pedido_data)
              const emRecuperacao = dias !== null && dias >= LIMIAR_RECUPERACAO_DIAS
              return (
                <li key={usuario.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => void abrirDetalhes(usuario)}
                    onKeyDown={(evento) => {
                      if (evento.key === 'Enter') void abrirDetalhes(usuario)
                    }}
                    className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate font-medium text-foreground">{usuario.nome || 'Cliente sem nome'}</p>
                        {emRecuperacao ? <Selo tom="alerta">Sumido</Selo> : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        <span className="tabular-nums">{formatarTelefone(usuario.telefone)}</span>
                        {usuario.bairro ? ` · ${usuario.bairro}` : ''}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-muted-foreground md:hidden">
                        {usuario.total_pedidos_validos} pedidos · {moeda.format(usuario.total_vendas)}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right md:block">
                      <p className="text-sm font-medium tabular-nums text-foreground">{moeda.format(usuario.total_vendas)}</p>
                      <p className="text-[13px] text-muted-foreground">
                        {usuario.total_pedidos_validos} pedidos · {ultimoPedidoTexto(usuario.ultimo_pedido_data)}
                      </p>
                    </div>
                    <Botao
                      variante="fantasma"
                      tamanho="icone"
                      className="size-11 shrink-0 text-muted-foreground md:size-10"
                      onClick={(evento) => {
                        evento.stopPropagation()
                        abrirWhatsApp(usuario)
                      }}
                      aria-label={`Chamar ${usuario.nome || 'cliente'} no WhatsApp`}
                    >
                      <IconeWhatsApp className="size-4" />
                    </Botao>
                  </div>
                </li>
              )
            })}
          </Lista>

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
        </>
      )}

      <Gaveta
        aberto={Boolean(usuarioDetalhe)}
        aoFechar={fecharDetalhes}
        bloqueada={salvandoEdicao}
        largura="lg"
        titulo={editando ? 'Editar cliente' : usuarioDetalhe?.nome || 'Cliente sem nome'}
        descricao={
          editando
            ? 'Nome e endereço que aparecem nos pedidos.'
            : usuarioDetalhe
              ? recuperacaoDetalhe
                ? `${formatarTelefone(usuarioDetalhe.telefone)} · sem pedir há ${diasDetalhe} dias`
                : formatarTelefone(usuarioDetalhe.telefone)
              : undefined
        }
        rodape={
          usuarioDetalhe ? (
            editando ? (
              <>
                <Botao variante="contorno" onClick={() => setEditando(false)} disabled={salvandoEdicao}>
                  Cancelar
                </Botao>
                <Botao carregando={salvandoEdicao} onClick={() => void salvarEdicao()}>
                  Salvar
                </Botao>
              </>
            ) : (
              <>
                <Botao variante="contorno" className="md:mr-auto" onClick={iniciarEdicao}>
                  <Pencil />
                  Editar
                </Botao>
                <Botao onClick={() => abrirWhatsApp(usuarioDetalhe)}>
                  <IconeWhatsApp className="size-4" />
                  WhatsApp
                </Botao>
              </>
            )
          ) : null
        }
      >
        {!usuarioDetalhe ? null : editando ? (
          <form
            className="space-y-4"
            onSubmit={(evento) => {
              evento.preventDefault()
              void salvarEdicao()
            }}
          >
            <Campo rotulo="Nome" htmlFor="edit-nome">
              <Entrada id="edit-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} autoComplete="off" />
            </Campo>
            <Campo rotulo="Endereço" htmlFor="edit-endereco" opcional>
              <Entrada id="edit-endereco" value={editEndereco} onChange={(e) => setEditEndereco(e.target.value)} autoComplete="off" />
            </Campo>
            <Campo rotulo="Bairro" htmlFor="edit-bairro" opcional>
              <Entrada id="edit-bairro" value={editBairro} onChange={(e) => setEditBairro(e.target.value)} autoComplete="off" />
            </Campo>
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <InlineFact icon={<ShoppingBag />} label="Pedidos válidos" value={String(usuarioDetalhe.total_pedidos_validos)} />
              <InlineFact icon={<DollarSign />} label="Total em vendas" value={moeda.format(usuarioDetalhe.total_vendas)} />
              <InlineFact icon={<UserRound />} label="Ticket médio" value={moeda.format(usuarioDetalhe.ticket_medio)} />
              <InlineFact icon={<Clock3 />} label="Último pedido" value={ultimoPedidoTexto(usuarioDetalhe.ultimo_pedido_data)} />
            </div>

            <FieldGroup title="Contato">
              <dl>
                <DetailRow icon={<Phone />} label="Telefone" value={formatarTelefone(usuarioDetalhe.telefone)} />
                <DetailRow icon={<MapPin />} label="Endereço" value={usuarioDetalhe.endereco} />
                <DetailRow label="Bairro" value={usuarioDetalhe.bairro} />
                <DetailRow
                  label="Primeira compra"
                  value={usuarioDetalhe.primeiro_pedido_em ? format(new Date(usuarioDetalhe.primeiro_pedido_em), 'dd/MM/yyyy', { locale: ptBR }) : null}
                />
                <DetailRow
                  label="Última compra"
                  value={usuarioDetalhe.ultimo_pedido_data ? format(new Date(usuarioDetalhe.ultimo_pedido_data), 'dd/MM/yyyy', { locale: ptBR }) : null}
                />
                {recuperacaoDetalhe && diasDetalhe != null ? (
                  <DetailRow label="Dias sem pedido" value={String(diasDetalhe)} />
                ) : null}
              </dl>
            </FieldGroup>

            <FieldGroup title="Pedidos">
              {carregandoDetalhe ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Carregando pedidos…
                </div>
              ) : pedidosDetalhe.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Este cliente ainda não fez pedidos.</p>
              ) : (
                <Lista>
                  {pedidosDetalhe.map((pedido) => {
                    const status = mapearStatusPedido(pedido.status)
                    return (
                      <li key={pedido.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">Pedido #{pedido.numero_pedido ?? '—'}</p>
                            <p className="text-[13px] text-muted-foreground">
                              {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              {' · '}
                              {[pedido.tipo_entrega, pedido.forma_pagamento].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-medium tabular-nums text-foreground">{moeda.format(pedido.total)}</p>
                            <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', status.classe)}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                        {pedido.observacoes ? (
                          <p className="mt-1.5 text-[13px] text-muted-foreground">Obs.: {pedido.observacoes}</p>
                        ) : null}
                      </li>
                    )
                  })}
                </Lista>
              )}
            </FieldGroup>
          </div>
        )}
      </Gaveta>
    </div>
  )
}
