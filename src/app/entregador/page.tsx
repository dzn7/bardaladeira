'use client'

import { useEffect, useMemo, useState, type ButtonHTMLAttributes } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  Bell,
  Bike,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  LogOut,
  MapPin,
  Moon,
  Package,
  Phone,
  RefreshCw,
  Route,
  Sun,
  ShieldX,
  Truck,
  Wrench,
  X,
  XCircle,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

import RotaProtegidaEntregador from '@/components/entregador/RotaProtegidaEntregador'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { limparSessao, obterSessao, salvarSessao } from '@/lib/autenticacao'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { Funcionario } from '@/lib/tipos-caixa'
import { useEntregador, type EntregaParaEntregador } from '@/lib/useEntregador'
import { useControleAcesso } from '@/contexts/ControleAcessoContext'

type AbaAtiva = 'pendentes' | 'concluidas'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const obterDataOperacionalAtual = () => {
  const agora = new Date()
  const inicio = new Date(agora)
  inicio.setHours(3, 0, 0, 0)

  if (agora < inicio) {
    inicio.setDate(inicio.getDate() - 1)
  }

  return format(inicio, 'yyyy-MM-dd')
}

const obterStatusEntrega = (status: EntregaParaEntregador['status']) => {
  if (status === 'entregue') {
    return {
      label: 'Entregue',
      badge: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200',
      dot: 'bg-emerald-500',
    }
  }

  if (status === 'em_rota') {
    return {
      label: 'Em rota',
      badge: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200',
      dot: 'bg-blue-500',
    }
  }

  if (status === 'cancelada') {
    return {
      label: 'Cancelada',
      badge: 'border-orange-300 bg-orange-50 text-red-800 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-200',
      dot: 'bg-orange-500',
    }
  }

  return {
    label: 'Pendente',
    badge: 'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-950/30 dark:text-yellow-200',
    dot: 'bg-yellow-500',
  }
}

const enderecoEntrega = (entrega: EntregaParaEntregador) =>
  entrega.endereco_entrega || entrega.pedido?.endereco || 'Endereço não informado'

const bairroEntrega = (entrega: EntregaParaEntregador) =>
  entrega.pedido?.bairro || entrega.bairro

const telefoneEntrega = (entrega: EntregaParaEntregador) =>
  entrega.pedido?.telefone || null

const totalPedido = (entrega: EntregaParaEntregador) =>
  Number(entrega.pedido?.total || 0)

