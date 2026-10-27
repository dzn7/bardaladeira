'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { WarningCircle as AlertCircle, CaretDown as ChevronDown, Coins, FloppyDisk as Save } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  Botao,
  Campo,
  Cartao,
  Entrada,
  LinhaInterruptor,
  ListaCarregando,
  Secao,
  Segmentos,
  Selecao,
  Selo,
} from '@/components/admin/ui'
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
    toast.success(mensagem)
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
    return <ListaCarregando linhas={3} />
  }

  const statusIa = !iaAtiva ? 'IA pausada' : automacao?.iaDisponivel ? 'IA disponível' : 'Sem provedor disponível'

  return (
    <div className="space-y-6 pb-20">
      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{erro}</span>
        </div>
      )}

      <Secao titulo="Atendimento automático" descricao="Pause tudo ou só a IA. As conversas continuam registradas.">
        <div className="space-y-2">
          <LinhaInterruptor
            titulo="Carol responde clientes"
            descricao={
              botAtivo
                ? 'Pause em manutenção, instabilidade ou troca de sessão.'
                : 'Pausada: as conversas ficam salvas, mas a Carol não responde.'
            }
            marcado={botAtivo}
            desabilitado={alternandoBot}
            aoMudar={() => void alternarAutomacao('bot_ativo')}
            rotuloAcessivel="Carol responde clientes"
          />
          <LinhaInterruptor
            titulo="IA conversacional"
            descricao="Se pausar, pedidos, preços e regras fixas continuam funcionando."
            marcado={iaAtiva}
            desabilitado={alternandoIa}
            aoMudar={() => void alternarAutomacao('ia_conversa_ativa')}
            rotuloAcessivel="IA conversacional"
          />
        </div>
      </Secao>

      <Secao titulo="Horário e entrega" descricao="Usados nas respostas automáticas.">
        <Cartao className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Abre às" htmlFor="horario-abertura">
              <Entrada
                id="horario-abertura"
                type="time"
                value={config.horario_abertura}
                onChange={(event) => atualizarCampo('horario_abertura', event.target.value)}
              />
            </Campo>
            <Campo rotulo="Fecha às" htmlFor="horario-fechamento">
              <Entrada
                id="horario-fechamento"
                type="time"
                value={config.horario_fechamento}
                onChange={(event) => atualizarCampo('horario_fechamento', event.target.value)}
              />
            </Campo>
          </div>
          <Campo rotulo="Fuso horário" htmlFor="bot-timezone">
            <Selecao
              id="bot-timezone"
              value={config.bot_timezone}
              onChange={(event) => atualizarCampo('bot_timezone', event.target.value)}
            >
              {TIMEZONES_BR.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </Selecao>
          </Campo>
          <Campo
            rotulo="Tempo de entrega (minutos)"
            htmlFor="tempo-entrega"
            ajuda={`O cliente lê: "tempo estimado de entrega em ${config.tempo_entrega_estimado || '20-30'} minutos".`}
          >
            <Entrada
              id="tempo-entrega"
              value={config.tempo_entrega_estimado}
              onChange={(event) => atualizarCampo('tempo_entrega_estimado', event.target.value)}
              placeholder="20-30"
            />
          </Campo>
        </Cartao>
      </Secao>

      <Secao titulo="PIX" descricao="O que a Carol envia quando o cliente pede a chave.">
        <Cartao className="space-y-4 p-4">
          <Campo rotulo="Tipo da chave">
            <Segmentos
              opcoes={TIPOS_CHAVE_PIX.map((tipo) => ({ valor: tipo, rotulo: tipo }))}
              valor={config.pix_tipo_chave}
              aoMudar={(valor) => atualizarCampo('pix_tipo_chave', valor)}
              rotuloAcessivel="Tipo da chave PIX"
            />
          </Campo>
          <Campo rotulo="Chave PIX" htmlFor="pix-chave">
            <Entrada
              id="pix-chave"
              value={config.pix_chave}
              onChange={(event) => atualizarCampo('pix_chave', event.target.value)}
              placeholder="Chave PIX"
              autoComplete="off"
            />
          </Campo>
          <div className="grid gap-4 md:grid-cols-2">
            <Campo rotulo="Titular" htmlFor="pix-nome">
              <Entrada
                id="pix-nome"
                value={config.pix_nome}
                onChange={(event) => atualizarCampo('pix_nome', event.target.value)}
                placeholder="Nome ou razão social"
              />
            </Campo>
            <Campo rotulo="Banco" htmlFor="pix-banco">
              <Entrada
                id="pix-banco"
                value={config.pix_banco}
                onChange={(event) => atualizarCampo('pix_banco', event.target.value)}
                placeholder="Banco"
              />
            </Campo>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <p>Chave {config.pix_tipo_chave}: {config.pix_chave || '-'}</p>
            <p>Titular: {config.pix_nome || '-'}</p>
            <p>Banco: {config.pix_banco || '-'}</p>
          </div>
        </Cartao>
      </Secao>

      <Secao
        titulo="IA e operação"
        descricao="Uso desde o último reinício do bot."
        acao={<Selo tom={automacao?.iaDisponivel ? 'sucesso' : iaAtiva ? 'perigo' : 'neutro'}>{statusIa}</Selo>}
      >
        <div className="space-y-3">
          <Cartao className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 sm:grid-cols-4">
            {[
              { rotulo: 'Chamadas', valor: totalChamadasIa },
              { rotulo: 'Tokens', valor: totalTokensIa },
              { rotulo: 'Falhas', valor: totalFalhasIa },
              { rotulo: 'Conversas em 24h', valor: operacao?.conversas24h || 0 },
            ].map((item) => (
              <div key={item.rotulo}>
                <p className="text-[13px] text-muted-foreground">{item.rotulo}</p>
                <p className="text-lg font-semibold tabular-nums text-foreground">{formatadorNumero.format(item.valor)}</p>
              </div>
            ))}
          </Cartao>

          <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
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
              const detalhes = [
                {
                  rotulo: 'Chamadas',
                  valor: formatadorNumero.format(runtime?.requests || 0),
                  extra: `${runtime?.successes || 0} sucessos · ${runtime?.failures || 0} falhas`,
                },
                {
                  rotulo: 'Tempo médio de resposta',
                  valor: `${formatadorNumero.format(mediaMs)} ms`,
                  extra: `total ${formatadorNumero.format(runtime?.total_latency_ms || 0)} ms`,
                },
                {
                  rotulo: 'Tokens de entrada',
                  valor: formatadorNumero.format(runtime?.prompt_tokens || 0),
                  extra: `sem cache: ${formatadorNumero.format(custo.tokensEntradaSemCache)}`,
                },
                {
                  rotulo: 'Tokens em cache',
                  valor: formatadorNumero.format(runtime?.cache_hit_tokens || 0),
                  extra: 'cobrados com tarifa reduzida',
                },
                {
                  rotulo: 'Tokens de saída',
                  valor: formatadorNumero.format(runtime?.completion_tokens || 0),
                  extra: `total: ${formatadorNumero.format((runtime?.prompt_tokens || 0) + (runtime?.completion_tokens || 0))}`,
                },
                {
                  rotulo: 'Última atividade',
                  valor: formatarInstanteIa(runtime?.last_request_at),
                  extra: `último sucesso: ${formatarInstanteIa(runtime?.last_success_at)}`,
                },
              ]
              return (
                <details key={provedor.id} className="group">
                  <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{provedor.nome}</p>
                        <Selo tom={dados?.available ? 'sucesso' : 'neutro'}>
                          {!dados?.configured ? 'Não configurado' : dados.available ? 'Disponível' : 'Indisponível'}
                        </Selo>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {dados?.model || 'Modelo não informado'} · média {mediaMs}ms
                      </p>
                    </div>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="space-y-3 border-t border-border/70 px-4 py-4">
                    <div>
                      <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                        <Coins className="size-3.5" /> Gasto estimado desde o reinício
                      </p>
                      <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-foreground">
                        {custo.disponivel && custo.totalUsd !== null ? formatarCustoUsd(custo.totalUsd) : 'Indisponível'}
                      </p>
                      <p className="text-[13px] text-muted-foreground">
                        {custo.disponivel && custo.preco
                          ? `Tarifa por 1M: entrada US$ ${custo.preco.entrada} · cache US$ ${custo.preco.cache} · saída US$ ${custo.preco.saida}`
                          : 'O modelo atual não tem tarifa cadastrada para estimativa.'}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-3">
                      {detalhes.map((item) => (
                        <div key={item.rotulo} className="min-w-0">
                          <dt className="text-[13px] text-muted-foreground">{item.rotulo}</dt>
                          <dd className="text-sm font-medium tabular-nums text-foreground">{item.valor}</dd>
                          <dd className="truncate text-xs text-muted-foreground">{item.extra}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </details>
              )
            })}
          </div>

          <div className="space-y-1 px-1 text-[13px] text-muted-foreground">
            <p>Fila: {operacao?.filas.pending || 0} pendentes</p>
            <p>Saída de mensagens: {operacao?.outboxPendentes || 0} pendentes · {operacao?.outboxFalhas || 0} falhas</p>
            <p>Atendimento humano: {operacao?.humanTakeoverAtivo || 0} ativo</p>
          </div>
        </div>
      </Secao>

      {temAlteracoes && (
        <div className="sticky bottom-4 z-20 flex justify-end">
          <Botao tamanho="lg" className="shadow-lg" onClick={salvarConfiguracoes} carregando={salvando}>
            {!salvando && <Save className="size-4" />}
            Salvar alterações
          </Botao>
        </div>
      )}
    </div>
  )
}
