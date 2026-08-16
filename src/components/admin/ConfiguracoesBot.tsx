'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertCircle, Bot, BrainCircuit, CheckCircle2, ChevronDown, Clock, Coins, CreditCard, Globe, Loader2, Power, PowerOff, Save, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { calcularCustoEstimadoIa } from '@/lib/ai-usage.mjs'
import { supabase } from '@/lib/supabase'

type ConfiguracoesState = {
  horario_abertura: string
  horario_fechamento: string
  bot_ativo: string
  ia_conversa_ativa: string
  bot_timezone: string
  tempo_entrega_estimado: string
  pix_chave: string
  pix_tipo_chave: string
  pix_nome: string
  pix_banco: string
}

type MetricasIaRuntime = {
  requests?: number
  successes?: number
  failures?: number
  prompt_tokens?: number
  completion_tokens?: number
  cache_hit_tokens?: number
  cache_miss_tokens?: number
  total_latency_ms?: number
  last_request_at?: string | null
  last_success_at?: string | null
  last_error_at?: string | null
}

type ProvedorIa = {
  configured?: boolean
  enabled?: boolean
  available?: boolean
  model?: string
  unavailable_until?: string | null
  last_unavailable_reason?: string | null
  runtime?: MetricasIaRuntime
}

type ConfiguracoesBotProps = {
  automacao?: {
    botAtivo: boolean
    iaAtiva: boolean
    iaDisponivel: boolean
    provedores: unknown
  }
  operacao?: {
    conversas24h: number
    rascunhosAtivos: number
    humanTakeoverAtivo: number
    outboxPendentes: number
    outboxFalhas: number
    filas: { conversations: number; pending: number; running: number }
    atualizadoEm: string | null
  }
  onAtualizarStatus?: () => Promise<unknown>
}

