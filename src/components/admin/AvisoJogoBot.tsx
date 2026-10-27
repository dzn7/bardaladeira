'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { WarningCircle as AlertCircle, FloppyDisk as Save } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Botao, Campo, Cartao, Entrada, LinhaInterruptor, ListaCarregando, Secao, Selo } from '@/components/admin/ui'
import { supabase } from '@/lib/supabase'

type AvisoJogoConfig = {
  enabled: boolean
  event_id: string
  date: string
  start_time: string
  end_time: string
  timezone: string
  team_a: string
  team_b: string
  venue_text: string
  promotion_enabled: boolean
  promotion_text: string
}

const CHAVE_CONFIG = 'bot_game_announcement_json'
const TIMEZONE_PADRAO = 'America/Fortaleza'

function dataLocalHoje(timeZone = TIMEZONE_PADRAO) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value || ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function eventId(config: Pick<AvisoJogoConfig, 'date' | 'team_a' | 'team_b' | 'start_time'>) {
  const slug = `${config.team_a}-${config.team_b}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${config.date}-${slug}-${config.start_time.replace(':', '')}`
}

function configPadrao(): AvisoJogoConfig {
  const base = {
    enabled: true,
    date: dataLocalHoje(),
    start_time: '19:00',
    end_time: '21:30',
    timezone: TIMEZONE_PADRAO,
    team_a: 'Brasil',
    team_b: 'Egito',
    venue_text: 'Aqui no Bar da Ladeira',
    promotion_enabled: true,
    promotion_text: 'Heineken 600ml por R$ 11,99',
  }

  return {
    ...base,
    event_id: eventId(base),
  }
}

function normalizarConfig(valor: unknown): AvisoJogoConfig {
  const padrao = configPadrao()
  if (!valor || typeof valor !== 'object') return padrao

  const bruto = valor as Partial<AvisoJogoConfig>
  const normalizado = {
    ...padrao,
    ...bruto,
    enabled: Boolean(bruto.enabled),
    promotion_enabled: Boolean(bruto.promotion_enabled),
    date: String(bruto.date || padrao.date),
    start_time: String(bruto.start_time || padrao.start_time).slice(0, 5),
    end_time: String(bruto.end_time || padrao.end_time).slice(0, 5),
    team_a: String(bruto.team_a || padrao.team_a),
    team_b: String(bruto.team_b || padrao.team_b),
    venue_text: String(bruto.venue_text || padrao.venue_text),
    promotion_text: String(bruto.promotion_text || padrao.promotion_text),
    timezone: String(bruto.timezone || padrao.timezone),
  }

  return {
    ...normalizado,
    event_id: String(bruto.event_id || eventId(normalizado)),
  }
}

function formatarHora(horario: string) {
  const [hora, minuto] = horario.split(':').map(Number)
  if (!Number.isFinite(hora)) return horario
  if (!minuto) return `${hora}h`
  return `${hora}h${String(minuto).padStart(2, '0')}`
}

function localPreview(config: AvisoJogoConfig) {
  const local = config.venue_text.trim()
  if (!local || local.toLowerCase().includes('edienai')) return 'Aqui no Bar da Ladeira'
  return local
}

function promocaoPreview(config: AvisoJogoConfig) {
  if (!config.promotion_enabled || !config.promotion_text.trim()) return null
  const texto = config.promotion_text.trim().replace(/[.!?]+$/g, '')
  return `🍻 Promo do jogo: ${texto}. gelada no precinho pra acompanhar.`
}

function montarPreview(config: AvisoJogoConfig) {
  const linhas = [
    `⚽ Hoje tem ${config.team_a} x ${config.team_b} às ${formatarHora(config.start_time)}!\nVai ser transmitido aqui: ${localPreview(config)}.`,
    promocaoPreview(config),
  ].filter(Boolean)

  return linhas.join('\n')
}

