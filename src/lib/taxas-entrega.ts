/**
 * Configuração de taxa de entrega fixa
 * Taxa única para todas as entregas
 */

// Taxa fixa de entrega
export const TAXA_ENTREGA_FIXA = 2

/**
 * Retorna a taxa de entrega fixa
 */
export function obterTaxaEntrega(): number {
  return TAXA_ENTREGA_FIXA
}

/**
 * Formata a taxa para exibição
 */
export function formatarTaxa(taxa: number): string {
  return `R$ ${taxa.toFixed(2).replace('.', ',')}`
}
