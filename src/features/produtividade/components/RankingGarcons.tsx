'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Medal, Trophy, Users } from 'lucide-react'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { cn } from '@/lib/utils'
import { formatarMoeda, formatarPercentual, formatarPontos } from '../lib/periodo'
import { seloQualidade as selo, taxaFechamento, taxaQualidade } from '../lib/metricas'
import type { GarcomProdutividade } from '../types'

type Ordenacao = 'pontos' | 'vendas' | 'pedidos' | 'qualidade'

type Props = {
  garcons: GarcomProdutividade[]
  carregando: boolean
  onAbrirDetalhe: (garcom: GarcomProdutividade) => void
}

const CORES_POSICAO = [
  'text-amber-500',
  'text-zinc-400',
  'text-orange-700 dark:text-orange-500',
]

export function RankingGarcons({ garcons, carregando, onAbrirDetalhe }: Props) {
  const router = useRouter()
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('pontos')
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set())

  const ordenados = useMemo(() => {
    const lista = [...garcons]
    lista.sort((a, b) => {
      if (ordenacao === 'vendas') return b.vendas - a.vendas
      if (ordenacao === 'pedidos') return b.pedidosCriados - a.pedidosCriados
      if (ordenacao === 'qualidade') return taxaQualidade(b) - taxaQualidade(a)
      return b.pontos - a.pontos
    })
    return lista
  }, [garcons, ordenacao])

  // Quem não trabalhou no período não disputa o ranking, mas continua listado no fim.
  const { lista, idsEmAtividade, totalEmAtividade } = useMemo(() => {
    const ativos = ordenados.filter((g) => g.pedidosCriados > 0 || g.itensAdicionados > 0)
    const ids = new Set(ativos.map((g) => g.garcomId))
    return {
      lista: [...ativos, ...ordenados.filter((g) => !ids.has(g.garcomId))],
      idsEmAtividade: ids,
      totalEmAtividade: ativos.length,
    }
  }, [ordenados])

  const alternarAccordion = (id: string) => {
    setAbertos((anterior) => {
      const proximo = new Set(anterior)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })
  }

  const acoes = (garcom: GarcomProdutividade): MenuAcaoItem[] => [
    {
      key: 'detalhe',
      label: 'Ver composição dos pontos',
      onSelect: () => onAbrirDetalhe(garcom),
    },
    {
      key: 'pedidos',
      label: 'Ver pedidos do garçom',
      onSelect: () => router.push(`/admin/garcons/${garcom.garcomId}/pedidos`),
    },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-foreground/90">Ranking</span>
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {totalEmAtividade} em atividade
          </span>
        </div>
        <ToggleGroup
          type="single"
          value={ordenacao}
          onValueChange={(valor) => {
            if (valor) setOrdenacao(valor as Ordenacao)
          }}
          aria-label="Ordenar ranking"
          className="flex w-max flex-wrap items-center justify-start gap-2"
        >
          <ToggleGroupItem value="pontos" className={CHIP_FILTRO_DEFAULT}>
            Pontos
          </ToggleGroupItem>
          <ToggleGroupItem value="vendas" className={CHIP_FILTRO_DEFAULT}>
            Vendas
          </ToggleGroupItem>
          <ToggleGroupItem value="pedidos" className={CHIP_FILTRO_DEFAULT}>
            Pedidos
          </ToggleGroupItem>
          <ToggleGroupItem value="qualidade" className={CHIP_FILTRO_DEFAULT}>
            Qualidade
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {carregando ? (
        <TabelaSkeleton linhas={6} />
      ) : lista.length === 0 ? (
        <ListaVazia
          icone={<Users className="h-5 w-5" />}
          titulo="Nenhum garçom cadastrado"
          descricao="Cadastre um usuário com papel Garçom em Usuários."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-3 py-3 text-left text-xs font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Garçom</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Pontos</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Criados</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Fechados</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Itens</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Vendas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Perdidos</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Qualidade</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((garcom, indice) => {
                  const qualidade = taxaQualidade(garcom)
                  const marca = selo(qualidade)
                  const disputa = idsEmAtividade.has(garcom.garcomId)

                  return (
                    <tr
                      key={garcom.garcomId}
                      className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/20"
                      onClick={() => onAbrirDetalhe(garcom)}
                    >
                      <td className="px-3 py-3">
                        {disputa && indice < 3 ? (
                          <Trophy
                            className={cn('h-4 w-4', CORES_POSICAO[indice])}
                            strokeWidth={1.8}
                            aria-label={`${indice + 1}º lugar`}
                          />
                        ) : (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {disputa ? indice + 1 : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <AvatarUsuario
                            nome={garcom.nome}
                            src={garcom.avatarUrl}
                            cor={garcom.corAvatar}
                            size="sm"
                            className="size-9"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{garcom.nome}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              @{garcom.nomeUsuario}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold tabular-nums text-foreground">
                          {formatarPontos(garcom.pontos)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {garcom.pedidosCriados}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-foreground">
                        {garcom.pedidosFechados}
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          {formatarPercentual(taxaFechamento(garcom))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {garcom.itensAdicionados}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                        {formatarMoeda(garcom.vendas)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {garcom.pontosNegativos > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            −{formatarPontos(garcom.pontosNegativos)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            marca.classe,
                          )}
                        >
                          {marca.texto} · {formatarPercentual(qualidade)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(evento) => evento.stopPropagation()}
                      >
                        <MenuAcoes ariaLabel={`Ações de ${garcom.nome}`} items={acoes(garcom)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {lista.map((garcom, indice) => {
              const aberto = abertos.has(garcom.garcomId)
              const qualidade = taxaQualidade(garcom)
              const marca = selo(qualidade)
              const disputa = idsEmAtividade.has(garcom.garcomId)

              return (
                <div
                  key={garcom.garcomId}
                  className="overflow-hidden rounded-xl border border-border/70 bg-background"
                >
                  <button
                    type="button"
                    onClick={() => alternarAccordion(garcom.garcomId)}
                    className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-muted/20"
                    aria-expanded={aberto}
                    aria-controls={`produtividade-garcom-${garcom.garcomId}`}
                  >
                    <span className="flex w-6 shrink-0 justify-center">
                      {disputa && indice < 3 ? (
                        <Medal
                          className={cn('h-4 w-4', CORES_POSICAO[indice])}
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {disputa ? indice + 1 : '—'}
                        </span>
                      )}
                    </span>
                    <AvatarUsuario
                      nome={garcom.nome}
                      src={garcom.avatarUrl}
                      cor={garcom.corAvatar}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{garcom.nome}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {garcom.pedidosCriados} pedidos · {formatarMoeda(garcom.vendas)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-base font-semibold tabular-nums text-foreground">
                        {formatarPontos(garcom.pontos)}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">pts</p>
                    </div>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                        aberto && 'rotate-180',
                      )}
                      strokeWidth={1.6}
                    />
                  </button>

                  {aberto ? (
                    <div
                      id={`produtividade-garcom-${garcom.garcomId}`}
                      className="border-t border-border/60 px-3.5 pb-3.5 pt-3"
                    >
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          marca.classe,
                        )}
                      >
                        {marca.texto} · {formatarPercentual(qualidade)} sem falha
                      </span>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Fechados
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">
                            {garcom.pedidosFechados}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Em aberto
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">
                            {garcom.pedidosAbertos}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Itens
                          </p>
                          <p className="mt-0.5 text-sm font-semibold tabular-nums">
                            {garcom.itensAdicionados}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            Perdidos
                          </p>
                          <p
                            className={cn(
                              'mt-0.5 text-sm font-semibold tabular-nums',
                              garcom.pontosNegativos > 0 && 'text-rose-600 dark:text-rose-400',
                            )}
                          >
                            {garcom.pontosNegativos > 0
                              ? `−${formatarPontos(garcom.pontosNegativos)}`
                              : '0'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="h-9 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
                          onClick={() => onAbrirDetalhe(garcom)}
                        >
                          Ver composição
                        </button>
                        <MenuAcoes ariaLabel={`Ações de ${garcom.nome}`} items={acoes(garcom)} />
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}
