'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { Botao, Gaveta } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { formatarMoeda, formatarPercentual, formatarPontos } from '../lib/periodo'
import { taxaFechamento, taxaQualidade } from '../lib/metricas'
import type { ConfigProdutividade, GarcomProdutividade } from '../types'

type Props = {
  garcom: GarcomProdutividade | null
  config: ConfigProdutividade
  rotuloPeriodo: string
  onFechar: () => void
}

type LinhaComposicao = {
  rotulo: string
  quantidade: number
  peso: number
  total: number
  negativo?: boolean
}

export function DetalheGarcomDialog({ garcom, config, rotuloPeriodo, onFechar }: Props) {
  const router = useRouter()

  // Guarda o último garçom para o conteúdo não sumir durante a animação de fechar.
  const [ultimo, setUltimo] = useState<GarcomProdutividade | null>(garcom)
  useEffect(() => {
    if (garcom) setUltimo(garcom)
  }, [garcom])

  const atual = garcom ?? ultimo

  const composicao = useMemo<LinhaComposicao[]>(() => {
    if (!atual) return []

    const criadosValidos = Math.max(atual.pedidosCriados - atual.pedidosCancelados, 0)

    const linhas: LinhaComposicao[] = [
      {
        rotulo: 'Pedidos criados',
        quantidade: criadosValidos,
        peso: config.pontos_pedido_criado,
        total: criadosValidos * config.pontos_pedido_criado,
      },
      {
        rotulo: 'Pedidos entregues',
        quantidade: atual.pedidosFechados,
        peso: config.pontos_pedido_fechado,
        total: atual.pedidosFechados * config.pontos_pedido_fechado,
      },
      {
        rotulo: 'Itens adicionados',
        quantidade: atual.itensAdicionados,
        peso: config.pontos_item_adicionado,
        total: atual.itensAdicionados * config.pontos_item_adicionado,
      },
      {
        rotulo: 'Pedidos editados',
        quantidade: atual.edicoes,
        peso: config.pontos_pedido_editado,
        total: atual.edicoes * config.pontos_pedido_editado,
      },
      {
        rotulo: 'Cadastros completos',
        quantidade: atual.cadastrosCompletos,
        peso: config.bonus_cadastro_completo,
        total: atual.cadastrosCompletos * config.bonus_cadastro_completo,
      },
      {
        rotulo: 'Sem nome do cliente',
        quantidade: atual.ocorrenciasNome,
        peso: config.penalidade_nome_generico,
        total: atual.ocorrenciasNome * config.penalidade_nome_generico,
        negativo: true,
      },
      {
        rotulo: 'Sem telefone/endereço',
        quantidade: atual.ocorrenciasContato,
        peso: config.penalidade_contato_ausente,
        total: atual.ocorrenciasContato * config.penalidade_contato_ausente,
        negativo: true,
      },
      {
        rotulo: 'Pedidos cancelados',
        quantidade: atual.pedidosCancelados,
        peso: config.penalidade_pedido_cancelado,
        total: atual.pedidosCancelados * config.penalidade_pedido_cancelado,
        negativo: true,
      },
    ]

    return linhas.filter((linha) => linha.quantidade > 0 && linha.peso > 0)
  }, [atual, config])

  if (!atual) return null

  const qualidade = taxaQualidade(atual)

  return (
    <Gaveta
      aberto={Boolean(garcom)}
      aoFechar={onFechar}
      titulo={
        <span className="flex items-center gap-3">
          <AvatarUsuario nome={atual.nome} src={atual.avatarUrl} cor={atual.corAvatar} size="md" />
          <span className="min-w-0 truncate">{atual.nome}</span>
        </span>
      }
      descricao={`${rotuloPeriodo} · ${formatarPontos(atual.pontos)} pontos`}
      rodape={
        <>
          <Botao
            variante="contorno"
            onClick={() => router.push(`/admin/garcons/${atual.garcomId}/pedidos`)}
          >
            Ver pedidos do garçom
          </Botao>
          <Botao onClick={onFechar}>Fechar</Botao>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { rotulo: 'Criados', valor: String(atual.pedidosCriados) },
          { rotulo: 'Entregues', valor: formatarPercentual(taxaFechamento(atual)) },
          { rotulo: 'Vendas', valor: formatarMoeda(atual.vendas) },
          { rotulo: 'Sem falha', valor: formatarPercentual(qualidade) },
        ].map((item) => (
          <div key={item.rotulo} className="rounded-lg border border-border/70 p-3">
            <dt className="text-[13px] text-muted-foreground">{item.rotulo}</dt>
            <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">
              {item.valor}
            </dd>
          </div>
        ))}
      </dl>

      <h3 className="mt-6 text-sm font-semibold text-foreground">Como os pontos foram formados</h3>
      <div className="mt-2 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70">
        {composicao.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Sem movimentação registrada neste período.
          </p>
        ) : (
          composicao.map((linha) => (
            <div key={linha.rotulo} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-foreground">{linha.rotulo}</p>
                <p className="text-[13px] tabular-nums text-muted-foreground">
                  {linha.quantidade} × {formatarPontos(linha.peso)} pts
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-sm font-medium tabular-nums',
                  linha.negativo ? 'text-destructive' : 'text-foreground',
                )}
              >
                {linha.negativo ? '−' : '+'}
                {formatarPontos(linha.total)}
              </span>
            </div>
          ))
        )}

        <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
          <span className="text-sm font-medium text-foreground">Total</span>
          <span className="text-base font-semibold tabular-nums text-foreground">
            {formatarPontos(atual.pontos)} pts
          </span>
        </div>
      </div>

      {atual.pedidosAbertos > 0 ? (
        <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          {atual.pedidosAbertos}{' '}
          {atual.pedidosAbertos === 1 ? 'pedido continua' : 'pedidos continuam'} sem ser
          encerrado neste período. Pedido aberto não desconta pontos, mas segura a mesa e o
          fechamento do caixa.
        </p>
      ) : null}
    </Gaveta>
  )
}
