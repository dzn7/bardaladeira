import { memo, useDeferredValue, useMemo, useState } from 'react'
import { ChefHat, Inbox, Receipt, Search } from 'lucide-react'
import type { PedidoLista, TipoFilaImpressao } from '../../../electron/servicos/tipos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ListaVazia, Painel, PainelCabecalho } from '@/components/ui/painel'
import {
  formatarHora,
  formatarMoeda,
  formatarTipoEntrega,
  identificarPedido
} from '@/dominio/formatacao'

type Props = {
  pedidos: PedidoLista[]
  aoImprimir: (pedidoId: string, tipo: TipoFilaImpressao) => void
}

const variantePorStatus = (status?: string | null) => {
  const valor = String(status || '').toLowerCase()
  if (valor === 'entregue' || valor === 'concluido' || valor === 'concluído') return 'sucesso' as const
  if (valor === 'cancelado') return 'erro' as const
  if (valor === 'pendente' || valor === 'aguardando') return 'aviso' as const
  return 'neutro' as const
}

const normalizar = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const LinhaPedido = memo(({ pedido, aoImprimir }: { pedido: PedidoLista; aoImprimir: Props['aoImprimir'] }) => (
  <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 transition-colors hover:bg-accent/50">
    <span className="w-20 shrink-0 font-mono text-sm font-medium tabular-nums text-foreground">
      {identificarPedido(pedido)}
    </span>

    <div className="min-w-[9rem] flex-1">
      <p className="truncate text-sm text-foreground">{pedido.nome_cliente || 'Cliente'}</p>
      <p className="truncate text-xs text-muted-foreground">
        {formatarTipoEntrega(pedido)} · {formatarHora(pedido.created_at)}
      </p>
    </div>

    <Badge variant={variantePorStatus(pedido.status)} className="shrink-0 capitalize">
      {pedido.status || 'pendente'}
    </Badge>

    <span className="w-24 shrink-0 text-right font-mono text-sm tabular-nums text-foreground">
      {formatarMoeda(pedido.total)}
    </span>

    <div className="flex shrink-0 items-center gap-1.5">
      <Button size="xs" variant="outline" onClick={() => aoImprimir(pedido.id, 'cozinha')}>
        <ChefHat className="h-3.5 w-3.5" />
        Cozinha
      </Button>
      <Button size="xs" onClick={() => aoImprimir(pedido.id, 'cliente')}>
        <Receipt className="h-3.5 w-3.5" />
        Cliente
      </Button>
    </div>
  </li>
))

LinhaPedido.displayName = 'LinhaPedido'

export const TelaPedidos = memo(({ pedidos, aoImprimir }: Props) => {
  const [busca, setBusca] = useState('')
  const buscaAdiada = useDeferredValue(busca)

  const filtrados = useMemo(() => {
    const termo = normalizar(buscaAdiada)
    const base = pedidos.slice(0, 80)
    if (!termo) return base
    return base.filter((pedido) =>
      normalizar(
        `${pedido.numero_pedido ?? ''} ${pedido.nome_cliente ?? ''} ${formatarTipoEntrega(pedido)}`
      ).includes(termo)
    )
  }, [pedidos, buscaAdiada])

  return (
    <Painel>
      <PainelCabecalho
        titulo="Pedidos recentes"
        descricao={`${filtrados.length} de ${pedidos.length} pedidos carregados`}
        icone={<Inbox className="h-4 w-4" />}
        acoes={
          <div className="relative w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar pedido ou cliente"
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
      />

      {filtrados.length === 0 ? (
        <ListaVazia
          icone={<Inbox className="h-6 w-6" />}
          titulo={busca ? 'Nenhum pedido corresponde à busca' : 'Nenhum pedido carregado'}
          descricao={
            busca
              ? 'Ajuste o termo buscado ou limpe o campo.'
              : 'Assim que novos pedidos chegarem, eles aparecem aqui automaticamente.'
          }
        />
      ) : (
        <ul className="divide-y divide-border/50">
          {filtrados.map((pedido) => (
            <LinhaPedido key={pedido.id} pedido={pedido} aoImprimir={aoImprimir} />
          ))}
        </ul>
      )}
    </Painel>
  )
})

TelaPedidos.displayName = 'TelaPedidos'
