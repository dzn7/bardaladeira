'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { cn } from '@/lib/utils'
import { useOcorrencias, useProdutividade } from '../hooks/useProdutividade'
import {
  calcularIntervalo,
  diaBrasilia,
  formatarMoeda,
  formatarPercentual,
  formatarPontos,
  rotularIntervalo,
  type PeriodoPersonalizado,
} from '../lib/periodo'
import type { GarcomProdutividade, PeriodoProdutividade } from '../types'
import { CardMetasProdutividade } from './CardMetasProdutividade'
import { DetalheGarcomDialog } from './DetalheGarcomDialog'
import { GraficoEvolucaoPontos } from './GraficoEvolucaoPontos'
import { GraficoPontosGarcom } from './GraficoPontosGarcom'
import { ListaOcorrencias } from './ListaOcorrencias'
import { ModalConfigPontuacao } from './ModalConfigPontuacao'
import { RankingGarcons } from './RankingGarcons'

const PERIODOS: { valor: PeriodoProdutividade; rotulo: string }[] = [
  { valor: 'dia', rotulo: 'Hoje' },
  { valor: 'semana', rotulo: 'Semana' },
  { valor: 'mes', rotulo: 'Mês' },
  { valor: 'personalizado', rotulo: 'Período' },
]

export default function PainelProdutividade() {
  const [periodo, setPeriodo] = useState<PeriodoProdutividade>('dia')
  const [personalizado, setPersonalizado] = useState<PeriodoPersonalizado>(() => {
    const hoje = diaBrasilia(new Date())
    return { de: hoje, ate: hoje }
  })
  const [garcomSelecionado, setGarcomSelecionado] = useState<GarcomProdutividade | null>(null)
  const [configAberta, setConfigAberta] = useState(false)
  const [filtroOcorrencias, setFiltroOcorrencias] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(15)

  const intervalo = useMemo(
    () => calcularIntervalo(periodo, personalizado),
    [periodo, personalizado],
  )

  const { garcons, serie, serieMes, config, metas, carregando, erro, recarregar, atualizarConfig } =
    useProdutividade(intervalo)

  const ocorrencias = useOcorrencias(intervalo, {
    garcomId: filtroOcorrencias,
    pagina,
    itensPorPagina,
  })

  // Trocar de período ou de garçom invalida a página em que o usuário estava.
  useEffect(() => {
    setPagina(1)
  }, [intervalo, filtroOcorrencias, itensPorPagina])

  const resumo = useMemo(() => {
    const pontos = garcons.reduce((soma, garcom) => soma + garcom.pontos, 0)
    const criados = garcons.reduce((soma, garcom) => soma + garcom.pedidosCriados, 0)
    const fechados = garcons.reduce((soma, garcom) => soma + garcom.pedidosFechados, 0)
    const vendas = garcons.reduce((soma, garcom) => soma + garcom.vendas, 0)
    const perdidos = garcons.reduce((soma, garcom) => soma + garcom.pontosNegativos, 0)
    const lider = garcons.reduce<GarcomProdutividade | null>(
      (melhor, garcom) => (!melhor || garcom.pontos > melhor.pontos ? garcom : melhor),
      null,
    )

    return {
      pontos,
      criados,
      fechados,
      vendas,
      perdidos,
      taxaFechamento: criados > 0 ? (fechados / criados) * 100 : 0,
      lider: lider && lider.pontos > 0 ? lider : null,
    }
  }, [garcons])

  const rotuloPeriodo = rotularIntervalo(intervalo)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <header className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">Produtividade</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pontuação dos garçons por pedido criado, entregue e bem cadastrado · {rotuloPeriodo}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 shadow-none"
            onClick={() => void recarregar()}
            disabled={carregando}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', carregando && 'animate-spin')} />
            Atualizar
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ToggleGroup
            type="single"
            value={periodo}
            onValueChange={(valor) => {
              if (valor) setPeriodo(valor as PeriodoProdutividade)
            }}
            aria-label="Período analisado"
            className="flex w-max flex-wrap items-center justify-start gap-2"
          >
            {PERIODOS.map((item) => (
              <ToggleGroupItem
                key={item.valor}
                value={item.valor}
                className={CHIP_FILTRO_DEFAULT}
              >
                {item.rotulo}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {periodo === 'personalizado' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={personalizado.de}
                max={personalizado.ate}
                onChange={(evento) =>
                  setPersonalizado((anterior) => ({ ...anterior, de: evento.target.value }))
                }
                className="h-9 w-[150px] shadow-none"
                aria-label="Data inicial"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <Input
                type="date"
                value={personalizado.ate}
                min={personalizado.de}
                max={diaBrasilia(new Date())}
                onChange={(evento) =>
                  setPersonalizado((anterior) => ({ ...anterior, ate: evento.target.value }))
                }
                className="h-9 w-[150px] shadow-none"
                aria-label="Data final"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-border/50 pt-4">
          {carregando ? (
            Array.from({ length: 5 }).map((_, indice) => (
              <div key={indice} className="min-w-[86px] space-y-1.5">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-14" />
              </div>
            ))
          ) : (
            <>
              <div className="min-w-[86px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Pontos
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                  {formatarPontos(resumo.pontos)}
                </p>
              </div>
              <div className="min-w-[86px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Pedidos
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                  {resumo.criados}
                </p>
              </div>
              <div className="min-w-[86px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Entregues
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                  {resumo.fechados}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    {formatarPercentual(resumo.taxaFechamento)}
                  </span>
                </p>
              </div>
              <div className="min-w-[110px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Vendas
                </p>
                <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                  {formatarMoeda(resumo.vendas)}
                </p>
              </div>
              <div className="min-w-[86px]">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Perdidos
                </p>
                <p
                  className={cn(
                    'mt-0.5 text-xl font-semibold tabular-nums',
                    resumo.perdidos > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-foreground',
                  )}
                >
                  {resumo.perdidos > 0 ? `−${formatarPontos(resumo.perdidos)}` : '0'}
                </p>
              </div>
              {resumo.lider ? (
                <div className="min-w-[120px]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Líder
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Trophy className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={1.8} />
                    <span className="truncate">{resumo.lider.nome}</span>
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {erro ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        ) : null}
      </header>

      <CardMetasProdutividade
        metas={metas}
        config={config}
        carregando={carregando}
        onAjustarMetas={() => setConfigAberta(true)}
      />

      <RankingGarcons
        garcons={garcons}
        carregando={carregando}
        onAbrirDetalhe={setGarcomSelecionado}
      />

      <GraficoPontosGarcom garcons={garcons} carregando={carregando} />

      <GraficoEvolucaoPontos
        serie={serie}
        serieMes={serieMes}
        garcons={garcons}
        carregando={carregando}
      />

      <ListaOcorrencias
        ocorrencias={ocorrencias.ocorrencias}
        garcons={garcons}
        total={ocorrencias.total}
        totalPaginas={ocorrencias.totalPaginas}
        pagina={pagina}
        itensPorPagina={itensPorPagina}
        garcomId={filtroOcorrencias}
        carregando={ocorrencias.carregando}
        onPaginaChange={setPagina}
        onItensPorPaginaChange={setItensPorPagina}
        onGarcomChange={setFiltroOcorrencias}
      />

      <DetalheGarcomDialog
        garcom={garcomSelecionado}
        config={config}
        rotuloPeriodo={rotuloPeriodo}
        onFechar={() => setGarcomSelecionado(null)}
      />

      <ModalConfigPontuacao
        aberto={configAberta}
        config={config}
        onFechar={() => setConfigAberta(false)}
        onSalvo={(novaConfig) => {
          atualizarConfig(novaConfig)
          void recarregar({ silencioso: true })
        }}
      />
    </div>
  )
}
