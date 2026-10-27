'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowsClockwise as RefreshCw, Trophy } from '@phosphor-icons/react'
import {
  Botao,
  CabecalhoPagina,
  Cartao,
  Chip,
  Entrada,
  Esqueleto,
  Pagina,
} from '@/components/admin/ui'
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

  const indicadores = [
    { rotulo: 'Pontos', valor: formatarPontos(resumo.pontos) },
    { rotulo: 'Pedidos', valor: String(resumo.criados) },
    {
      rotulo: 'Entregues',
      valor: String(resumo.fechados),
      extra: formatarPercentual(resumo.taxaFechamento),
    },
    { rotulo: 'Vendas', valor: formatarMoeda(resumo.vendas) },
    {
      rotulo: 'Perdidos',
      valor: resumo.perdidos > 0 ? `−${formatarPontos(resumo.perdidos)}` : '0',
      perigo: resumo.perdidos > 0,
    },
  ]

  return (
    <Pagina className="max-w-6xl">
      <CabecalhoPagina
        titulo="Produtividade"
        descricao={`Pontos dos garçons por pedido criado, entregue e bem cadastrado · ${rotuloPeriodo}`}
        acoes={
          <Botao variante="contorno" onClick={() => void recarregar()} disabled={carregando}>
            <RefreshCw className={cn(carregando && 'animate-spin')} />
            Atualizar
          </Botao>
        }
      />

      <div className="space-y-3">
        <div
          role="group"
          aria-label="Período analisado"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {PERIODOS.map((item) => (
            <Chip
              key={item.valor}
              ativo={periodo === item.valor}
              onClick={() => setPeriodo(item.valor)}
              className="h-10"
            >
              {item.rotulo}
            </Chip>
          ))}
        </div>

        {periodo === 'personalizado' ? (
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:flex sm:flex-wrap">
            <Entrada
              type="date"
              value={personalizado.de}
              max={personalizado.ate}
              onChange={(evento) =>
                setPersonalizado((anterior) => ({ ...anterior, de: evento.target.value }))
              }
              className="sm:w-[170px]"
              aria-label="Data inicial"
            />
            <span className="text-sm text-muted-foreground">até</span>
            <Entrada
              type="date"
              value={personalizado.ate}
              min={personalizado.de}
              max={diaBrasilia(new Date())}
              onChange={(evento) =>
                setPersonalizado((anterior) => ({ ...anterior, ate: evento.target.value }))
              }
              className="sm:w-[170px]"
              aria-label="Data final"
            />
          </div>
        ) : null}
      </div>

      <Cartao className="p-4 md:p-5">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {carregando
            ? Array.from({ length: 6 }).map((_, indice) => (
                <div key={indice} className="space-y-1.5">
                  <Esqueleto className="h-4 w-16" />
                  <Esqueleto className="h-6 w-14" />
                </div>
              ))
            : (
                <>
                  {indicadores.map((item) => (
                    <div key={item.rotulo} className="min-w-0">
                      <dt className="text-sm text-muted-foreground">{item.rotulo}</dt>
                      <dd
                        className={cn(
                          'mt-0.5 truncate text-xl font-semibold tabular-nums',
                          item.perigo ? 'text-destructive' : 'text-foreground',
                        )}
                      >
                        {item.valor}
                        {item.extra ? (
                          <span className="ml-1 text-sm font-normal text-muted-foreground">
                            {item.extra}
                          </span>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                  {resumo.lider ? (
                    <div className="min-w-0">
                      <dt className="text-sm text-muted-foreground">Líder</dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Trophy className="size-4 shrink-0 text-amber-500" weight="fill" />
                        <span className="truncate">{resumo.lider.nome}</span>
                      </dd>
                    </div>
                  ) : null}
                </>
              )}
        </dl>

        {erro ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {erro}
          </p>
        ) : null}
      </Cartao>

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
    </Pagina>
  )
}
