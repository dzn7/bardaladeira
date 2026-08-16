'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  AlertCircle,
  Bell,
  BellOff,
  Check,
  CheckCircle2,
  Copy,
  Phone,
  QrCode,
  RefreshCw,
  Router,
  Send,
  Settings,
  ShieldAlert,
  Trash2,
  Trophy,
  Users,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import AdminLayout from '@/components/admin/AdminLayout'
import AvisoJogoBot from '@/components/admin/AvisoJogoBot'
import ConfiguracoesBot from '@/components/admin/ConfiguracoesBot'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const API_BOT_URL = '/api/bot'
const BOT_URL_DISPLAY = process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3000'

const qrCodeEhImagem = (valor: string | null) => Boolean(valor?.startsWith('data:image'))

type StatusBot = {
  conectado: boolean
  status: 'conectado' | 'desconectado' | 'conectando' | 'aguardando_qr'
  numeroConectado: string | null
  nomePerfil: string | null
  conectadoEm: string | null
  qrDisponivel: boolean
  estatisticas: {
    mensagensRecebidas: number
    mensagensEnviadas: number
    pedidosNotificados: number
  }
  automacao: {
    botAtivo: boolean
    iaAtiva: boolean
    iaDisponivel: boolean
    provedores: unknown
  }
  operacao: {
    conversas24h: number
    rascunhosAtivos: number
    humanTakeoverAtivo: number
    outboxPendentes: number
    outboxFalhas: number
    filas: { conversations: number; pending: number; running: number }
    atualizadoEm: string | null
  }
}

type RespostaStatusBot = {
  sucesso: boolean
  dados?: StatusBot
  erro?: string
  detalhes?: string
}

type RespostaQrCode = {
  sucesso: boolean
  temQrCode?: boolean
  qrCode?: string
  erro?: string
}

type RespostaPareamento = {
  sucesso: boolean
  codigo?: string
  erro?: string
}

type RespostaAcao = {
  sucesso: boolean
  erro?: string
  mensagem?: string
}

type Funcionario = {
  id: string
  nome: string
  telefone: string | null
  tipo: string
  ativo: boolean
  recebe_mensagem: boolean | null
}

type DiagnosticoBot = {
  status: 'online' | 'erro'
  codigoHttp: number
  duracaoMs: number
  mensagem: string
}

type AcaoBot = 'status' | 'qr' | 'pareamento' | 'reconectar' | 'desconectar' | 'limpar' | 'diagnostico' | 'funcionarios'

const buscarJson = async <T,>(url: string, init?: RequestInit, timeoutMs = 8000): Promise<T> => {
  const resposta = await fetch(url, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })

  const dados = await resposta.json().catch(() => null) as T | null
  if (!resposta.ok) {
    const erro = dados && typeof dados === 'object' && 'erro' in dados
      ? String((dados as { erro?: unknown }).erro || `Erro HTTP ${resposta.status}`)
      : `Erro HTTP ${resposta.status}`
    throw new Error(erro)
  }

  if (!dados) {
    throw new Error('Resposta vazia do servidor do bot.')
  }

  return dados
}

const formatarDataHora = (valor: string | null) => {
  if (!valor) return 'Ainda sem registro'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'Ainda sem registro'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data)
}

const statusVisual = (status?: StatusBot['status']) => {
  if (status === 'conectado') {
    return {
      texto: 'Conectado',
      descricao: 'Sessão ativa',
      icon: Wifi,
    }
  }

  if (status === 'aguardando_qr') {
    return {
      texto: 'Aguardando pareamento',
      descricao: 'Escaneie o QR ou use o código',
      icon: QrCode,
    }
  }

  if (status === 'conectando') {
    return {
      texto: 'Conectando',
      descricao: 'Tentando abrir sessão',
      icon: RefreshCw,
    }
  }

  return {
    texto: 'Desconectado',
    descricao: 'Sessão inativa',
    icon: WifiOff,
  }
}

const normalizarTelefone = (valor: string) => valor.replace(/\D/g, '')

