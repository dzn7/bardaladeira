import type { PedidoLista } from '../../electron/servicos/tipos'

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})

const formatadorHora = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit'
})

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
})

export const formatarDataHora = (valor?: string | null) => {
  if (!valor) return '—'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return formatadorDataHora.format(data)
}

export const formatarHora = (valor?: string | null) => {
  if (!valor) return '—'
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return '—'
  return formatadorHora.format(data)
}

export const formatarMoeda = (valor?: number | null) => formatadorMoeda.format(Number(valor || 0))

export const normalizarTipoEntrega = (tipo?: string | null) => String(tipo || '').trim().toLowerCase()

export const obterNumeroMesa = (pedido: Pick<PedidoLista, 'mesa' | 'mesa_numero'>) => {
  const valorMesa = pedido.mesa_numero ?? pedido.mesa
  if (valorMesa === null || valorMesa === undefined) return null
  const numero = Number(valorMesa)
  if (!Number.isFinite(numero)) return null
  return Math.trunc(numero)
}

export const formatarTipoEntrega = (pedido: PedidoLista) => {
  const tipo = normalizarTipoEntrega(pedido.tipo_entrega)
  const mesa = obterNumeroMesa(pedido)
  const comanda = pedido.comanda ? Number(pedido.comanda) : null

  if (tipo === 'local' || tipo === 'no local') {
    if (pedido.mesa_tipo === 'local_externo' && pedido.mesa_identificador) {
      return pedido.mesa_identificador
    }
    if (comanda && Number.isFinite(comanda)) return `Comanda ${Math.trunc(comanda)}`
    return mesa ? `Mesa ${mesa}` : 'No local'
  }

  if (tipo === 'retirada' || tipo === 'balcao') return 'Retirada'
  if (tipo === 'entrega') return 'Entrega'
  return pedido.tipo_entrega || '—'
}

export const identificarPedido = (pedido: { numero_pedido?: number | null; id: string }) =>
  `#${pedido.numero_pedido ?? pedido.id.slice(0, 8)}`
