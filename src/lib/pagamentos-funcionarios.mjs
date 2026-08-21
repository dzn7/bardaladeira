const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

const dataUtc = (iso) => {
  if (typeof iso !== 'string' || !DATA_ISO.test(iso)) return null
  const data = new Date(`${iso}T12:00:00.000Z`)
  return Number.isFinite(data.getTime()) ? data : null
}

const isoData = (data) => data.toISOString().slice(0, 10)

export const obterVencimentoMensal = (competencia, diaVencimento) => {
  const base = dataUtc(competencia)
  const dia = Number(diaVencimento)
  if (!base || !Number.isInteger(dia) || dia < 1 || dia > 31) return null
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 12)).getUTCDate()
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(dia, ultimoDia)).padStart(2, '0')}`
}

export const situacaoPagamentoFuncionario = ({
  competencia,
  diaVencimento,
  antecedenciaDias,
  hoje,
  pagoEm,
}) => {
  const vencimento = obterVencimentoMensal(competencia, diaVencimento)
  const dataHoje = dataUtc(hoje)
  const dataVencimento = vencimento ? dataUtc(vencimento) : null
  if (!dataHoje || !dataVencimento) return null
  const diferenca = Math.round((dataVencimento.getTime() - dataHoje.getTime()) / 86_400_000)
  if (pagoEm) return { estado: 'pago', vencimento, dias: Math.abs(diferenca) }
  if (diferenca < 0) return { estado: 'atrasado', vencimento, dias: Math.abs(diferenca) }
  if (diferenca === 0) return { estado: 'vence_hoje', vencimento, dias: 0 }
  if (diferenca <= Number(antecedenciaDias)) return { estado: 'proximo', vencimento, dias: diferenca }
  return { estado: 'agendado', vencimento, dias: diferenca }
}

export const validarConfiguracaoPagamento = ({ diaVencimento, antecedenciaDias, valorPrevisto }) => {
  const dia = Number(diaVencimento)
  const antecedencia = Number(antecedenciaDias)
  const valor = valorPrevisto === null || valorPrevisto === '' || valorPrevisto === undefined
    ? null
    : Number(valorPrevisto)
  const valida = Number.isInteger(dia) && dia >= 1 && dia <= 31
    && Number.isInteger(antecedencia) && antecedencia >= 0 && antecedencia <= 30
    && (valor === null || (Number.isFinite(valor) && valor >= 0 && valor <= 999_999_999.99))
  return { valida, diaVencimento: dia, antecedenciaDias: antecedencia, valorPrevisto: valor }
}

export const competenciaAtual = (agora = new Date()) =>
  `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-01`

export const formatarCompetencia = (competencia) => {
  const data = dataUtc(competencia)
  if (!data) return competencia
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(data)
}

export const hojeIso = (agora = new Date()) => isoData(new Date(Date.UTC(
  agora.getFullYear(), agora.getMonth(), agora.getDate(), 12,
)))
