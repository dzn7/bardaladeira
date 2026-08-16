'use client'

import { useCallback, useState } from 'react'
import {
  AlertTriangle,
  Check,
  Clock,
  Loader2,
  Plus,
  Settings,
  Store,
  StoreIcon,
  X,
} from 'lucide-react'
import { useStatusLoja } from '@/lib/useStatusLoja'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

const DIAS_NOMES: Record<string, string> = {
  domingo: 'Dom',
  segunda: 'Seg',
  terca: 'Ter',
  quarta: 'Qua',
  quinta: 'Qui',
  sexta: 'Sex',
  sabado: 'Sáb',
}

const DIAS_COMPLETOS: Record<string, string> = {
  domingo: 'Domingo',
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sábado',
}

const DIAS_ORDEM = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'] as const

type HorarioDia = {
  abrir: string
  fechar: string
  ativo: boolean
}

type HorarioFuncionamento = {
  domingo: HorarioDia
  segunda: HorarioDia
  terca: HorarioDia
  quarta: HorarioDia
  quinta: HorarioDia
  sexta: HorarioDia
  sabado: HorarioDia
}

const TogglePill = ({
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  ariaLabel: string
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={ariaLabel}
    disabled={disabled}
    onClick={onChange}
    className={cn(
      'relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
      checked ? 'bg-primary' : 'bg-muted-foreground/30',
    )}
  >
    <span
      className={cn(
        'absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow-sm transition-transform',
        checked && 'translate-x-5',
      )}
    />
  </button>
)

export default function ControleStatusLoja() {
  const {
    lojaFechada,
    carregando,
    erro,
    alterarStatusLoja,
    horarioAutomatico,
    horarioFuncionamento,
    horarioHoje,
    fechamentoEstendidoAte,
    prestesAFechar,
    minutosParaFechar,
    modoManual,
    alterarHorarioAutomatico,
    salvarHorarioFuncionamento,
    estenderFechamento,
    cancelarExtensao,
  } = useStatusLoja()

  const [processando, setProcessando] = useState(false)
  const [processandoExtensao, setProcessandoExtensao] = useState(false)
  const [modalConfirmacao, setModalConfirmacao] = useState(false)
  const [acaoPendente, setAcaoPendente] = useState<boolean | null>(null)
  const [mostrarHorarios, setMostrarHorarios] = useState(false)
  const [horarioEditando, setHorarioEditando] = useState<HorarioFuncionamento | null>(null)
  const [salvandoHorario, setSalvandoHorario] = useState(false)

  const formatarHoraExtensao = (data: Date) =>
    data.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    })

  const handleAlterarStatus = async () => {
    if (acaoPendente === null) return
    setProcessando(true)
    setModalConfirmacao(false)
    await alterarStatusLoja(acaoPendente)
    setProcessando(false)
    setAcaoPendente(null)
  }

  const abrirConfirmacao = (fechar: boolean) => {
    setAcaoPendente(fechar)
    setModalConfirmacao(true)
  }

  const handleEstender = async () => {
    setProcessandoExtensao(true)
    await estenderFechamento(30)
    setProcessandoExtensao(false)
  }

  const handleCancelarExtensao = async () => {
    setProcessandoExtensao(true)
    await cancelarExtensao()
    setProcessandoExtensao(false)
  }

  const handleToggleAutomatico = async () => {
    setProcessando(true)
    await alterarHorarioAutomatico(!horarioAutomatico)
    setProcessando(false)
  }

  const abrirEdicaoHorarios = () => {
    if (horarioFuncionamento) {
      setHorarioEditando({ ...horarioFuncionamento })
    } else {
      const padrao: HorarioDia = { abrir: '18:00', fechar: '23:00', ativo: true }
      setHorarioEditando({
        domingo: { ...padrao },
        segunda: { ...padrao },
        terca: { ...padrao },
        quarta: { ...padrao },
        quinta: { ...padrao },
        sexta: { ...padrao },
        sabado: { ...padrao },
      })
    }
    setMostrarHorarios(true)
  }

  const handleSalvarHorarios = async () => {
    if (!horarioEditando) return
    setSalvandoHorario(true)
    await salvarHorarioFuncionamento(horarioEditando)
    setSalvandoHorario(false)
    setMostrarHorarios(false)
  }

  const atualizarDia = useCallback((dia: string, campo: keyof HorarioDia, valor: string | boolean) => {
    setHorarioEditando((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        [dia]: { ...prev[dia as keyof HorarioFuncionamento], [campo]: valor },
      }
    })
  }, [])

  const diaSemanaAtual = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'][
    new Date().getDay()
  ]

  const textoStatus = lojaFechada
    ? 'Pedidos pelo site e cardápio desativados'
    : horarioAutomatico && horarioHoje?.ativo
      ? `Recebendo pedidos · fecha às ${
          fechamentoEstendidoAte
            ? formatarHoraExtensao(fechamentoEstendidoAte)
            : horarioHoje.fechar
        }`
      : 'Recebendo pedidos pelo site e WhatsApp'

  if (carregando) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-11 w-24" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex size-11 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/40">
                {lojaFechada ? (
                  <StoreIcon className="size-5 text-muted-foreground" strokeWidth={1.6} />
                ) : (
                  <Store className="size-5 text-foreground" strokeWidth={1.6} />
                )}
                <span
                  className={cn(
                    'absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-card',
                    lojaFechada ? 'bg-destructive' : 'bg-emerald-500',
                  )}
                >
                  {!lojaFechada && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60" />
                  )}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {lojaFechada ? 'Loja fechada' : 'Loja aberta'}
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-5 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide shadow-none',
                      lojaFechada
                        ? 'border-destructive/30 bg-destructive/10 text-destructive'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                    )}
                  >
                    {lojaFechada ? 'Offline' : 'Online'}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{textoStatus}</p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant={lojaFechada ? 'default' : 'outline'}
              className="h-11 min-w-[120px] shadow-none sm:h-10"
              onClick={() => abrirConfirmacao(!lojaFechada)}
              disabled={processando}
            >
              {processando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : lojaFechada ? (
                'Abrir loja'
              ) : (
                'Fechar loja'
              )}
            </Button>
          </div>

          {erro && (
            <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2.5 text-xs text-destructive sm:px-5">
              {erro}
            </div>
          )}
        </div>

        {prestesAFechar && !lojaFechada && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-amber-600" strokeWidth={1.6} />
              <p>
                <span className="font-semibold">Fecha em {minutosParaFechar} min</span>
                {fechamentoEstendidoAte && (
                  <span className="text-muted-foreground">
                    {' '}
                    · estendido até {formatarHoraExtensao(fechamentoEstendidoAte)}
                  </span>
                )}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 shadow-none sm:h-9"
              onClick={() => void handleEstender()}
              disabled={processandoExtensao}
            >
              {processandoExtensao ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              +30 min
            </Button>
          </div>
        )}

        {fechamentoEstendidoAte && !prestesAFechar && !lojaFechada && (
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
              <p>
                Horário estendido até{' '}
                <span className="font-mono font-semibold">
                  {formatarHoraExtensao(fechamentoEstendidoAte)}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shadow-none sm:h-9"
                onClick={() => void handleEstender()}
                disabled={processandoExtensao}
              >
                <Plus className="size-3.5" />
                +30 min
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 sm:h-9"
                onClick={() => void handleCancelarExtensao()}
                disabled={processandoExtensao}
              >
                <X className="size-3.5" />
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" strokeWidth={1.6} />
                <p className="text-sm font-semibold text-foreground">Horário automático</p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {horarioAutomatico
                  ? 'Abre e fecha sozinho conforme a grade da semana'
                  : 'Desligado — você abre e fecha a loja manualmente'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shadow-none sm:size-9"
                onClick={abrirEdicaoHorarios}
                aria-label="Editar horários da semana"
              >
                <Settings className="size-4" strokeWidth={1.6} />
              </Button>
              <TogglePill
                checked={horarioAutomatico}
                disabled={processando}
                onChange={() => void handleToggleAutomatico()}
                ariaLabel={
                  horarioAutomatico
                    ? 'Desligar horário automático'
                    : 'Ligar horário automático'
                }
              />
            </div>
          </div>

          {horarioAutomatico && horarioFuncionamento && (
            <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
              {DIAS_ORDEM.map((dia) => {
                const horario = horarioFuncionamento[dia]
                const ehHoje = dia === diaSemanaAtual
                return (
                  <div
                    key={dia}
                    className={cn(
                      'rounded-lg border px-1 py-2 text-center transition-colors',
                      ehHoje
                        ? 'border-primary/40 bg-primary/5 text-foreground'
                        : 'border-border/60 bg-muted/20 text-muted-foreground',
                      !horario?.ativo && 'opacity-45',
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide">
                      {DIAS_NOMES[dia]}
                    </p>
                    {horario?.ativo ? (
                      <p className="mt-1 font-mono text-[10px] tabular-nums leading-tight opacity-90 sm:text-[11px]">
                        {horario.abrir}
                        <br />
                        {horario.fechar}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] opacity-70">Fechado</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!horarioAutomatico && (
            <p className="mt-3 text-xs text-muted-foreground">
              Ative o automático para a loja seguir a grade semanal. Use o botão de
              engrenagem para definir abertura e fechamento de cada dia.
            </p>
          )}

          {horarioAutomatico && modoManual && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <span className="inline-flex size-1.5 rounded-full bg-amber-500" />
              Override manual ativo — o automático volta no próximo ciclo.
            </p>
          )}
        </div>
      </div>

      <AlertDialog
        open={modalConfirmacao}
        onOpenChange={(open) => {
          if (!open) {
            setModalConfirmacao(false)
            setAcaoPendente(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" />
              {acaoPendente ? 'Fechar a loja agora?' : 'Abrir a loja agora?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {acaoPendente
                ? 'Clientes não conseguem pedir pelo site/cardápio. O fluxo de WhatsApp continua disponível.'
                : 'Clientes voltam a pedir pelo site e cardápio normalmente.'}
              {horarioAutomatico
                ? ' O horário automático fica em pausa até o próximo ciclo.'
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 sm:h-9">Cancelar</AlertDialogCancel>
            <AlertDialogAction className="h-11 sm:h-9" onClick={() => void handleAlterarStatus()}>
              <Check className="size-4" />
              {acaoPendente ? 'Fechar loja' : 'Abrir loja'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={mostrarHorarios} onOpenChange={setMostrarHorarios}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 pb-4 pt-5 text-left">
            <DialogTitle className="text-base font-semibold">
              Horários de funcionamento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Grade da semana · fuso Brasília. Usada quando o automático está ligado.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
            {horarioEditando &&
              DIAS_ORDEM.map((dia) => {
                const horario = horarioEditando[dia]
                return (
                  <div
                    key={dia}
                    className={cn(
                      'flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-3',
                      horario.ativo
                        ? 'border-border/70 bg-card'
                        : 'border-border/50 bg-muted/30 opacity-80',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <TogglePill
                        checked={horario.ativo}
                        onChange={() => atualizarDia(dia, 'ativo', !horario.ativo)}
                        ariaLabel={`${DIAS_COMPLETOS[dia]} ${horario.ativo ? 'aberto' : 'fechado'}`}
                      />
                      <span className="w-20 text-sm font-medium text-foreground">
                        {DIAS_COMPLETOS[dia]}
                      </span>
                    </div>

                    {horario.ativo ? (
                      <div className="flex flex-1 items-center gap-2 sm:justify-end">
                        <input
                          type="time"
                          value={horario.abrir}
                          onChange={(e) => atualizarDia(dia, 'abrir', e.target.value)}
                          className="h-11 w-full max-w-[120px] rounded-md border border-border/70 bg-background px-2 font-mono text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                          aria-label={`Abertura ${DIAS_COMPLETOS[dia]}`}
                        />
                        <span className="text-xs text-muted-foreground">até</span>
                        <input
                          type="time"
                          value={horario.fechar}
                          onChange={(e) => atualizarDia(dia, 'fechar', e.target.value)}
                          className="h-11 w-full max-w-[120px] rounded-md border border-border/70 bg-background px-2 font-mono text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                          aria-label={`Fechamento ${DIAS_COMPLETOS[dia]}`}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground sm:ml-auto">Fechado</span>
                    )}
                  </div>
                )
              })}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-4 py-3 sm:px-5">
            <Button
              type="button"
              variant="ghost"
              className="h-11 sm:h-9"
              onClick={() => setMostrarHorarios(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 sm:h-9"
              onClick={() => void handleSalvarHorarios()}
              disabled={salvandoHorario}
            >
              {salvandoHorario ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
