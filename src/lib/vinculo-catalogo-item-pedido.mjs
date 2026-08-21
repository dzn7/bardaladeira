const TIPOS_CATALOGO = new Set(['produto', 'bebida', 'combo'])

export const criarVinculoCatalogoItemPedido = (tipoCatalogo, catalogoId) => {
  if (!TIPOS_CATALOGO.has(tipoCatalogo)) {
    throw new Error('Tipo de catálogo inválido para item de pedido')
  }
  if (typeof catalogoId !== 'string' || !catalogoId.trim()) {
    throw new Error('Identificador de catálogo inválido para item de pedido')
  }

  return {
    produto_id: tipoCatalogo === 'produto' ? catalogoId : null,
    bebida_id: tipoCatalogo === 'bebida' ? catalogoId : null,
    combo_id: tipoCatalogo === 'combo' ? catalogoId : null,
  }
}
