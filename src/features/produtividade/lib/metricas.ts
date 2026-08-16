import type { GarcomProdutividade } from '../types'

/** Percentual dos pedidos do garçom que chegaram a entregue. */
export const taxaFechamento = (garcom: GarcomProdutividade) =>
  garcom.pedidosCriados > 0 ? (garcom.pedidosFechados / garcom.pedidosCriados) * 100 : 0

/** Percentual de pedidos que saíram sem nenhuma ocorrência de boa prática. */
export const taxaQualidade = (garcom: GarcomProdutividade) => {
  const base = garcom.pedidosCriados - garcom.pedidosCancelados
  if (base <= 0) return 100
  // Um pedido pode acumular as duas ocorrências: o teto evita qualidade negativa.
  const comOcorrencia = Math.min(garcom.ocorrenciasNome + garcom.ocorrenciasContato, base)
  return ((base - comOcorrencia) / base) * 100
}

export type SeloQualidade = {
  texto: string
  classe: string
}

export const seloQualidade = (qualidade: number): SeloQualidade => {
  if (qualidade >= 90) {
    return {
      texto: 'Exemplar',
      classe:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    }
  }
  if (qualidade >= 70) {
    return { texto: 'Bom', classe: 'border-primary/30 bg-primary/10 text-primary' }
  }
  if (qualidade >= 50) {
    return {
      texto: 'Atenção',
      classe:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300',
    }
  }
  return {
    texto: 'Crítico',
    classe:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300',
  }
}
