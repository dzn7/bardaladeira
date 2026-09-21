import { memo, useMemo } from 'react'
import type { ConfiguracaoAplicacao, PedidoLista } from '../../electron/servicos/tipos'
import { Painel, PainelCabecalho } from '@/components/ui/painel'
import { Ticket } from 'lucide-react'
import {
  formatarDataHora,
  formatarMoeda,
  formatarTipoEntrega,
  identificarPedido,
  normalizarTipoEntrega,
  obterNumeroMesa
} from '@/dominio/formatacao'

type Props = {
  pedido: PedidoLista | null
  configuracao: ConfiguracaoAplicacao
}

const Divisor = () => <div className="my-2 border-t border-dashed border-zinc-400" />

export const PreviewTicket = memo(({ pedido, configuracao }: Props) => {
  const resumo = useMemo(() => {
    if (!pedido) return null
    const itens = pedido.itens_pedido || []
    const subtotalItens = itens.reduce((total, item) => total + (item.subtotal || 0), 0)
    const taxaEntrega = Number(pedido.taxa_entrega || 0)
    const taxaServico = Number(pedido.taxa_servico || 0)
    const total = Number(pedido.total ?? subtotalItens + taxaEntrega + taxaServico)
    return { itens, subtotalItens, taxaEntrega, taxaServico, total }
  }, [pedido])

  const larguraPx = Math.min(360, Math.max(220, Number(configuracao.larguraPapelMm || 80) * 3.2))
  const fontePx = Math.max(9, Number(configuracao.tamanhoFonteBasePx || 15) * 0.72)
  const mesa = pedido ? obterNumeroMesa(pedido) : null
  const ehEntrega = pedido ? normalizarTipoEntrega(pedido.tipo_entrega) === 'entrega' : false

  return (
    <Painel className="overflow-hidden">
      <PainelCabecalho
        titulo="Pré-visualização do ticket"
        descricao={pedido ? `Último pedido · ${identificarPedido(pedido)}` : 'Aguardando pedidos'}
        icone={<Ticket className="h-4 w-4" />}
      />

      <div className="flex justify-center bg-surface-raised/60 p-5">
        {!pedido || !resumo ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Nenhum pedido disponível para pré-visualizar.
          </p>
        ) : (
          <div
            data-selecionavel
            className="rounded-md border border-dashed border-zinc-300 bg-white p-4 font-mono leading-relaxed text-zinc-900 shadow-sm"
            style={{
              width: `${larguraPx}px`,
              fontSize: `${fontePx}px`,
              lineHeight: configuracao.espacamentoLinha
            }}
          >
            <div className="mb-1 flex justify-center">
              <img src="./logo.png" alt="" className="h-8 w-8 object-contain" />
            </div>
            <div className="text-center text-[1.25em] font-bold">Bar da Ladeira</div>
            <div className="text-center text-[0.85em] font-bold uppercase tracking-wider">Ticket cliente</div>

            <Divisor />

            <div className="space-y-0.5">
              <p>
                <b>Pedido:</b> {identificarPedido(pedido)}
              </p>
              <p>
                <b>Cliente:</b> {pedido.nome_cliente || 'Cliente'}
              </p>
              <p>
                <b>Entrega:</b> {formatarTipoEntrega(pedido)}
              </p>
              {pedido.mesa_tipo !== 'local_externo' && mesa ? (
                <p>
                  <b>Mesa:</b> {mesa}
                </p>
              ) : null}
              {pedido.comanda ? (
                <p>
                  <b>Comanda:</b> {Number(pedido.comanda)}
                </p>
              ) : null}
              {ehEntrega && pedido.endereco ? (
                <p>
                  <b>Endereço:</b> {pedido.endereco}
                </p>
              ) : null}
              {ehEntrega && pedido.bairro ? (
                <p>
                  <b>Bairro:</b> {pedido.bairro}
                </p>
              ) : null}
              <p>
                <b>Data:</b> {formatarDataHora(pedido.created_at)}
              </p>
            </div>

            <Divisor />

            <div className="font-bold">ITENS</div>
            {resumo.itens.length === 0 ? (
              <p className="italic text-zinc-500">Sem itens</p>
            ) : (
              <div style={{ marginBottom: `${configuracao.espacamentoItensPx}px` }}>
                {resumo.itens.map((item, indice) => (
                  <div key={indice} style={{ marginTop: `${configuracao.espacamentoItensPx / 2}px` }}>
                    <p>
                      <b>{item.quantidade}x</b> {item.nome_item}
                    </p>
                    {(item.item_adicionais || []).map((adicional, indiceAdicional) => (
                      <p key={indiceAdicional} className="pl-4 text-zinc-600">
                        + {adicional.quantidade}x {adicional.nome}
                      </p>
                    ))}
                    {item.observacoes ? (
                      <p className="pl-4 italic text-zinc-500">OBS: {item.observacoes}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <Divisor />

            <p>
              <b>Subtotal:</b> {formatarMoeda(resumo.subtotalItens)}
            </p>
            {resumo.taxaEntrega > 0 ? (
              <p>
                <b>Taxa entrega:</b> {formatarMoeda(resumo.taxaEntrega)}
              </p>
            ) : null}
            {resumo.taxaServico > 0 ? (
              <p>
                <b>Taxa serviço:</b> {formatarMoeda(resumo.taxaServico)}
              </p>
            ) : null}
            <p className="mt-1 text-[1.1em] font-bold">TOTAL: {formatarMoeda(resumo.total)}</p>
          </div>
        )}
      </div>
    </Painel>
  )
})

PreviewTicket.displayName = 'PreviewTicket'
