'use client'

import { useCallback, useState } from 'react'
import { Clock, Gear, Plus, Storefront, X } from '@phosphor-icons/react'
import { useStatusLoja } from '@/lib/useStatusLoja'
import { cn } from '@/lib/utils'
import { Botao, Cartao, Entrada, Esqueleto, Gaveta, Interruptor, Selo, useConfirmar } from '@/components/admin/ui'

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

  const confirmar = useConfirmar()
  const [processando, setProcessando] = useState(false)
  const [processandoExtensao, setProcessandoExtensao] = useState(false)
  const [mostrarHorarios, setMostrarHorarios] = useState(false)
  const [horarioEditando, setHorarioEditando] = useState<HorarioFuncionamento | null>(null)
  const [salvandoHorario, setSalvandoHorario] = useState(false)

  const formatarHoraExtensao = (data: Date) =>
    data.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    })

  const abrirConfirmacao = async (fechar: boolean) => {
    const ok = await confirmar({
      titulo: fechar ? 'Fechar a loja agora?' : 'Abrir a loja agora?',
      descricao:
        (fechar
          ? 'Clientes não conseguem pedir pelo site/cardápio. O fluxo de WhatsApp continua disponível.'
          : 'Clientes voltam a pedir pelo site e cardápio normalmente.') +
        (horarioAutomatico ? ' O horário automático fica em pausa até o próximo ciclo.' : ''),
      confirmar: fechar ? 'Fechar loja' : 'Abrir loja',
    })
    if (!ok) return
    setProcessando(true)
    await alterarStatusLoja(fechar)
    setProcessando(false)
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
        <Cartao className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Esqueleto className="size-11 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Esqueleto className="h-4 w-36" />
              <Esqueleto className="h-3 w-56" />
            </div>
            <Esqueleto className="h-11 w-24" />
          </div>
        </Cartao>
        <Esqueleto className="h-28 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <Cartao className="overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="relative flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Storefront className={cn('size-5', lojaFechada ? 'text-muted-foreground' : 'text-foreground')} />
                <span
                  className={cn(
                    'absolute -right-0.5 -top-0.5 size-2.5 rounded-full ring-2 ring-card',
                    lojaFechada ? 'bg-destructive' : 'bg-emerald-500',
                  )}
                />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {lojaFechada ? 'Loja fechada' : 'Loja aberta'}
                  </h3>
                  <Selo tom={lojaFechada ? 'perigo' : 'sucesso'}>{lojaFechada ? 'Sem pedidos' : 'Recebendo'}</Selo>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{textoStatus}</p>
              </div>
            </div>

            <Botao
              variante={lojaFechada ? 'primario' : 'contorno'}
              className="h-11 min-w-[120px] sm:h-10"
              onClick={() => void abrirConfirmacao(!lojaFechada)}
              carregando={processando}
            >
              {lojaFechada ? 'Abrir loja' : 'Fechar loja'}
            </Botao>
          </div>

          {erro && (
            <p role="alert" className="border-t border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive sm:px-5">
              {erro}
            </p>
          )}
        </Cartao>

        {prestesAFechar && !lojaFechada && (
          <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-amber-600" />
              <p>
                <span className="font-medium">Fecha em {minutosParaFechar} min</span>
                {fechamentoEstendidoAte && (
                  <span className="text-muted-foreground">
                    {' '}
                    · estendido até {formatarHoraExtensao(fechamentoEstendidoAte)}
                  </span>
                )}
              </p>
            </div>
            <Botao
              variante="contorno"
              className="h-11 sm:h-9"
              onClick={() => void handleEstender()}
              carregando={processandoExtensao}
            >
              {!processandoExtensao && <Plus />}
              Mais 30 min
            </Botao>
          </div>
        )}

        {fechamentoEstendidoAte && !prestesAFechar && !lojaFechada && (
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Clock className="size-4 shrink-0 text-muted-foreground" />
              <p>
                Horário estendido até{' '}
                <span className="font-medium tabular-nums">{formatarHoraExtensao(fechamentoEstendidoAte)}</span>
              </p>
            </div>
            <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
              <Botao
                variante="contorno"
                className="h-11 sm:h-9"
                onClick={() => void handleEstender()}
                disabled={processandoExtensao}
              >
                <Plus />
                Mais 30 min
              </Botao>
              <Botao
                variante="fantasma"
                className="h-11 sm:h-9"
                onClick={() => void handleCancelarExtensao()}
                disabled={processandoExtensao}
              >
                <X />
                Cancelar extensão
              </Botao>
            </div>
          </div>
        )}

        <Cartao className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Horário automático</p>
              <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
                {horarioAutomatico
                  ? 'Abre e fecha sozinho conforme a grade da semana.'
                  : 'Desligado: você abre e fecha a loja na mão.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Botao
                variante="contorno"
                tamanho="icone"
                className="size-11 sm:size-9"
                onClick={abrirEdicaoHorarios}
                aria-label="Editar horários da semana"
              >
                <Gear />
              </Botao>
              <Interruptor
                marcado={horarioAutomatico}
                desabilitado={processando}
                aoMudar={() => void handleToggleAutomatico()}
                rotuloAcessivel={horarioAutomatico ? 'Desligar horário automático' : 'Ligar horário automático'}
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
                      'rounded-lg border px-1 py-2 text-center',
                      ehHoje
                        ? 'border-primary/40 bg-primary/5 text-foreground'
                        : 'border-border/60 bg-muted/20 text-muted-foreground',
                      !horario?.ativo && 'opacity-50',
                    )}
                  >
                    <p className="text-xs font-medium">{DIAS_NOMES[dia]}</p>
                    {horario?.ativo ? (
                      <p className="mt-1 text-[11px] tabular-nums leading-tight">
                        {horario.abrir}
                        <br />
                        {horario.fechar}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px]">Fechado</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {!horarioAutomatico && (
            <p className="mt-3 text-[13px] leading-5 text-muted-foreground">
              Ligue o automático para a loja seguir a grade da semana. A engrenagem define o horário de cada dia.
            </p>
          )}

          {horarioAutomatico && modoManual && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-amber-700 dark:text-amber-400">
              <span className="inline-flex size-1.5 rounded-full bg-amber-500" />
              Você abriu ou fechou na mão. O automático volta no próximo horário.
            </p>
          )}
        </Cartao>
      </div>

      <Gaveta
        aberto={mostrarHorarios}
        aoFechar={() => setMostrarHorarios(false)}
        bloqueada={salvandoHorario}
        titulo="Horários da semana"
        descricao="Horário de Brasília. Vale quando o automático está ligado."
        rodape={
          <>
            <Botao variante="contorno" onClick={() => setMostrarHorarios(false)} disabled={salvandoHorario}>
              Cancelar
            </Botao>
            <Botao onClick={() => void handleSalvarHorarios()} carregando={salvandoHorario}>
              Salvar horários
            </Botao>
          </>
        }
      >
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
          {horarioEditando &&
            DIAS_ORDEM.map((dia) => {
              const horario = horarioEditando[dia]
              return (
                <li key={dia} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Interruptor
                    marcado={horario.ativo}
                    aoMudar={() => atualizarDia(dia, 'ativo', !horario.ativo)}
                    rotuloAcessivel={`${DIAS_COMPLETOS[dia]} ${horario.ativo ? 'aberto' : 'fechado'}`}
                  />
                  <span className="min-w-20 flex-1 text-sm font-medium text-foreground">{DIAS_COMPLETOS[dia]}</span>
                  {horario.ativo ? (
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <Entrada
                        type="time"
                        value={horario.abrir}
                        onChange={(e) => atualizarDia(dia, 'abrir', e.target.value)}
                        className="tabular-nums sm:w-28"
                        aria-label={`Abertura ${DIAS_COMPLETOS[dia]}`}
                      />
                      <span className="text-sm text-muted-foreground">até</span>
                      <Entrada
                        type="time"
                        value={horario.fechar}
                        onChange={(e) => atualizarDia(dia, 'fechar', e.target.value)}
                        className="tabular-nums sm:w-28"
                        aria-label={`Fechamento ${DIAS_COMPLETOS[dia]}`}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </li>
              )
            })}
        </ul>
      </Gaveta>
    </>
  )
}