function BotaoIcone({
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        className,
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}

function EstatisticaCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof Truck
}) {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {label}
          </span>
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.6} />
        </div>
        <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function EntregaCard({
  entrega,
  expandida,
  processando,
  onToggle,
  onLigar,
  onCancelar,
  onConfirmar,
  podeEditar,
}: {
  entrega: EntregaParaEntregador
  expandida: boolean
  processando: boolean
  onToggle: () => void
  onLigar: (telefone: string) => void
  onCancelar: () => void
  onConfirmar: () => void
  podeEditar: boolean
}) {
  const status = obterStatusEntrega(entrega.status)
  const telefone = telefoneEntrega(entrega)
  const bairro = bairroEntrega(entrega)
  const pendente = entrega.status === 'pendente' || entrega.status === 'em_rota'

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="self-start"
      exit={{ opacity: 0, scale: 0.98 }}
      initial={{ opacity: 0, y: 10 }}
      layout
    >
      <Card className="overflow-hidden border-border/70 shadow-none transition-colors hover:border-border">
        <button className="w-full p-4 text-left" onClick={onToggle} type="button">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn('gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold', status.badge)} variant="outline">
                  <span className={cn('size-1.5 rounded-full', status.dot)} />
                  {status.label}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {format(new Date(entrega.created_at), 'HH:mm', { locale: ptBR })}
                </span>
              </div>
              <p className="truncate text-sm font-semibold text-foreground">
                {entrega.pedido?.nome_cliente || 'Cliente não informado'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {moeda.format(totalPedido(entrega))}
              </span>
              <ChevronDown
                className={cn('size-4 text-muted-foreground transition-transform', expandida && 'rotate-180')}
                strokeWidth={1.6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
              <p className="line-clamp-2 text-sm font-medium text-foreground">
                {enderecoEntrega(entrega)}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {bairro && (
                  <Badge className="rounded-md border-border/70 bg-muted/40 text-[11px] text-muted-foreground" variant="outline">
                    {bairro}
                  </Badge>
                )}
                <span className="font-mono text-[11px] text-muted-foreground">
                  Taxa {moeda.format(Number(entrega.taxa_entrega || entrega.pedido?.taxa_entrega || 0))}
                </span>
              </div>
            </div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expandida && (
            <motion.div
              animate={{ height: 'auto', opacity: 1 }}
              className="overflow-hidden border-t border-border/70"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
            >
              <div className="space-y-3 p-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
                    <span>{enderecoEntrega(entrega)}</span>
                  </div>
                  {telefone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-4 shrink-0" strokeWidth={1.6} />
                      <span>{telefone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CircleDollarSign className="size-4 shrink-0" strokeWidth={1.6} />
                    <span>{entrega.pedido?.forma_pagamento || 'Pagamento não informado'}</span>
                  </div>
                </div>

                {(entrega.observacoes || entrega.pedido?.observacoes) && (
                  <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                      Observações
                    </p>
                    <p className="text-sm text-foreground">
                      {entrega.observacoes || entrega.pedido?.observacoes}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {telefone && (
                    <Button className="h-9 shadow-none" onClick={() => onLigar(telefone)} type="button" variant="outline">
                      <Phone className="mr-2 size-4" />
                      Ligar
                    </Button>
                  )}
                  {pendente && podeEditar && (
                    <Button
                      className="h-9 border-emerald-300 bg-emerald-600 text-white shadow-none hover:bg-emerald-700 dark:border-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800"
                      disabled={processando}
                      onClick={onConfirmar}
                      type="button"
                      variant="outline"
                    >
                      {processando ? (
                        <RefreshCw className="mr-2 size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 size-4" />
                      )}
                      Confirmar
                    </Button>
                  )}
                </div>

                {pendente && podeEditar && (
                  <Button
                    className="h-9 w-full shadow-none"
                    disabled={processando}
                    onClick={onCancelar}
                    type="button"
                    variant="outline"
                  >
                    <XCircle className="mr-2 size-4" />
                    Cancelar entrega
                  </Button>
                )}

                {entrega.status === 'entregue' && (
                  <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <CheckCircle2 className="size-4" />
                    Entrega confirmada
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

function PainelEntregadorConteudo() {
  const { carregando: carregandoAcesso, pode, emManutencao } = useControleAcesso()
  const [entregadorSelecionado, setEntregadorSelecionado] = useState<string | null>(null)
  const [entregadores, setEntregadores] = useState<Funcionario[]>([])
  const [carregandoEntregadores, setCarregandoEntregadores] = useState(true)
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('pendentes')
  const [entregaExpandida, setEntregaExpandida] = useState<string | null>(null)
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false)
  const [entregaCancelarId, setEntregaCancelarId] = useState<string | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)
  const [dataSelecionada, setDataSelecionada] = useState(() => obterDataOperacionalAtual())
  const [mounted, setMounted] = useState(false)

  const { theme, setTheme } = useTheme()
  const router = useRouter()

  const {
    entregas,
    entregador,
    estatisticas,
    notificacoes,
    notificacoesPermitidas,
    carregando,
    carregarDados,
    concluirEntrega,
    verificarPermissaoNotificacao,
    marcarNotificacaoLida,
  } = useEntregador(entregadorSelecionado, dataSelecionada)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setEntregaExpandida(null)
  }, [abaAtiva, dataSelecionada])

  useEffect(() => {
    async function carregarEntregadores() {
      try {
        const sessao = obterSessao()

        if (sessao?.funcionario_id) {
          setEntregadorSelecionado(sessao.funcionario_id)
          localStorage.setItem('entregador_id', sessao.funcionario_id)
          setCarregandoEntregadores(false)
          return
        }

        if (sessao && sessao.papel === 'entregador') {
          const { data: novoFunc, error: erroInsert } = await supabase
            .from('funcionarios')
            .insert({
              nome: sessao.nome,
              tipo: 'entregador',
              cargo: 'Entregador',
              ativo: true,
            })
            .select('id')
            .single()

          if (!erroInsert && novoFunc) {
            await supabase
              .from('usuarios_sistema')
              .update({ funcionario_id: novoFunc.id })
              .eq('id', sessao.id)

            salvarSessao({ ...sessao, funcionario_id: novoFunc.id })
            setEntregadorSelecionado(novoFunc.id)
            localStorage.setItem('entregador_id', novoFunc.id)
            setCarregandoEntregadores(false)
            return
          }
        }

        const { data } = await supabase
          .from('funcionarios')
          .select('*')
          .eq('ativo', true)
          .eq('tipo', 'entregador')
          .order('nome')

        setEntregadores(data || [])

        const salvo = localStorage.getItem('entregador_id')
        if (salvo && data?.find((funcionario) => funcionario.id === salvo)) {
          setEntregadorSelecionado(salvo)
        } else if (data?.length === 1) {
          setEntregadorSelecionado(data[0].id)
          localStorage.setItem('entregador_id', data[0].id)
        }
      } catch (erro) {
        console.error('Erro ao carregar entregadores:', erro)
      } finally {
        setCarregandoEntregadores(false)
      }
    }

    void carregarEntregadores()
  }, [])

  const entregasFiltradas = useMemo(() => {
    if (abaAtiva === 'concluidas') {
      return entregas.filter((entrega) => entrega.status === 'entregue')
    }

    return entregas.filter((entrega) => entrega.status === 'pendente' || entrega.status === 'em_rota')
  }, [abaAtiva, entregas])

  const notificacoesNaoLidas = notificacoes.filter((notificacao) => !notificacao.lida).length
  const entregaParaCancelar = entregas.find((entrega) => entrega.id === entregaCancelarId) || null

  const selecionarEntregador = (id: string) => {
    setEntregadorSelecionado(id)
    localStorage.setItem('entregador_id', id)
  }

  const handleLogout = () => {
    limparSessao()
    localStorage.removeItem('entregadorToken')
    localStorage.removeItem('entregador_id')
    router.push('/entregador/login')
  }

  const handleConfirmarEntrega = async (entregaId: string) => {
    setProcessando(entregaId)
    const sucesso = await concluirEntrega(entregaId)
    setProcessando(null)
    if (sucesso) setEntregaExpandida(null)
  }

  const handleCancelarEntrega = async () => {
    if (!entregaCancelarId) return

    setProcessando(entregaCancelarId)
    try {
      await supabase
        .from('entregas')
        .update({ status: 'cancelada' })
        .eq('id', entregaCancelarId)

      await carregarDados()
      setEntregaExpandida(null)
      setEntregaCancelarId(null)
    } catch (erro) {
      console.error('Erro ao cancelar:', erro)
      toast.error('Não foi possível cancelar a entrega')
    } finally {
      setProcessando(null)
    }
  }

  const ligarParaCliente = (telefone: string) => {
    window.open(`tel:${telefone}`, '_self')
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const moduloEmManutencao = emManutencao('entregador.entregas')
  const podeVer = pode('entregador.entregas', 'ver')
  const podeEditar = pode('entregador.entregas', 'editar') && !moduloEmManutencao

  if (carregandoAcesso) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <RefreshCw className="size-7 animate-spin text-primary" />
      </div>
    )
  }

  if (moduloEmManutencao || !podeVer) {
    const Icone = moduloEmManutencao ? Wrench : ShieldX
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted">
            <Icone className="size-6 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            {moduloEmManutencao ? 'Módulo em manutenção' : 'Acesso desativado'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {moduloEmManutencao ? 'Tente novamente mais tarde.' : 'Fale com o administrador.'}
          </p>
          <Button className="mt-5" type="button" variant="outline" onClick={handleLogout}>
            Sair
          </Button>
        </div>
      </div>
    )
  }

  if (!entregadorSelecionado) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <header className="safe-area-top border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <div className="flex items-center gap-3">
              <img alt="Bar da Ladeira" className="size-9 rounded-md border border-border/70" src="/logo.webp" />
              <div>
                <h1 className="text-sm font-semibold">Bar da Ladeira</h1>
                <p className="text-xs text-muted-foreground">Painel do entregador</p>
              </div>
            </div>
            {mounted && (
              <BotaoIcone aria-label="Alternar tema" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </BotaoIcone>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-6">
          <div className="mx-auto max-w-md space-y-4">
            <Card className="border-border/70 shadow-none">
              <CardHeader className="p-5">
                <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Bike className="size-5" strokeWidth={1.6} />
                </div>
                <CardTitle className="text-base">Selecionar entregador</CardTitle>
                <CardDescription>Escolha o perfil para acompanhar as entregas.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-5 pt-0">
                {carregandoEntregadores ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <RefreshCw className="mr-2 size-4 animate-spin" />
                    Carregando
                  </div>
                ) : entregadores.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/70 p-6 text-center">
                    <AlertCircle className="mx-auto mb-2 size-8 text-muted-foreground" strokeWidth={1.6} />
                    <p className="text-sm font-medium">Nenhum entregador cadastrado</p>
                    <p className="mt-1 text-xs text-muted-foreground">Cadastre entregadores no painel admin.</p>
                  </div>
                ) : (
                  entregadores.map((funcionario) => (
                    <button
                      className="flex w-full items-center gap-3 rounded-lg border border-border/70 bg-card p-3 text-left transition-colors hover:bg-accent"
                      key={funcionario.id}
                      onClick={() => selecionarEntregador(funcionario.id)}
                      type="button"
                    >
                      <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Bike className="size-4" strokeWidth={1.6} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{funcionario.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">{funcionario.cargo || 'Entregador'}</p>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.6} />
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          Carregando entregas
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="safe-area-top sticky top-0 z-40 border-b border-border/70 bg-background/90 px-3 py-3 backdrop-blur sm:px-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img alt="Bar da Ladeira" className="size-9 rounded-md border border-border/70" src="/logo.webp" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{entregador?.nome || 'Entregador'}</h1>
              <p className="truncate text-xs text-muted-foreground">Bar da Ladeira Entregas</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <BotaoIcone aria-label="Notificações" className="relative" onClick={() => setMostrarNotificacoes(true)}>
              <Bell className="size-4" />
              {notificacoesNaoLidas > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                  {notificacoesNaoLidas}
                </span>
              )}
            </BotaoIcone>
            <BotaoIcone aria-label="Atualizar entregas" onClick={carregarDados}>
              <RefreshCw className="size-4" />
            </BotaoIcone>
            {mounted && (
              <BotaoIcone aria-label="Alternar tema" onClick={toggleTheme}>
                {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </BotaoIcone>
            )}
            <BotaoIcone aria-label="Sair" className="hover:text-destructive" onClick={handleLogout}>
              <LogOut className="size-4" />
            </BotaoIcone>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3 py-4 sm:px-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <EstatisticaCard
            icon={Route}
            label="Pendentes"
            value={estatisticas.pendentes + estatisticas.emRota}
          />
          <EstatisticaCard icon={CheckCircle2} label="Concluídas" value={estatisticas.concluidas} />
          <EstatisticaCard icon={CircleDollarSign} label="Taxas" value={moeda.format(estatisticas.ganhoHoje)} />
        </div>

        <Card className="border-border/70 shadow-none">
          <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <CalendarDays className="size-4" strokeWidth={1.6} />
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="data-entregas">
                  Data das entregas
                </label>
                <p className="text-xs text-muted-foreground">Filtre o painel pelo dia escolhido.</p>
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:min-w-72">
              <Input
                className="h-9"
                id="data-entregas"
                onChange={(event) => {
                  if (event.target.value) setDataSelecionada(event.target.value)
                }}
                type="date"
                value={dataSelecionada}
              />
              <Button
                className="h-9 shadow-none"
                disabled={dataSelecionada === obterDataOperacionalAtual()}
                onClick={() => setDataSelecionada(obterDataOperacionalAtual())}
                type="button"
                variant="outline"
              >
                Hoje
              </Button>
            </div>
          </CardContent>
        </Card>

        {!notificacoesPermitidas && (
          <Card className="border-border/70 shadow-none">
            <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Bell className="size-4" strokeWidth={1.6} />
                </div>
                <div>
                  <p className="text-sm font-medium">Notificações desativadas</p>
                  <p className="text-xs text-muted-foreground">Receba alertas quando chegarem entregas.</p>
                </div>
              </div>
              <Button
                className="h-9 shadow-none"
                onClick={async () => {
                  const permitido = await verificarPermissaoNotificacao()
                  if (permitido) toast.success('Notificações ativadas')
                  else toast.error('Permissão negada nas configurações do navegador')
                }}
                type="button"
                variant="outline"
              >
                Ativar
              </Button>
            </CardContent>
          </Card>
        )}

        {notificacoesPermitidas && (
          <div className="flex items-center justify-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500" />
            Notificações ativas
          </div>
        )}

        <Tabs onValueChange={(valor) => setAbaAtiva(valor as AbaAtiva)} value={abaAtiva}>
          <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg border border-border/70 bg-muted/30 p-1">
            <TabsTrigger className="rounded-md text-xs" value="pendentes">
              Pendentes
              <span className="ml-1.5 font-mono text-[11px]">
                {estatisticas.pendentes + estatisticas.emRota}
              </span>
            </TabsTrigger>
            <TabsTrigger className="rounded-md text-xs" value="concluidas">
              Concluídas
              <span className="ml-1.5 font-mono text-[11px]">{estatisticas.concluidas}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="min-h-0 flex-1 pr-2">
          <AnimatePresence mode="popLayout">
            {entregasFiltradas.length === 0 ? (
              <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}>
                <Card className="border-border/70 border-dashed shadow-none">
                  <CardContent className="p-8 text-center">
                    <Package className="mx-auto mb-3 size-10 text-muted-foreground/60" strokeWidth={1.5} />
                    <p className="text-sm font-medium">
                      {abaAtiva === 'pendentes' ? 'Nenhuma entrega pendente nesta data' : 'Nenhuma entrega concluída nesta data'}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="grid items-start gap-3 pb-8">
                {entregasFiltradas.map((entrega) => (
                  <EntregaCard
                    entrega={entrega}
                    expandida={entregaExpandida === entrega.id}
                    key={entrega.id}
                    onCancelar={() => setEntregaCancelarId(entrega.id)}
                    onConfirmar={() => void handleConfirmarEntrega(entrega.id)}
                    onLigar={ligarParaCliente}
                    onToggle={() => setEntregaExpandida(entregaExpandida === entrega.id ? null : entrega.id)}
                    podeEditar={podeEditar}
                    processando={processando === entrega.id}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </main>

      <ModalSheet
        open={mostrarNotificacoes}
        onOpenChange={setMostrarNotificacoes}
        title="Notificações"
        showCloseButton={false}
        className="sm:max-w-md"
      >
        <div className="flex max-h-[85dvh] w-full flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Notificações</h2>
                  <p className="text-xs text-muted-foreground">{notificacoesNaoLidas} não lida{notificacoesNaoLidas === 1 ? '' : 's'}</p>
                </div>
                <BotaoIcone aria-label="Fechar notificações" onClick={() => setMostrarNotificacoes(false)}>
                  <X className="size-4" />
                </BotaoIcone>
              </div>

              <ScrollArea className="min-h-0 flex-1">
                {notificacoes.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="mx-auto mb-3 size-10 text-muted-foreground/60" strokeWidth={1.5} />
                    <p className="text-sm text-muted-foreground">Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {notificacoes.map((notificacao, indice) => (
                      <button
                        className={cn(
                          'w-full rounded-lg p-3 text-left transition-colors hover:bg-accent',
                          !notificacao.lida && 'bg-muted/50',
                        )}
                        key={notificacao.id}
                        onClick={() => marcarNotificacaoLida(notificacao.id)}
                        type="button"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            {notificacao.tipo === 'nova_entrega' ? (
                              <Truck className="size-4" strokeWidth={1.6} />
                            ) : notificacao.tipo === 'cancelamento' ? (
                              <X className="size-4" strokeWidth={1.6} />
                            ) : (
                              <Bell className="size-4" strokeWidth={1.6} />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{notificacao.titulo}</p>
                            <p className="truncate text-xs text-muted-foreground">{notificacao.mensagem}</p>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              {format(notificacao.timestamp, 'HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                          {!notificacao.lida && <span className="mt-1.5 size-2 rounded-full bg-foreground" />}
                        </div>
                        {indice < notificacoes.length - 1 && <Separator className="mt-3 bg-border/70" />}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
        </div>
      </ModalSheet>

      <AlertDialog open={Boolean(entregaCancelarId)} onOpenChange={(aberto) => !aberto && setEntregaCancelarId(null)}>
        <AlertDialogContent className="rounded-xl border-border/70 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar entrega?</AlertDialogTitle>
            <AlertDialogDescription>
              {entregaParaCancelar?.pedido?.nome_cliente
                ? `A entrega de ${entregaParaCancelar.pedido.nome_cliente} será marcada como cancelada.`
                : 'Esta entrega será marcada como cancelada.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(processando)}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={Boolean(processando)}
              onClick={(event) => {
                event.preventDefault()
                void handleCancelarEntrega()
              }}
            >
              {processando && <RefreshCw className="mr-2 size-4 animate-spin" />}
              Cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function PainelEntregadorPage() {
  return (
    <RotaProtegidaEntregador>
      <PainelEntregadorConteudo />
    </RotaProtegidaEntregador>
  )
}