const TIMEZONES_BR = [
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { value: 'America/Recife', label: 'Recife (UTC-3)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
]

const TIPOS_CHAVE_PIX = ['CNPJ', 'CPF', 'Email', 'Telefone', 'Aleatória']

const VALORES_PADRAO: ConfiguracoesState = {
  horario_abertura: '18:00',
  horario_fechamento: '23:00',
  bot_ativo: 'true',
  ia_conversa_ativa: 'true',
  bot_timezone: 'America/Fortaleza',
  tempo_entrega_estimado: '20-30',
  pix_chave: '',
  pix_tipo_chave: 'CNPJ',
  pix_nome: '',
  pix_banco: '',
}

const API_BOT_URL = '/api/bot'
const CHAVES_CONFIGURACAO = [...Object.keys(VALORES_PADRAO), 'pix_tipo']

const DESCRICOES_CONFIGURACAO: Partial<Record<keyof ConfiguracoesState | 'pix_tipo', string>> = {
  horario_abertura: 'Horário de abertura usado pela Carol',
  horario_fechamento: 'Horário de fechamento usado pela Carol',
  bot_ativo: 'Controla se a Carol responde automaticamente',
  ia_conversa_ativa: 'Controla o uso de IA sem interromper o fluxo determinístico',
  bot_timezone: 'Fuso horário usado pela Carol',
  tempo_entrega_estimado: 'Tempo estimado de entrega informado aos clientes',
  pix_chave: 'Chave PIX informada pela Carol',
  pix_tipo_chave: 'Tipo da chave PIX exibida no painel',
  pix_tipo: 'Tipo da chave PIX usado pelo bot',
  pix_nome: 'Titular da chave PIX',
  pix_banco: 'Banco da chave PIX',
}

const formatadorNumero = new Intl.NumberFormat('pt-BR')

const formatarCustoUsd = (valor: number) => {
  if (valor === 0) return 'US$ 0,00'
  const casas = valor < 0.01 ? 6 : 4
  return `US$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}`
}

const formatarInstanteIa = (valor?: string | null) => {
  if (!valor) return 'nenhum registro'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return 'data inválida'
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ConfiguracoesBot({ automacao, operacao, onAtualizarStatus }: ConfiguracoesBotProps) {
  const [config, setConfig] = useState<ConfiguracoesState>(VALORES_PADRAO)
  const [configOriginal, setConfigOriginal] = useState<ConfiguracoesState>(VALORES_PADRAO)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [alternandoBot, setAlternandoBot] = useState(false)
  const [alternandoIa, setAlternandoIa] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const botAtivo = config.bot_ativo === 'true'
  const iaAtiva = config.ia_conversa_ativa === 'true'
  const provedores = (automacao?.provedores && typeof automacao.provedores === 'object'
    ? automacao.provedores
    : {}) as Record<string, ProvedorIa>
  const provedoresLista = [
    { id: 'deepseek', nome: 'DeepSeek', dados: provedores.deepseek },
    { id: 'openai', nome: 'OpenAI', dados: provedores.openai },
  ]
  const totalChamadasIa = provedoresLista.reduce((total, provedor) => total + Number(provedor.dados?.runtime?.requests || 0), 0)
  const totalFalhasIa = provedoresLista.reduce((total, provedor) => total + Number(provedor.dados?.runtime?.failures || 0), 0)
  const totalTokensIa = provedoresLista.reduce((total, provedor) => total +
    Number(provedor.dados?.runtime?.prompt_tokens || 0) + Number(provedor.dados?.runtime?.completion_tokens || 0), 0)
  const temAlteracoes = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(configOriginal),
    [config, configOriginal]
  )

  const exibirSucesso = (mensagem: string) => {
    setSucesso(mensagem)
    window.setTimeout(() => {
      setSucesso((atual) => atual === mensagem ? null : atual)
    }, 3000)
  }

  const carregarConfiguracoes = useCallback(async () => {
    setCarregando(true)
    setErro(null)

    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('chave, valor')
        .in('chave', CHAVES_CONFIGURACAO)

      if (error) throw error

      const novoEstado: ConfiguracoesState = { ...VALORES_PADRAO }
      const mapa = new Map((data || []).map((item: { chave: string; valor: string | null }) => [item.chave, item.valor || '']))

      data?.forEach((item: { chave: string; valor: string | null }) => {
        if (item.chave in novoEstado) {
          novoEstado[item.chave as keyof ConfiguracoesState] = item.valor || ''
        }
      })

      if (!mapa.has('pix_tipo_chave') && mapa.has('pix_tipo')) {
        novoEstado.pix_tipo_chave = mapa.get('pix_tipo') || VALORES_PADRAO.pix_tipo_chave
      }

      setConfig(novoEstado)
      setConfigOriginal(novoEstado)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar configurações.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarConfiguracoes()
  }, [carregarConfiguracoes])

  const atualizarCampo = (chave: keyof ConfiguracoesState, valor: string) => {
    setConfig((atual) => ({ ...atual, [chave]: valor }))
  }

  const salvarConfiguracaoPorChave = async (
    chave: keyof ConfiguracoesState | 'pix_tipo',
    valor: string,
    tipo = 'string'
  ) => {
    const agora = new Date().toISOString()
    const payload = {
      chave,
      valor,
      tipo,
      descricao: DESCRICOES_CONFIGURACAO[chave] || null,
      updated_at: agora,
    }

    const { error: erroUpdate } = await supabase
      .from('configuracoes_loja')
      .update(payload)
      .eq('chave', chave)

    if (erroUpdate) throw erroUpdate

    const { data: existente, error: erroSelect } = await supabase
      .from('configuracoes_loja')
      .select('chave')
      .eq('chave', chave)
      .maybeSingle()

    if (erroSelect) throw erroSelect
    if (existente) return

    const { error: erroInsert } = await supabase
      .from('configuracoes_loja')
      .insert(payload)

    if (erroInsert) throw erroInsert
  }

  const salvarConfiguracoes = async () => {
    const chavesAlteradas = Object.keys(config).filter(
      (chave) => config[chave as keyof ConfiguracoesState] !== configOriginal[chave as keyof ConfiguracoesState]
    )

    if (chavesAlteradas.length === 0) return

    setSalvando(true)
    setErro(null)

    try {
      for (const chave of chavesAlteradas) {
        const chaveConfig = chave as keyof ConfiguracoesState
        const tipo = ['bot_ativo', 'ia_conversa_ativa'].includes(chaveConfig) ? 'boolean' : 'string'
        await salvarConfiguracaoPorChave(chaveConfig, config[chaveConfig], tipo)

        if (chaveConfig === 'pix_tipo_chave') {
          await salvarConfiguracaoPorChave('pix_tipo', config.pix_tipo_chave)
        }
      }

      setConfigOriginal({ ...config })
      const respostaRefresh = await fetch(`${API_BOT_URL}/atualizar-entregadores`, { method: 'POST' })
      if (!respostaRefresh.ok) throw new Error('Configurações salvas, mas o bot não confirmou a atualização do cache.')
      await onAtualizarStatus?.()
      exibirSucesso('Configurações salvas.')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar configurações.')
    } finally {
      setSalvando(false)
    }
  }

  const alternarAutomacao = async (chave: 'bot_ativo' | 'ia_conversa_ativa') => {
    const ehBot = chave === 'bot_ativo'
    const ativa = ehBot ? botAtivo : iaAtiva
    const novoValor = ativa ? 'false' : 'true'
    const setAlternando = ehBot ? setAlternandoBot : setAlternandoIa
    setAlternando(true)
    setErro(null)

    try {
      const { error } = await supabase
        .from('configuracoes_loja')
        .upsert({
          chave,
          valor: novoValor,
          tipo: 'boolean',
          descricao: DESCRICOES_CONFIGURACAO[chave] || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'chave' })

      if (error) throw error

      setConfig((atual) => ({ ...atual, [chave]: novoValor }))
      setConfigOriginal((atual) => ({ ...atual, [chave]: novoValor }))

      const respostaRefresh = await fetch(`${API_BOT_URL}/atualizar-entregadores`, { method: 'POST' })
      if (!respostaRefresh.ok) throw new Error('A configuração foi salva, mas o bot não confirmou a atualização do cache.')
      await onAtualizarStatus?.()
      exibirSucesso(ehBot
        ? novoValor === 'true' ? 'Carol ativada.' : 'Carol pausada.'
        : novoValor === 'true' ? 'IA conversacional ativada.' : 'IA conversacional pausada.')
    } catch (error) {
      await carregarConfiguracoes()
      setErro(error instanceof Error ? error.message : 'Erro ao alterar automação.')
    } finally {
      setAlternando(false)
    }
  }

  if (carregando) {
    return (
      <Card className="border-border/70 shadow-none">
        <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando configurações
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {(erro || sucesso) && (
        <div className={cn(
          'flex items-center gap-2 rounded-xl border p-3 text-sm',
          erro
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
        )}>
          {erro ? <AlertCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
          {erro || sucesso}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,0.75fr)_minmax(0,1.25fr)]">
        <Card className="border-border/70 shadow-none">
          <CardHeader className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="size-4" />
                  Automação
                </CardTitle>
                <CardDescription>Pause o atendimento inteiro ou somente o apoio dos modelos.</CardDescription>
              </div>
              <Badge variant={botAtivo ? 'success' : 'destructive'} className="rounded-lg">
                {botAtivo ? 'ativa' : 'pausada'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="text-sm font-medium">{botAtivo ? 'Respondendo clientes' : 'Respostas pausadas'}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {botAtivo
                  ? 'Use pausa em manutenção, instabilidade ou troca de sessão.'
                  : 'As conversas ficam registradas, mas a Carol não responde.'}
              </p>
            </div>
            <Button
              type="button"
              variant={botAtivo ? 'outline' : 'default'}
              className="w-full"
              onClick={() => alternarAutomacao('bot_ativo')}
              disabled={alternandoBot}
            >
              {alternandoBot ? <Loader2 className="mr-2 size-4 animate-spin" /> : botAtivo ? <PowerOff className="mr-2 size-4" /> : <Power className="mr-2 size-4" />}
              {botAtivo ? 'Pausar Carol' : 'Ativar Carol'}
            </Button>

            <Separator />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <BrainCircuit className="size-4" />
                  IA conversacional
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ao pausar, pedidos, preços e regras determinísticas continuam funcionando.
                </p>
              </div>
              <Badge variant={iaAtiva ? 'success' : 'outline'} className="shrink-0 rounded-lg">
                {iaAtiva ? 'ativa' : 'pausada'}
              </Badge>
            </div>
            <Button
              type="button"
              variant={iaAtiva ? 'outline' : 'default'}
              className="w-full"
              onClick={() => alternarAutomacao('ia_conversa_ativa')}
              disabled={alternandoIa}
            >
              {alternandoIa
                ? <Loader2 className="mr-2 size-4 animate-spin" />
                : iaAtiva ? <PowerOff className="mr-2 size-4" /> : <Power className="mr-2 size-4" />}
              {iaAtiva ? 'Pausar somente IA' : 'Ativar IA'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="p-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" />
              Atendimento e entrega
            </CardTitle>
            <CardDescription>Horários e prazo usados nas respostas automáticas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-5 pt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="horario-abertura">Abertura</Label>
                <Input
                  id="horario-abertura"
                  type="time"
                  value={config.horario_abertura}
                  onChange={(event) => atualizarCampo('horario_abertura', event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horario-fechamento">Fechamento</Label>
                <Input
                  id="horario-fechamento"
                  type="time"
                  value={config.horario_fechamento}
                  onChange={(event) => atualizarCampo('horario_fechamento', event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="size-4" />
                  Fuso horário
                </Label>
                <Select value={config.bot_timezone} onValueChange={(valor) => atualizarCampo('bot_timezone', valor)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o fuso" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES_BR.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tempo-entrega" className="flex items-center gap-2">
                  <Timer className="size-4" />
                  Entrega
                </Label>
                <Input
                  id="tempo-entrega"
                  value={config.tempo_entrega_estimado}
                  onChange={(event) => atualizarCampo('tempo_entrega_estimado', event.target.value)}
                  placeholder="20-30"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              Prévia: tempo estimado de entrega em {config.tempo_entrega_estimado || '20-30'} minutos.
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4" />
                IA e operação
              </CardTitle>
              <CardDescription>Saúde dos provedores e uso desde o último reinício do bot.</CardDescription>
            </div>
            <Badge variant={automacao?.iaDisponivel ? 'success' : iaAtiva ? 'destructive' : 'outline'} className="rounded-lg">
              {!iaAtiva ? 'IA pausada' : automacao?.iaDisponivel ? 'IA disponível' : 'sem provedor disponível'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5 pt-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Chamadas</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{totalChamadasIa}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tokens</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{totalTokensIa}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{totalFalhasIa}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conversas em 24h</p>
              <p className="font-mono text-lg font-semibold tabular-nums">{operacao?.conversas24h || 0}</p>
            </div>
          </div>

          <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
            {provedoresLista.map((provedor) => {
              const dados = provedor.dados
              const runtime = dados?.runtime
              const mediaMs = runtime?.requests
                ? Math.round(Number(runtime.total_latency_ms || 0) / runtime.requests)
                : 0
              const custo = calcularCustoEstimadoIa({
                provedor: provedor.id,
                modelo: dados?.model,
                runtime,
              })
              return (
                <details key={provedor.id} className="group bg-card open:bg-muted/10">
                  <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{provedor.nome}</p>
                        <Badge variant={dados?.available ? 'success' : 'outline'} className="rounded-lg">
                          {!dados?.configured ? 'não configurado' : dados.available ? 'disponível' : 'indisponível'}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{dados?.model || 'Modelo não informado'}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {runtime?.successes || 0} sucessos · {runtime?.failures || 0} falhas · média {mediaMs}ms
                      </p>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="border-t border-border/70 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-border/60 bg-background p-3 sm:col-span-2">
                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Coins className="size-3.5" /> Gasto estimado desde o reinício
                        </p>
                        <p className="mt-1 font-mono text-xl font-semibold tabular-nums">
                          {custo.disponivel && custo.totalUsd !== null
                            ? formatarCustoUsd(custo.totalUsd)
                            : 'Indisponível'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {custo.disponivel && custo.preco
                            ? `Tarifa por 1M: entrada US$ ${custo.preco.entrada} · cache US$ ${custo.preco.cache} · saída US$ ${custo.preco.saida}`
                            : 'O modelo atual não possui tarifa cadastrada para estimativa.'}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Chamadas</p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatadorNumero.format(runtime?.requests || 0)}</p>
                        <p className="text-xs text-muted-foreground">{runtime?.successes || 0} sucessos · {runtime?.failures || 0} falhas</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Latência média</p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatadorNumero.format(mediaMs)} ms</p>
                        <p className="text-xs text-muted-foreground">total {formatadorNumero.format(runtime?.total_latency_ms || 0)} ms</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Tokens de entrada</p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatadorNumero.format(runtime?.prompt_tokens || 0)}</p>
                        <p className="text-xs text-muted-foreground">sem cache: {formatadorNumero.format(custo.tokensEntradaSemCache)}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Tokens em cache</p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatadorNumero.format(runtime?.cache_hit_tokens || 0)}</p>
                        <p className="text-xs text-muted-foreground">cobrados com tarifa reduzida</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Tokens de saída</p>
                        <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatadorNumero.format(runtime?.completion_tokens || 0)}</p>
                        <p className="text-xs text-muted-foreground">total: {formatadorNumero.format((runtime?.prompt_tokens || 0) + (runtime?.completion_tokens || 0))}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">Última atividade</p>
                        <p className="mt-1 text-sm font-medium">{formatarInstanteIa(runtime?.last_request_at)}</p>
                        <p className="text-xs text-muted-foreground">último sucesso: {formatarInstanteIa(runtime?.last_success_at)}</p>
                      </div>
                    </div>
                  </div>
                </details>
              )
            })}
          </div>

          <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <p>Fila: {operacao?.filas.pending || 0} pendentes</p>
            <p>Outbox: {operacao?.outboxPendentes || 0} pendentes · {operacao?.outboxFalhas || 0} falhas</p>
            <p>Atendimento humano: {operacao?.humanTakeoverAtivo || 0} ativo</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="p-5">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4" />
            Dados de PIX
          </CardTitle>
          <CardDescription>Informações usadas quando o cliente pede a chave de pagamento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-5 pt-0">
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label>Tipo da chave</Label>
              <Select value={config.pix_tipo_chave} onValueChange={(valor) => atualizarCampo('pix_tipo_chave', valor)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_CHAVE_PIX.map((tipo) => (
                    <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix-chave">Chave PIX</Label>
              <Input
                id="pix-chave"
                value={config.pix_chave}
                onChange={(event) => atualizarCampo('pix_chave', event.target.value)}
                placeholder="Chave PIX"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pix-nome">Titular</Label>
              <Input
                id="pix-nome"
                value={config.pix_nome}
                onChange={(event) => atualizarCampo('pix_nome', event.target.value)}
                placeholder="Nome ou razão social"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pix-banco">Banco</Label>
              <Input
                id="pix-banco"
                value={config.pix_banco}
                onChange={(event) => atualizarCampo('pix_banco', event.target.value)}
                placeholder="Banco"
              />
            </div>
          </div>

          <Separator />

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
            <p className="font-medium">Prévia</p>
            <div className="mt-2 space-y-1 text-muted-foreground">
              <p>Chave {config.pix_tipo_chave}: {config.pix_chave || '-'}</p>
              <p>Titular: {config.pix_nome || '-'}</p>
              <p>Banco: {config.pix_banco || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {temAlteracoes && (
        <div className="sticky bottom-4 z-20 flex justify-end">
          <Button type="button" onClick={salvarConfiguracoes} disabled={salvando}>
            {salvando ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Salvar configurações
          </Button>
        </div>
      )}
    </div>
  )
}