export default function WhatsAppBotPage() {
  const [statusBot, setStatusBot] = useState<StatusBot | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [codigoPareamento, setCodigoPareamento] = useState<string | null>(null)
  const [numeroPareamento, setNumeroPareamento] = useState('')
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [codigoCopiado, setCodigoCopiado] = useState(false)
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<AcaoBot | null>('status')
  const [abaPareamento, setAbaPareamento] = useState<'qr' | 'codigo'>('qr')
  const [diagnostico, setDiagnostico] = useState<DiagnosticoBot | null>(null)
  const [dialogLimparAberto, setDialogLimparAberto] = useState(false)
  const pollingRef = useRef<number | null>(null)

  const visual = statusVisual(statusBot?.status)
  const IconeStatus = visual.icon
  const botConectado = statusBot?.status === 'conectado'

  const funcionariosNotificados = useMemo(
    () => funcionarios.filter((funcionario) => funcionario.recebe_mensagem).length,
    [funcionarios]
  )

  const definirFeedback = (mensagem: string) => {
    setFeedback(mensagem)
    window.setTimeout(() => {
      setFeedback((atual) => (atual === mensagem ? null : atual))
    }, 3200)
  }

  const buscarStatus = useCallback(async () => {
    try {
      const data = await buscarJson<RespostaStatusBot>(`${API_BOT_URL}/status`, undefined, 8000)
      if (!data.sucesso || !data.dados) {
        throw new Error(data.erro || 'Não foi possível ler o status do bot.')
      }

      setStatusBot(data.dados)
      setErro(null)
      return data.dados
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível conectar ao bot.'
      setErro(mensagem)
      return null
    } finally {
      setAcaoEmAndamento((atual) => (atual === 'status' ? null : atual))
    }
  }, [])

  const buscarQrCode = useCallback(async () => {
    try {
      const data = await buscarJson<RespostaQrCode>(`${API_BOT_URL}/qr`, undefined, 8000)
      setQrCode(data.qrCode || null)
    } catch {
      setQrCode(null)
    } finally {
      setAcaoEmAndamento((atual) => (atual === 'qr' ? null : atual))
    }
  }, [])

  const buscarFuncionarios = useCallback(async () => {
    setAcaoEmAndamento((atual) => atual || 'funcionarios')
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome, telefone, tipo, ativo, recebe_mensagem')
        .eq('ativo', true)
        .order('tipo', { ascending: true })
        .order('nome', { ascending: true })

      if (error) throw error
      setFuncionarios(data || [])
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao carregar funcionários.'
      setErro(mensagem)
    } finally {
      setAcaoEmAndamento((atual) => (atual === 'funcionarios' ? null : atual))
    }
  }, [])

  const atualizarTudo = useCallback(async () => {
    setAcaoEmAndamento('status')
    const [status] = await Promise.all([buscarStatus(), buscarFuncionarios()])
    if (status?.status !== 'conectado' && abaPareamento === 'qr') await buscarQrCode()
  }, [abaPareamento, buscarFuncionarios, buscarQrCode, buscarStatus])

  useEffect(() => {
    atualizarTudo()

    pollingRef.current = window.setInterval(() => {
      void buscarStatus()
    }, 15000)

    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current)
      }
    }
  }, [atualizarTudo, buscarStatus])

  useEffect(() => {
    if (botConectado || abaPareamento !== 'qr') return
    const intervaloQr = window.setInterval(() => void buscarQrCode(), 20000)
    return () => window.clearInterval(intervaloQr)
  }, [abaPareamento, botConectado, buscarQrCode])

  const executarAcao = async (acao: Exclude<AcaoBot, 'status' | 'qr' | 'funcionarios' | 'diagnostico'>) => {
    const rotas = {
      reconectar: 'reconectar',
      desconectar: 'desconectar',
      limpar: 'limpar-sessao',
      pareamento: 'parear-numero',
    } as const

    setAcaoEmAndamento(acao)
    setErro(null)

    try {
      const data = await buscarJson<RespostaAcao>(`${API_BOT_URL}/${rotas[acao]}`, { method: 'POST' }, 12000)
      if (!data.sucesso) throw new Error(data.erro || 'Ação recusada pelo bot.')

      definirFeedback(data.mensagem || 'Ação concluída.')
      setCodigoPareamento(null)
      setQrCode(null)
      await atualizarTudo()
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Não foi possível executar a ação.'
      setErro(mensagem)
    } finally {
      setAcaoEmAndamento(null)
      setDialogLimparAberto(false)
    }
  }

  const solicitarPareamento = async () => {
    const numero = normalizarTelefone(numeroPareamento)
    if (numero.length < 10) {
      setErro('Informe o WhatsApp com DDD.')
      return
    }

    setAcaoEmAndamento('pareamento')
    setErro(null)
    setCodigoPareamento(null)

    try {
      const data = await buscarJson<RespostaPareamento>(
        `${API_BOT_URL}/parear-numero`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ numero }),
        },
        12000
      )

      if (!data.sucesso || !data.codigo) throw new Error(data.erro || 'Não foi possível gerar o código.')
      setCodigoPareamento(data.codigo)
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : 'Erro ao gerar código.'
      setErro(mensagem)
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  const copiarCodigo = async () => {
    if (!codigoPareamento) return
    await navigator.clipboard.writeText(codigoPareamento)
    setCodigoCopiado(true)
    window.setTimeout(() => setCodigoCopiado(false), 1800)
  }

  const executarDiagnostico = async () => {
    setAcaoEmAndamento('diagnostico')
    setDiagnostico(null)
    const inicio = Date.now()

    try {
      const data = await buscarJson<RespostaStatusBot>(`${API_BOT_URL}/status`, undefined, 9000)
      setDiagnostico({
        status: data.sucesso ? 'online' : 'erro',
        codigoHttp: data.sucesso ? 200 : 503,
        duracaoMs: Date.now() - inicio,
        mensagem: data.sucesso ? 'Bot respondeu normalmente.' : data.erro || 'Bot respondeu com erro.',
      })
    } catch (error) {
      setDiagnostico({
        status: 'erro',
        codigoHttp: 503,
        duracaoMs: Date.now() - inicio,
        mensagem: error instanceof Error ? error.message : 'Falha no diagnóstico.',
      })
    } finally {
      setAcaoEmAndamento(null)
    }
  }

  const alternarNotificacaoFuncionario = async (funcionario: Funcionario) => {
    const proximoValor = !funcionario.recebe_mensagem

    setFuncionarios((atuais) =>
      atuais.map((item) => item.id === funcionario.id ? { ...item, recebe_mensagem: proximoValor } : item)
    )

    try {
      const { error } = await supabase
        .from('funcionarios')
        .update({ recebe_mensagem: proximoValor })
        .eq('id', funcionario.id)

      if (error) throw error
      void fetch(`${API_BOT_URL}/atualizar-entregadores`, { method: 'POST' })
      definirFeedback('Preferência de notificação atualizada.')
    } catch (error) {
      setFuncionarios((atuais) =>
        atuais.map((item) => item.id === funcionario.id ? { ...item, recebe_mensagem: funcionario.recebe_mensagem } : item)
      )
      setErro(error instanceof Error ? error.message : 'Erro ao atualizar funcionário.')
    }
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5 p-4 sm:p-6">
          <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#25D366]/15 text-[#25D366]">
                <IconeWhatsApp className="size-7" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">WhatsApp</h1>
                <p className="text-sm text-muted-foreground">
                  Sessão da Carol, pareamento e notificações operacionais.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-9 gap-1.5 rounded-lg px-3 font-mono text-[11px] shadow-none">
                <Router className="size-3.5" />
                {BOT_URL_DISPLAY}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="h-9 shadow-none"
                onClick={atualizarTudo}
                disabled={acaoEmAndamento === 'status'}
              >
                <RefreshCw className={cn('mr-2 size-4', acaoEmAndamento === 'status' && 'animate-spin')} />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-3 shadow-sm sm:grid-cols-4 sm:p-4">
            <div className="min-w-0 rounded-lg bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Status</p>
              <div className="mt-1 flex items-center gap-1.5">
                <IconeStatus
                  className={cn(
                    'size-4 shrink-0 text-primary',
                    statusBot?.status === 'conectando' && 'animate-spin',
                  )}
                />
                <p className="truncate text-sm font-semibold text-foreground">{visual.texto}</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{visual.descricao}</p>
            </div>
            <div className="min-w-0 rounded-lg bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Número</p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {statusBot?.numeroConectado || 'Não conectado'}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {statusBot?.nomePerfil || 'Sem perfil ativo'}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Mensagens</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                {statusBot?.estatisticas?.mensagensEnviadas || 0}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {statusBot?.estatisticas?.mensagensRecebidas || 0} recebidas em 24h
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Notificações</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                {funcionariosNotificados}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {statusBot?.estatisticas?.pedidosNotificados || 0} pedidos em 7 dias
              </p>
            </div>
          </div>

          {(erro || feedback) && (
            <div
              className={cn(
                'flex items-start gap-3 rounded-xl border p-3 text-sm',
                erro
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
              )}
            >
              {erro ? (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              )}
              <span className="flex-1">{erro || feedback}</span>
              <button
                type="button"
                onClick={() => {
                  setErro(null)
                  setFeedback(null)
                }}
                aria-label="Fechar aviso"
              >
                <XCircle className="size-4" />
              </button>
            </div>
          )}

          <Tabs defaultValue="conexao" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl sm:grid-cols-4 md:w-fit">
              <TabsTrigger value="conexao" className="gap-2">
                <Wifi className="size-4" />
                Conexão
              </TabsTrigger>
              <TabsTrigger value="notificacoes" className="gap-2">
                <Users className="size-4" />
                Notificações
              </TabsTrigger>
              <TabsTrigger value="jogo" className="gap-2">
                <Trophy className="size-4" />
                Jogo
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="gap-2">
                <Settings className="size-4" />
                Configurações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="conexao" className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
              <Card className="border-border/70 shadow-none">
                <CardHeader className="p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Pareamento</CardTitle>
                      <CardDescription>Use QR Code ou código por número para conectar o WhatsApp.</CardDescription>
                    </div>
                    <Badge variant={botConectado ? 'success' : 'outline'} className="rounded-lg">
                      {botConectado ? 'ativo' : 'precisa conectar'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 p-5 pt-0">
                  {botConectado ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
                        <div>
                          <p className="font-medium">WhatsApp conectado.</p>
                          <p className="text-sm opacity-80">Desde {formatarDataHora(statusBot?.conectadoEm || null)}.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant={abaPareamento === 'qr' ? 'default' : 'outline'} onClick={() => setAbaPareamento('qr')}>
                          <QrCode className="mr-2 size-4" />
                          QR Code
                        </Button>
                        <Button type="button" variant={abaPareamento === 'codigo' ? 'default' : 'outline'} onClick={() => setAbaPareamento('codigo')}>
                          <Phone className="mr-2 size-4" />
                          Código
                        </Button>
                      </div>

                      {abaPareamento === 'qr' ? (
                        <div className="flex flex-col items-center gap-4 rounded-xl border border-border/70 bg-muted/20 p-5">
                          {qrCode ? (
                            <div className="rounded-xl border bg-white p-4">
                              {qrCodeEhImagem(qrCode) ? (
                                <Image src={qrCode} alt="QR Code do WhatsApp" width={220} height={220} unoptimized />
                              ) : (
                                <QRCodeSVG value={qrCode} size={220} />
                              )}
                            </div>
                          ) : (
                            <div className="flex size-[254px] items-center justify-center rounded-xl border border-dashed bg-background">
                              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          <p className="max-w-sm text-center text-sm text-muted-foreground">
                            Abra o WhatsApp, entre em aparelhos conectados e escaneie o código.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
                          <div className="space-y-2">
                            <Label htmlFor="numero-pareamento">Número com DDD</Label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Input
                                id="numero-pareamento"
                                inputMode="tel"
                                value={numeroPareamento}
                                onChange={(event) => setNumeroPareamento(event.target.value)}
                                placeholder="5586999999999"
                              />
                              <Button type="button" onClick={solicitarPareamento} disabled={acaoEmAndamento === 'pareamento'}>
                                <Send className="mr-2 size-4" />
                                Gerar
                              </Button>
                            </div>
                          </div>

                          {codigoPareamento && (
                            <div className="rounded-xl border bg-background p-4">
                              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Código</p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="font-mono text-3xl font-semibold tracking-[0.18em]">{codigoPareamento}</span>
                                <Button type="button" variant="outline" size="icon" onClick={copiarCodigo}>
                                  {codigoCopiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card className="border-border/70 shadow-none">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base">Administração</CardTitle>
                    <CardDescription>Controle direto da sessão e cache da Carol.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2 p-5 pt-0">
                    <Button
                      variant="outline"
                      className="h-11 justify-start shadow-none sm:h-10"
                      onClick={() => executarAcao('reconectar')}
                      disabled={acaoEmAndamento === 'reconectar' || botConectado}
                    >
                      <RefreshCw className={cn('mr-2 size-4', acaoEmAndamento === 'reconectar' && 'animate-spin')} />
                      Reconectar sessão
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 justify-start shadow-none sm:h-10"
                      onClick={() => executarAcao('desconectar')}
                      disabled={acaoEmAndamento === 'desconectar' || !botConectado}
                    >
                      <WifiOff className="mr-2 size-4" />
                      Desconectar WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11 justify-start shadow-none sm:h-10"
                      onClick={executarDiagnostico}
                      disabled={acaoEmAndamento === 'diagnostico'}
                    >
                      <ShieldAlert className="mr-2 size-4" />
                      Testar servidor do bot
                    </Button>
                    <Button
                      variant="destructive"
                      className="h-11 justify-start shadow-none sm:h-10"
                      onClick={() => setDialogLimparAberto(true)}
                      disabled={acaoEmAndamento === 'limpar'}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Limpar sessão
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-none">
                  <CardHeader className="p-5">
                    <CardTitle className="text-base">Diagnóstico</CardTitle>
                    <CardDescription>Última checagem feita pelo painel.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 p-5 pt-0">
                    {diagnostico ? (
                      <>
                        <Badge variant={diagnostico.status === 'online' ? 'success' : 'destructive'} className="rounded-lg">
                          {diagnostico.status === 'online' ? 'online' : 'erro'}
                        </Badge>
                        <p className="text-sm">{diagnostico.mensagem}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          HTTP {diagnostico.codigoHttp} em {diagnostico.duracaoMs}ms
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum teste executado nesta sessão.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="notificacoes">
              <Card className="border-border/70 shadow-none">
                <CardHeader className="p-5">
                  <CardTitle className="text-base">Funcionários notificados</CardTitle>
                  <CardDescription>Quem recebe alertas operacionais enviados pela Carol.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 p-5 pt-0 md:grid-cols-2 xl:grid-cols-3">
                  {funcionarios.length === 0 ? (
                    <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum funcionário ativo encontrado.
                    </div>
                  ) : funcionarios.map((funcionario) => {
                    const ativo = Boolean(funcionario.recebe_mensagem)
                    return (
                      <div key={funcionario.id} className="rounded-xl border border-border/70 bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{funcionario.nome}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{funcionario.telefone || 'Sem telefone'}</p>
                          </div>
                          <Badge variant="outline" className="rounded-lg capitalize">{funcionario.tipo}</Badge>
                        </div>
                        <Button
                          type="button"
                          variant={ativo ? 'default' : 'outline'}
                          size="sm"
                          className="mt-4 w-full"
                          onClick={() => alternarNotificacaoFuncionario(funcionario)}
                        >
                          {ativo ? <Bell className="mr-2 size-4" /> : <BellOff className="mr-2 size-4" />}
                          {ativo ? 'Recebe notificações' : 'Não recebe'}
                        </Button>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jogo">
              <AvisoJogoBot />
            </TabsContent>

            <TabsContent value="configuracoes">
              <ConfiguracoesBot
                automacao={statusBot?.automacao}
                operacao={statusBot?.operacao}
                onAtualizarStatus={buscarStatus}
              />
            </TabsContent>
          </Tabs>
        </div>

        <AlertDialog open={dialogLimparAberto} onOpenChange={setDialogLimparAberto}>
          <AlertDialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
            <AlertDialogHeader className="space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
              <AlertDialogTitle className="text-[15px] font-semibold tracking-tight">
                Limpar sessão do WhatsApp?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[13px]">
                Isso remove a sessão salva e vai exigir um novo pareamento. Use apenas quando o WhatsApp travar ou trocar de aparelho.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
              <AlertDialogCancel className="h-11 w-full shadow-none sm:h-9 sm:w-auto">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="h-11 w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-none sm:h-9 sm:w-auto"
                onClick={() => executarAcao('limpar')}
              >
                Limpar sessão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}
