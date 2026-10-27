'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { WarningCircle as AlertCircle, Bell, Check, CheckCircle as CheckCircle2, Copy, Phone, QrCode, ArrowsClockwise as RefreshCw, PaperPlaneRight as Send, Gear as Settings, ShieldWarning as ShieldAlert, Trash as Trash2, Trophy, Users, WifiHigh as Wifi, WifiSlash as WifiOff, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import AdminLayout from '@/components/admin/AdminLayout'
import AvisoJogoBot from '@/components/admin/AvisoJogoBot'
import ConfiguracoesBot from '@/components/admin/ConfiguracoesBot'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Chip,
  Entrada,
  Interruptor,
  Lista,
  ListaVazia,
  Pagina,
  Secao,
  Segmentos,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
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

type Aba = 'conexao' | 'notificacoes' | 'jogo' | 'configuracoes'

const ABAS: { valor: Aba; rotulo: string; icone: typeof Wifi }[] = [
  { valor: 'conexao', rotulo: 'Conexão', icone: Wifi },
  { valor: 'notificacoes', rotulo: 'Notificações', icone: Users },
  { valor: 'jogo', rotulo: 'Jogo', icone: Trophy },
  { valor: 'configuracoes', rotulo: 'Configurações', icone: Settings },
]

export default function WhatsAppBotPage() {
  const confirmar = useConfirmar()
  const [aba, setAba] = useState<Aba>('conexao')
  const [statusBot, setStatusBot] = useState<StatusBot | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [codigoPareamento, setCodigoPareamento] = useState<string | null>(null)
  const [numeroPareamento, setNumeroPareamento] = useState('')
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [codigoCopiado, setCodigoCopiado] = useState(false)
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<AcaoBot | null>('status')
  const [abaPareamento, setAbaPareamento] = useState<'qr' | 'codigo'>('qr')
  const [diagnostico, setDiagnostico] = useState<DiagnosticoBot | null>(null)
  const pollingRef = useRef<number | null>(null)

  const visual = statusVisual(statusBot?.status)
  const IconeStatus = visual.icon
  const botConectado = statusBot?.status === 'conectado'

  const funcionariosNotificados = useMemo(
    () => funcionarios.filter((funcionario) => funcionario.recebe_mensagem).length,
    [funcionarios]
  )

  const definirFeedback = (mensagem: string) => {
    toast.success(mensagem)
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

  const pedirLimparSessao = async () => {
    const ok = await confirmar({
      titulo: 'Limpar sessão do WhatsApp?',
      descricao: 'Isso remove a sessão salva e vai pedir um novo pareamento. Use só quando o WhatsApp travar ou trocar de aparelho.',
      confirmar: 'Limpar sessão',
      perigo: true,
    })
    if (ok) await executarAcao('limpar')
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
        <Pagina className="max-w-6xl">
          <CabecalhoPagina
            titulo="WhatsApp"
            descricao="Conexão da Carol, quem recebe avisos e ajustes do bot."
            acoes={
              <Botao variante="contorno" onClick={atualizarTudo} disabled={acaoEmAndamento === 'status'}>
                <RefreshCw className={cn('size-4', acaoEmAndamento === 'status' && 'animate-spin')} />
                Atualizar
              </Botao>
            }
          />

          <Cartao className="flex items-center gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
              <IconeWhatsApp className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{visual.texto}</p>
                <Selo tom={botConectado ? 'sucesso' : statusBot?.status === 'desconectado' || !statusBot ? 'perigo' : 'alerta'}>
                  <IconeStatus className={cn('size-3', statusBot?.status === 'conectando' && 'animate-spin')} />
                  {visual.descricao}
                </Selo>
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {statusBot?.numeroConectado
                  ? `${statusBot.numeroConectado}${statusBot.nomePerfil ? ` · ${statusBot.nomePerfil}` : ''}`
                  : 'Nenhum número conectado'}
              </p>
            </div>
          </Cartao>

          <div className="grid grid-cols-2 gap-3">
            <Cartao className="p-4">
              <p className="text-sm text-muted-foreground">Mensagens enviadas</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {statusBot?.estatisticas?.mensagensEnviadas || 0}
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {statusBot?.estatisticas?.mensagensRecebidas || 0} recebidas em 24h
              </p>
            </Cartao>
            <Cartao className="p-4">
              <p className="text-sm text-muted-foreground">Recebem avisos</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{funcionariosNotificados}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {statusBot?.estatisticas?.pedidosNotificados || 0} pedidos em 7 dias
              </p>
            </Cartao>
          </div>

          {erro && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 flex-1 break-words">{erro}</span>
              <button
                type="button"
                onClick={() => setErro(null)}
                aria-label="Fechar aviso"
                className="-m-2.5 flex size-10 shrink-0 items-center justify-center rounded-lg"
              >
                <X className="size-4" />
              </button>
            </div>
          )}

          <div role="tablist" aria-label="Seções do WhatsApp" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {ABAS.map(({ valor, rotulo, icone: Icone }) => (
              <Chip
                key={valor}
                role="tab"
                aria-selected={aba === valor}
                ativo={aba === valor}
                onClick={() => setAba(valor)}
                className="h-10"
              >
                <Icone className="size-4" />
                {rotulo}
              </Chip>
            ))}
          </div>

          {aba === 'conexao' && (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <Secao
                titulo="Conectar o WhatsApp"
                descricao={botConectado ? undefined : 'Use o QR Code ou um código enviado para o número.'}
              >
                <Cartao className="space-y-4 p-4">
                  {botConectado ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" weight="fill" />
                      <div>
                        <p className="font-medium text-foreground">WhatsApp conectado</p>
                        <p className="text-sm text-muted-foreground">
                          Desde {formatarDataHora(statusBot?.conectadoEm || null)}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Segmentos
                        opcoes={[
                          { valor: 'qr', rotulo: 'QR Code' },
                          { valor: 'codigo', rotulo: 'Código por número' },
                        ]}
                        valor={abaPareamento}
                        aoMudar={setAbaPareamento}
                        rotuloAcessivel="Forma de conectar"
                      />

                      {abaPareamento === 'qr' ? (
                        <div className="flex flex-col items-center gap-3 py-2">
                          {qrCode ? (
                            <div className="rounded-xl border border-border/70 bg-white p-3">
                              {qrCodeEhImagem(qrCode) ? (
                                <Image src={qrCode} alt="QR Code do WhatsApp" width={220} height={220} unoptimized />
                              ) : (
                                <QRCodeSVG value={qrCode} size={220} />
                              )}
                            </div>
                          ) : (
                            <div className="flex size-[246px] max-w-full items-center justify-center rounded-xl border border-dashed border-border/70">
                              <RefreshCw className="size-6 animate-spin text-muted-foreground" />
                            </div>
                          )}
                          <p className="max-w-sm text-center text-sm text-muted-foreground">
                            No celular, abra o WhatsApp, toque em Aparelhos conectados e escaneie o código.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Campo rotulo="Número com DDD" htmlFor="numero-pareamento" ajuda="Com código do país, só números.">
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Entrada
                                id="numero-pareamento"
                                inputMode="tel"
                                value={numeroPareamento}
                                onChange={(event) => setNumeroPareamento(event.target.value)}
                                placeholder="5586999999999"
                              />
                              <Botao
                                tamanho="lg"
                                className="sm:h-10 sm:text-sm"
                                onClick={solicitarPareamento}
                                carregando={acaoEmAndamento === 'pareamento'}
                              >
                                <Send className="size-4" />
                                Gerar código
                              </Botao>
                            </div>
                          </Campo>

                          {codigoPareamento && (
                            <div className="rounded-xl border border-border/70 p-4">
                              <p className="text-sm text-muted-foreground">Digite este código no WhatsApp</p>
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="font-mono text-2xl font-semibold tracking-widest text-foreground sm:text-3xl">
                                  {codigoPareamento}
                                </span>
                                <Botao
                                  variante="contorno"
                                  tamanho="icone"
                                  className="size-11"
                                  onClick={copiarCodigo}
                                  aria-label={codigoCopiado ? 'Código copiado' : 'Copiar código'}
                                >
                                  {codigoCopiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                                </Botao>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </Cartao>
              </Secao>

              <div className="space-y-5">
                <Secao titulo="Sessão" descricao={`Servidor: ${BOT_URL_DISPLAY}`}>
                  <Lista>
                    <li>
                      <button
                        type="button"
                        onClick={() => executarAcao('reconectar')}
                        disabled={acaoEmAndamento === 'reconectar' || botConectado}
                        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
                      >
                        <RefreshCw className={cn('size-4 text-muted-foreground', acaoEmAndamento === 'reconectar' && 'animate-spin')} />
                        Reconectar sessão
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => executarAcao('desconectar')}
                        disabled={acaoEmAndamento === 'desconectar' || !botConectado}
                        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
                      >
                        <WifiOff className="size-4 text-muted-foreground" />
                        Desconectar WhatsApp
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={executarDiagnostico}
                        disabled={acaoEmAndamento === 'diagnostico'}
                        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/40 disabled:opacity-50"
                      >
                        <ShieldAlert className="size-4 text-muted-foreground" />
                        <span className="flex-1">Testar servidor do bot</span>
                        {diagnostico && (
                          <Selo tom={diagnostico.status === 'online' ? 'sucesso' : 'perigo'}>
                            {diagnostico.status === 'online' ? 'Respondendo' : 'Com erro'}
                          </Selo>
                        )}
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => void pedirLimparSessao()}
                        disabled={acaoEmAndamento === 'limpar'}
                        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                      >
                        <Trash2 className="size-4" />
                        Limpar sessão
                      </button>
                    </li>
                  </Lista>
                  {diagnostico ? (
                    <p className="px-1 text-[13px] text-muted-foreground">
                      {diagnostico.mensagem}{' '}
                      <span className="font-mono">HTTP {diagnostico.codigoHttp} · {diagnostico.duracaoMs}ms</span>
                    </p>
                  ) : null}
                </Secao>
              </div>
            </div>
          )}

          {aba === 'notificacoes' && (
            <Secao titulo="Quem recebe avisos" descricao="Funcionários ativos que recebem alertas da Carol pelo WhatsApp.">
              {funcionarios.length === 0 ? (
                <ListaVazia icone={<Bell />} titulo="Nenhum funcionário ativo" descricao="Cadastre a equipe em Funcionários." />
              ) : (
                <Lista>
                  {funcionarios.map((funcionario) => {
                    const ativo = Boolean(funcionario.recebe_mensagem)
                    return (
                      <li key={funcionario.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => alternarNotificacaoFuncionario(funcionario)}
                          onKeyDown={(evento) => {
                            if (evento.key === 'Enter') void alternarNotificacaoFuncionario(funcionario)
                          }}
                          className="flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">{funcionario.nome}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="size-3.5 shrink-0" />
                              <span className="truncate">{funcionario.telefone || 'Sem telefone'}</span>
                              <span aria-hidden>·</span>
                              <span className="capitalize">{funcionario.tipo}</span>
                            </p>
                          </div>
                          <Interruptor
                            marcado={ativo}
                            aoMudar={() => void alternarNotificacaoFuncionario(funcionario)}
                            rotuloAcessivel={`${funcionario.nome} recebe avisos`}
                          />
                        </div>
                      </li>
                    )
                  })}
                </Lista>
              )}
            </Secao>
          )}

          {aba === 'jogo' && <AvisoJogoBot />}

          {aba === 'configuracoes' && (
            <ConfiguracoesBot
              automacao={statusBot?.automacao}
              operacao={statusBot?.operacao}
              onAtualizarStatus={buscarStatus}
            />
          )}
        </Pagina>
      </AdminLayout>
    </ProtectedRoute>
  )
}
