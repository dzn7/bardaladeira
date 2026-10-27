'use client'

import { useMemo, useState } from 'react'
import { CalendarDots as CalendarDays, List, Plus } from '@phosphor-icons/react'
import { Botao, Gaveta, useConfirmar } from '@/components/admin/ui'
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
  const confirmar = useConfirmar()

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
    const ok = await confirmar({
      titulo: 'Excluir diária?',
      descricao: `Sai a diária de ${detalhe.nome_pessoa} e a despesa dela no caixa.`,
      confirmar: 'Excluir',
      perigo: true,
    })
    if (!ok) return
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
          <p className="text-base font-semibold text-foreground">
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

          <Botao
            data-onboarding="financas-nova-diaria"
            className="h-11 w-full sm:h-10 sm:w-auto"
            onClick={() => handleAbrirNova()}
          >
            <Plus className="size-4" />
            Nova diária
          </Botao>
        </div>
      </div>

      {erro ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {erro.includes('financas_diarias') || erro.includes('schema cache') || erro.includes('PGRST')
            ? 'As diárias ainda não estão ativadas no banco. Peça ao suporte para aplicar a migration 20260720_financas_diarias.sql.'
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

      <Gaveta
        aberto={Boolean(detalhe)}
        aoFechar={() => setDetalhe(null)}
        bloqueada={excluindo}
        titulo={detalhe?.nome_pessoa ?? 'Diária'}
        descricao={<span className="capitalize">{detalhe ? formatarDataLocal(detalhe.data_referencia) : ''}</span>}
        rodape={
          <>
            <Botao variante="perigoSuave" className="md:mr-auto" carregando={excluindo} onClick={() => void handleExcluirDetalhe()}>
              Excluir diária
            </Botao>
            <Botao variante="contorno" onClick={() => setDetalhe(null)} disabled={excluindo}>
              Fechar
            </Botao>
          </>
        }
      >
        <dl className="divide-y divide-border/70 text-sm">
          <div className="flex items-center justify-between gap-3 py-3">
            <dt className="text-muted-foreground">Valor pago</dt>
            <dd className="text-base font-semibold tabular-nums text-destructive">− {formatarMoeda(detalhe?.valor ?? 0)}</dd>
          </div>
          {detalhe?.forma_pagamento ? (
            <div className="flex items-center justify-between gap-3 py-3">
              <dt className="text-muted-foreground">Forma</dt>
              <dd className="capitalize text-foreground">{detalhe.forma_pagamento}</dd>
            </div>
          ) : null}
          {detalhe?.observacoes ? (
            <div className="space-y-1 py-3">
              <dt className="text-muted-foreground">Observações</dt>
              <dd className="text-foreground">{detalhe.observacoes}</dd>
            </div>
          ) : null}
        </dl>
      </Gaveta>
    </div>
  )
}
