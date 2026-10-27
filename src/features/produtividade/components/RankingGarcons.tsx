'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CaretRight, Trophy, Users } from '@phosphor-icons/react'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { Cartao, Chip, ListaCarregando, ListaVazia, Selo } from '@/components/admin/ui'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { cn } from '@/lib/utils'
import { formatarMoeda, formatarPercentual, formatarPontos } from '../lib/periodo'
import { seloQualidade as selo, taxaFechamento, taxaQualidade } from '../lib/metricas'
import type { GarcomProdutividade } from '../types'

type Ordenacao = 'pontos' | 'vendas' | 'pedidos' | 'qualidade'

const ORDENACOES: { valor: Ordenacao; rotulo: string }[] = [
  { valor: 'pontos', rotulo: 'Pontos' },
  { valor: 'vendas', rotulo: 'Vendas' },
  { valor: 'pedidos', rotulo: 'Pedidos' },
  { valor: 'qualidade', rotulo: 'Qualidade' },
]

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
    <Cartao className="overflow-hidden p-4 md:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-foreground">Ranking</h2>
          <Selo className="text-xs">{totalEmAtividade} em atividade</Selo>
        </div>
        <div role="group" aria-label="Ordenar ranking" className="flex flex-wrap gap-2">
          {ORDENACOES.map((item) => (
            <Chip
              key={item.valor}
              ativo={ordenacao === item.valor}
              onClick={() => setOrdenacao(item.valor)}
            >
              {item.rotulo}
            </Chip>
          ))}
        </div>
      </div>

      {carregando ? (
        <ListaCarregando linhas={6} />
      ) : lista.length === 0 ? (
        <ListaVazia
          icone={<Users />}
          titulo="Nenhum garçom cadastrado"
          descricao="Cadastre um usuário com o papel Garçom na tela Usuários."
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
                            className={cn('size-4', CORES_POSICAO[indice])}
                            weight="fill"
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
                          <span className="text-destructive">
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

          <ul className="-mx-4 divide-y divide-border/70 border-t border-border/70 md:hidden">
            {lista.map((garcom, indice) => {
              const qualidade = taxaQualidade(garcom)
              const marca = selo(qualidade)
              const disputa = idsEmAtividade.has(garcom.garcomId)

              return (
                <li key={garcom.garcomId}>
                  <button
                    type="button"
                    onClick={() => onAbrirDetalhe(garcom)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    aria-label={`Ver pontos de ${garcom.nome}`}
                  >
                    <span className="flex w-5 shrink-0 justify-center">
                      {disputa && indice < 3 ? (
                        <Trophy
                          className={cn('size-4', CORES_POSICAO[indice])}
                          weight="fill"
                          aria-label={`${indice + 1}º lugar`}
                        />
                      ) : (
                        <span className="text-sm tabular-nums text-muted-foreground">
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
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] text-muted-foreground">
                          {garcom.pedidosCriados} pedidos · {formatarMoeda(garcom.vendas)}
                        </span>
                        {disputa ? (
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              marca.classe,
                            )}
                          >
                            {marca.texto}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-right text-base font-semibold tabular-nums text-foreground">
                      {formatarPontos(garcom.pontos)}
                      <span className="ml-0.5 text-[13px] font-normal text-muted-foreground">pts</span>
                    </span>
                    <CaretRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Cartao>
  )
}