export default function AvisoJogoBot() {
  const [config, setConfig] = useState<AvisoJogoConfig>(configPadrao)
  const [configOriginal, setConfigOriginal] = useState<AvisoJogoConfig>(configPadrao)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const preview = useMemo(() => montarPreview(config), [config])
  const temAlteracoes = useMemo(
    () => JSON.stringify(config) !== JSON.stringify(configOriginal),
    [config, configOriginal],
  )

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)

    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('valor')
        .eq('chave', CHAVE_CONFIG)
        .maybeSingle()

      if (error) throw error

      const carregada = data?.valor ? normalizarConfig(JSON.parse(data.valor)) : configPadrao()
      setConfig(carregada)
      setConfigOriginal(carregada)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao carregar aviso de jogo.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const atualizarCampo = <K extends keyof AvisoJogoConfig>(chave: K, valor: AvisoJogoConfig[K]) => {
    setConfig((atual) => {
      const proximo = { ...atual, [chave]: valor }
      if (['date', 'team_a', 'team_b', 'start_time'].includes(chave)) {
        proximo.event_id = eventId(proximo)
      }
      return proximo
    })
  }

  const salvarConfig = async () => {
    setSalvando(true)
    setErro(null)

    try {
      const payload = {
        chave: CHAVE_CONFIG,
        valor: JSON.stringify(config),
        tipo: 'json',
        descricao: 'Aviso de jogo exibido uma vez por contato pelo bot',
        updated_at: new Date().toISOString(),
      }

      const { error: erroUpdate } = await supabase
        .from('configuracoes_loja')
        .update(payload)
        .eq('chave', CHAVE_CONFIG)

      if (erroUpdate) throw erroUpdate

      const { data: existente, error: erroSelect } = await supabase
        .from('configuracoes_loja')
        .select('chave')
        .eq('chave', CHAVE_CONFIG)
        .maybeSingle()

      if (erroSelect) throw erroSelect

      if (!existente) {
        const { error: erroInsert } = await supabase
          .from('configuracoes_loja')
          .insert(payload)

        if (erroInsert) throw erroInsert
      }

      setConfigOriginal(config)
      toast.success('Aviso de jogo salvo')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar aviso de jogo.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <ListaCarregando linhas={3} />
  }

  return (
    <Secao
      titulo="Aviso de jogo"
      descricao="A Carol manda uma vez para cada contato, antes do jogo."
      acao={<Selo tom={config.enabled ? 'sucesso' : 'neutro'}>{config.enabled ? 'Ligado' : 'Desligado'}</Selo>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)]">
        <Cartao className="space-y-4 p-4">
          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 break-words">{erro}</span>
            </div>
          )}

          <LinhaInterruptor
            id="game-enabled"
            titulo="Avisar clientes sobre este jogo"
            marcado={config.enabled}
            aoMudar={(marcado) => atualizarCampo('enabled', marcado)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Time 1" htmlFor="game-team-a">
              <Entrada
                id="game-team-a"
                value={config.team_a}
                onChange={(event) => atualizarCampo('team_a', event.target.value)}
              />
            </Campo>
            <Campo rotulo="Time 2" htmlFor="game-team-b">
              <Entrada
                id="game-team-b"
                value={config.team_b}
                onChange={(event) => atualizarCampo('team_b', event.target.value)}
              />
            </Campo>
          </div>

          <Campo rotulo="Data" htmlFor="game-date">
            <Entrada
              id="game-date"
              type="date"
              value={config.date}
              onChange={(event) => atualizarCampo('date', event.target.value)}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Começa às" htmlFor="game-start">
              <Entrada
                id="game-start"
                type="time"
                value={config.start_time}
                onChange={(event) => atualizarCampo('start_time', event.target.value)}
              />
            </Campo>
            <Campo rotulo="Termina às" htmlFor="game-end">
              <Entrada
                id="game-end"
                type="time"
                value={config.end_time}
                onChange={(event) => atualizarCampo('end_time', event.target.value)}
              />
            </Campo>
          </div>

          <LinhaInterruptor
            id="game-promo-enabled"
            titulo="Incluir promoção na mensagem"
            marcado={config.promotion_enabled}
            aoMudar={(marcado) => atualizarCampo('promotion_enabled', marcado)}
          />

          {config.promotion_enabled ? (
            <Campo rotulo="Promoção" htmlFor="game-promo">
              <Entrada
                id="game-promo"
                value={config.promotion_text}
                onChange={(event) => atualizarCampo('promotion_text', event.target.value)}
              />
            </Campo>
          ) : null}
        </Cartao>

        <div className="space-y-3">
          <Cartao className="space-y-2 p-4">
            <p className="text-sm font-medium text-foreground">Como o cliente vai ler</p>
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-sm text-foreground">{preview}</p>
            <p className="text-[13px] text-muted-foreground">
              Cada contato recebe este aviso uma vez por jogo.
            </p>
          </Cartao>
          <Botao
            tamanho="lg"
            className="w-full md:h-10 md:text-sm"
            onClick={salvarConfig}
            disabled={!temAlteracoes}
            carregando={salvando}
          >
            {!salvando && <Save className="size-4" />}
            Salvar aviso
          </Botao>
        </div>
      </div>
    </Secao>
  )
}
