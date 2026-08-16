'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, List, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { Funcionario } from '@/lib/tipos-caixa'
import { DIARIA_DEMO_ID, useDemoFinancas } from '@/features/onboarding'
import { useDiarias } from '../hooks/useDiarias'
import { formatarMoeda, isoDoDia } from '../lib/formatadores'
import type { FinancasDiaria } from '../types'
import { CalendarioDiarias } from './CalendarioDiarias'
import { ListaDiarias } from './ListaDiarias'
import { ModalDiaria } from './ModalDiaria'

type VistaDiarias = 'calendario' | 'lista'

type PainelDiariasProps = {
  funcionarios: Funcionario[]
  onAlterou?: () => void
  embutido?: boolean
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const inicioFimDoMes = (ano: number, mes: number) => {
  const inicio = new Date(ano, mes - 1, 1)
  const fim = new Date(ano, mes, 0)
  return {
    inicio: isoDoDia(inicio),
    fim: isoDoDia(fim),
    mesReferencia: inicio,
  }
}

const formatarDataLocal = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d))
}

export function PainelDiarias({ funcionarios, onAlterou, embutido = false }: PainelDiariasProps) {
  const agora = new Date()
  const [ano, setAno] = useState(agora.getFullYear())
  const [mes, setMes] = useState(agora.getMonth() + 1)
  const [vista, setVista] = useState<VistaDiarias>('calendario')
  const [modalAberto, setModalAberto] = useState(false)
  const [dataModal, setDataModal] = useState(isoDoDia(agora))
  const [detalhe, setDetalhe] = useState<FinancasDiaria | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const { inicio, fim, mesReferencia } = useMemo(() => inicioFimDoMes(ano, mes), [ano, mes])
  const { diarias, carregando, erro, totalPeriodo, criarDiaria, removerDiaria } = useDiarias({
    inicio,
    fim,
  })

  // Diária de exemplo do onboarding (client-side): entra no calendário/lista
  // REAIS para o tour ter o que destacar. Nunca é gravada no banco.
  const { diaria: diariaDemo } = useDemoFinancas()

  const diariasComDemo = useMemo<FinancasDiaria[]>(() => {
    if (!diariaDemo) return diarias
    const hoje = isoDoDia(new Date())
    // Só aparece quando o mês exibido contém a data de hoje.
    if (hoje < inicio || hoje > fim) return diarias
    const agora = new Date().toISOString()
    const exemplo: FinancasDiaria = {
      id: diariaDemo.id,
      data_referencia: hoje,
      nome_pessoa: diariaDemo.nome_pessoa,
      funcionario_id: null,
      valor: diariaDemo.valor,
      forma_pagamento: diariaDemo.forma_pagamento,
      observacoes: diariaDemo.observacoes,
      movimentacao_id: `${diariaDemo.id}-mov`,
      created_at: agora,
      updated_at: agora,
    }
    return [exemplo, ...diarias]
  }, [diariaDemo, diarias, inicio, fim])

  // Só soma quando a diária de exemplo está realmente visível no mês exibido.
  const exibindoDemo = diariasComDemo.length !== diarias.length
  const totalComDemo = exibindoDemo && diariaDemo ? totalPeriodo + diariaDemo.valor : totalPeriodo

  const handleMudarMes = (data: Date) => {
    setAno(data.getFullYear())
    setMes(data.getMonth() + 1)
  }

  const handleAbrirNova = (dataYmd?: string) => {
    setDataModal(dataYmd || isoDoDia(new Date()))
    setModalAberto(true)
  }

  const handleExcluirDetalhe = async () => {
    if (!detalhe) return
    // Diária de exemplo do tutorial: nada é removido do banco.
    if (detalhe.id === DIARIA_DEMO_ID) {
      setDetalhe(null)
      return
    }
    setExcluindo(true)
    try {
      await removerDiaria(detalhe)
      setDetalhe(null)
      onAlterou?.()
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className={cn('flex w-full min-w-0 flex-col gap-3', !embutido && 'gap-4')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-foreground">
            {MESES[mes - 1]} {ano}
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {carregando
              ? 'Carregando…'
              : `${diariasComDemo.length} diária${diariasComDemo.length === 1 ? '' : 's'} · ${formatarMoeda(totalComDemo)}`}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <ToggleGroup
            type="single"
            value={vista}
            onValueChange={(v) => {
              if (v === 'calendario' || v === 'lista') setVista(v)
            }}
            data-onboarding="financas-diarias-vista"
            className="h-10 w-full rounded-lg border border-border/70 bg-muted/30 p-0.5 sm:w-auto"
          >
            <ToggleGroupItem
              value="calendario"
              aria-label="Visualização em calendário"
              className="h-9 flex-1 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:bg-card data-[state=on]:shadow-sm sm:flex-none"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendário
            </ToggleGroupItem>
            <ToggleGroupItem
              value="lista"
              aria-label="Visualização em lista"
              className="h-9 flex-1 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:bg-card data-[state=on]:shadow-sm sm:flex-none"
            >
              <List className="h-3.5 w-3.5" />
              Lista
            </ToggleGroupItem>
          </ToggleGroup>

          <Button
            type="button"
            data-onboarding="financas-nova-diaria"
            className="h-11 w-full gap-2 sm:h-10 sm:w-auto"
            onClick={() => handleAbrirNova()}
          >
            <Plus strokeWidth={1.6} className="h-4 w-4" />
            Nova diária
          </Button>
        </div>
      </div>

      {erro ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {erro.includes('financas_diarias') || erro.includes('schema cache') || erro.includes('PGRST')
            ? 'Tabela de diárias ainda não existe no banco. Aplique a migration scripts/migrations/20260720_financas_diarias.sql.'
            : erro}
        </div>
      ) : null}

      <div className="w-full min-w-0" data-onboarding="financas-diarias-conteudo">
        {vista === 'calendario' ? (
          <CalendarioDiarias
            diarias={diariasComDemo}
            vista="calendario"
            mesReferencia={mesReferencia}
            onMudarMes={handleMudarMes}
            onCliqueDia={(dataYmd) => handleAbrirNova(dataYmd)}
            onCliqueDiaria={setDetalhe}
          />
        ) : (
          <ListaDiarias
            diarias={diariasComDemo}
            carregando={carregando}
            embutido={embutido}
            onRemover={async (d) => {
              // Diária de exemplo do tutorial: não toca o banco.
              if (d.id === DIARIA_DEMO_ID) return
              await removerDiaria(d)
              onAlterou?.()
            }}
          />
        )}
      </div>

      <ModalDiaria
        funcionarios={funcionarios}
        open={modalAberto}
        onOpenChange={setModalAberto}
        dataInicial={dataModal}
        onSubmit={async (entrada) => {
          await criarDiaria(entrada)
          onAlterou?.()
        }}
      />

      <Dialog open={Boolean(detalhe)} onOpenChange={(aberto) => !aberto && setDetalhe(null)}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="space-y-1 border-b border-border/70 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="text-base font-semibold tracking-tight">
              {detalhe?.nome_pessoa}
            </DialogTitle>
            <DialogDescription className="capitalize text-muted-foreground">
              {detalhe ? formatarDataLocal(detalhe.data_referencia) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Valor pago</span>
              <span className="font-mono text-base font-semibold tabular-nums text-destructive">
                − {formatarMoeda(detalhe?.valor ?? 0)}
              </span>
            </div>
            {detalhe?.forma_pagamento ? (
              <p className="text-sm text-muted-foreground">
                Forma: <span className="text-foreground">{detalhe.forma_pagamento}</span>
              </p>
            ) : null}
            {detalhe?.observacoes ? (
              <p className="text-sm text-muted-foreground">{detalhe.observacoes}</p>
            ) : null}
          </div>
          <DialogFooter className="flex-col gap-2 border-t border-border/70 bg-muted/20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-between sm:px-5">
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full sm:h-9 sm:w-auto"
              onClick={() => setDetalhe(null)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 w-full sm:h-9 sm:w-auto"
              disabled={excluindo}
              onClick={() => void handleExcluirDetalhe()}
            >
              {excluindo ? 'Excluindo…' : 'Excluir diária'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
