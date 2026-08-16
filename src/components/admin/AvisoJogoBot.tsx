'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, Save, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
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
  const [sucesso, setSucesso] = useState<string | null>(null)

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
    setSucesso(null)

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
      setSucesso('Aviso de jogo salvo.')
      window.setTimeout(() => setSucesso(null), 3000)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar aviso de jogo.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <Card className="border-border/70 shadow-none">
        <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando aviso de jogo
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-primary" />
              Aviso de jogo no WhatsApp
            </CardTitle>
            <CardDescription>
              Envia uma vez por contato antes do horário do jogo.
            </CardDescription>
          </div>
          <Badge variant={config.enabled ? 'success' : 'secondary'} className="w-fit rounded-lg">
            {config.enabled ? 'Ativo' : 'Desligado'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-5 pt-0">
        {(erro || sucesso) && (
          <div className={cn(
            'flex items-center gap-2 rounded-lg border p-3 text-sm',
            erro
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
          )}>
            {erro ? <AlertCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0" />}
            {erro || sucesso}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.85fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex min-h-11 items-center gap-2 sm:col-span-2">
              <Checkbox
                id="game-enabled"
                checked={config.enabled}
                onCheckedChange={(checked) => atualizarCampo('enabled', Boolean(checked))}
              />
              <Label htmlFor="game-enabled" className="text-sm font-medium">
                Avisar clientes sobre esse jogo
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="game-team-a">Time 1</Label>
              <Input
                id="game-team-a"
                value={config.team_a}
                onChange={(event) => atualizarCampo('team_a', event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="game-team-b">Time 2</Label>
              <Input
                id="game-team-b"
                value={config.team_b}
                onChange={(event) => atualizarCampo('team_b', event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="game-date">Data</Label>
              <Input
                id="game-date"
                type="date"
                value={config.date}
                onChange={(event) => atualizarCampo('date', event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="game-start">Início</Label>
                <Input
                  id="game-start"
                  type="time"
                  value={config.start_time}
                  onChange={(event) => atualizarCampo('start_time', event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="game-end">Fim</Label>
                <Input
                  id="game-end"
                  type="time"
                  value={config.end_time}
                  onChange={(event) => atualizarCampo('end_time', event.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="game-promo-enabled"
                checked={config.promotion_enabled}
                onCheckedChange={(checked) => atualizarCampo('promotion_enabled', Boolean(checked))}
              />
              <Label htmlFor="game-promo-enabled" className="text-sm font-medium">
                Incluir promoção na mensagem
              </Label>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="game-promo">Promoção</Label>
              <Input
                id="game-promo"
                value={config.promotion_text}
                onChange={(event) => atualizarCampo('promotion_text', event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-muted-foreground" />
              Preview no WhatsApp
            </div>
            <Textarea
              value={preview}
              readOnly
              className="min-h-[132px] resize-none bg-background text-sm"
            />
            <p className="text-xs text-muted-foreground">
              O bot marca o contato como avisado pelo ID desse jogo.
            </p>
            <Button
              type="button"
              onClick={salvarConfig}
              disabled={!temAlteracoes || salvando}
              className="h-11 w-full gap-2 sm:h-10"
            >
              {salvando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Salvar aviso
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
