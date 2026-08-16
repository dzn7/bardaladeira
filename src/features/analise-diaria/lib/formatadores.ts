export const formatarMoeda = (valor: number) =>
  `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

export const calcularVariacaoPercentual = (atual: number, anterior: number) => {
  if (anterior > 0) return ((atual - anterior) / anterior) * 100
  return atual > 0 ? 100 : 0
}

export const normalizarFormaPagamento = (forma: string): string => {
  const f = (forma || '').toLowerCase().trim()
  if (!f) return 'outros'
  if (f === 'pix online' || f === 'pix_online') return 'pix_online'
  if (f === 'pix') return 'pix'
  if (['cartão', 'cartao', 'cartão de crédito', 'cartao de credito', 'credito', 'cartão crédito'].includes(f)) {
    return 'credito'
  }
  if (['cartão de débito', 'cartao de debito', 'debito', 'cartão débito'].includes(f)) {
    return 'debito'
  }
  if (['vale refeição', 'vale refeicao', 'vale'].includes(f)) return 'vale_refeicao'
  if (['dinheiro', 'espécie', 'especie'].includes(f)) return 'dinheiro'
  if (f.includes('credi') || f === 'fiado') return 'crediario'
  return 'outros'
}
