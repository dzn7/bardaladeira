import type { Caixa, MovimentacaoCaixa } from '@/lib/tipos-caixa'

export type BucketForma = 'dinheiro' | 'pix' | 'cartao' | 'outros'

export type ResumoFormasCaixa = Record<BucketForma, number>

export type FechamentoFormasSnapshot = {
  dinheiro: { esperado: number; contado: number }
  pix: { esperado: number }
  cartao: { esperado: number }
  outros: { esperado: number }
}

const normalizarForma = (valor?: string | null) =>
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

export const classificarFormaPagamento = (forma?: string | null): BucketForma => {
  const f = normalizarForma(forma)
  if (!f) return 'outros'
  if (f.includes('pix')) return 'pix'
  if (f.includes('cartao') || f.includes('credito') || f.includes('debito') || f.includes('card')) return 'cartao'
  if (
    f.includes('dinheiro') ||
    f.includes('especie') ||
    f.includes('cash') ||
    f === 'suprimento' ||
    f === 'sangria'
  ) {
    return 'dinheiro'
  }
  return 'outros'
}

export const ehMovimentoDinheiro = (mov: Pick<MovimentacaoCaixa, 'forma_pagamento' | 'categoria'>) => {
  if (classificarFormaPagamento(mov.forma_pagamento) === 'dinheiro') return true
  const nomeCat = normalizarForma(mov.categoria?.nome)
  return nomeCat === 'sangria' || nomeCat === 'suprimento'
}

export const resumoPorForma = (movimentacoes: MovimentacaoCaixa[]): ResumoFormasCaixa => {
  const base: ResumoFormasCaixa = { dinheiro: 0, pix: 0, cartao: 0, outros: 0 }

  for (const mov of movimentacoes) {
    const valor = Number(mov.valor || 0)
    if (!valor) continue
    const bucket = classificarFormaPagamento(mov.forma_pagamento)
    const sinal = mov.tipo === 'saida' ? -1 : 1

    if (bucket === 'dinheiro' || ehMovimentoDinheiro(mov)) {
      base.dinheiro += sinal * valor
      continue
    }

    if (mov.tipo === 'entrada') {
      base[bucket] += valor
    }
  }

  return base
}

export const calcularSaldoGaveta = (
  caixa: Pick<Caixa, 'valor_abertura'> | null,
  movimentacoes: MovimentacaoCaixa[],
) => {
  const abertura = Number(caixa?.valor_abertura || 0)
  let entradasDinheiro = 0
  let saidasDinheiro = 0

  for (const mov of movimentacoes) {
    if (!ehMovimentoDinheiro(mov)) continue
    const valor = Number(mov.valor || 0)
    if (mov.tipo === 'entrada') entradasDinheiro += valor
    else saidasDinheiro += valor
  }

  return {
    saldoGaveta: abertura + entradasDinheiro - saidasDinheiro,
    entradasDinheiro,
    saidasDinheiro,
    esperadoDinheiro: abertura + entradasDinheiro - saidasDinheiro,
  }
}

export const montarFechamentoFormas = (
  resumo: ResumoFormasCaixa,
  contadoDinheiro: number,
  valorAbertura: number,
): FechamentoFormasSnapshot => {
  const esperadoDinheiro = valorAbertura + resumo.dinheiro
  return {
    dinheiro: { esperado: esperadoDinheiro, contado: contadoDinheiro },
    pix: { esperado: resumo.pix },
    cartao: { esperado: resumo.cartao },
    outros: { esperado: resumo.outros },
  }
}

export const formatarMoedaCaixa = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)
