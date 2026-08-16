import { calcularPeriodoDiaTrabalho, obterDiaTrabalhoReferencia } from '@/lib/utils'
import type { FiltroFinancas, TipoPeriodo } from '../types'

const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtMoedaCompacta = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
const fmtDataLonga = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export function formatarMoeda(valor: number): string {
  return fmtMoeda.format(Number.isFinite(valor) ? valor : 0)
}

export function formatarMoedaCompacta(valor: number): string {
  if (!Number.isFinite(valor)) return formatarMoeda(0)
  if (Math.abs(valor) < 1000) return formatarMoeda(valor)
  return fmtMoedaCompacta.format(valor)
}

export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return fmtData.format(d)
}

export function formatarDataLonga(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return fmtDataLonga.format(d)
}

export function isoDoDia(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function inicioDoDia(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function fimDoDia(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function calcularPeriodo(tipo: TipoPeriodo, referencia = new Date()): FiltroFinancas {
  const hoje = new Date(referencia)
  if (tipo === 'hoje') {
    const diaTrabalho = obterDiaTrabalhoReferencia(hoje)
    const { inicio, fim } = calcularPeriodoDiaTrabalho(diaTrabalho)
    const fimEfetivo = hoje < fim ? hoje : fim
    return { tipo, inicio: inicio.toISOString(), fim: fimEfetivo.toISOString() }
  }
  if (tipo === 'semana') {
    const dia = hoje.getDay()
    const inicio = inicioDoDia(new Date(hoje))
    inicio.setDate(hoje.getDate() - dia)
    const fim = fimDoDia(new Date(inicio))
    fim.setDate(inicio.getDate() + 6)
    return { tipo, inicio: inicio.toISOString(), fim: fim.toISOString() }
  }
  if (tipo === 'mes') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0, 0)
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999)
    return { tipo, inicio: inicio.toISOString(), fim: fim.toISOString() }
  }
  if (tipo === 'ano') {
    const inicio = new Date(hoje.getFullYear(), 0, 1, 0, 0, 0, 0)
    const fim = new Date(hoje.getFullYear(), 11, 31, 23, 59, 59, 999)
    return { tipo, inicio: inicio.toISOString(), fim: fim.toISOString() }
  }
  return {
    tipo: 'personalizado',
    inicio: inicioDoDia(hoje).toISOString(),
    fim: fimDoDia(hoje).toISOString(),
  }
}

export function rotuloPeriodo(filtro: FiltroFinancas): string {
  const inicio = new Date(filtro.inicio)
  if (filtro.tipo === 'hoje') return formatarDataLonga(filtro.inicio)
  if (filtro.tipo === 'semana') return `${formatarData(filtro.inicio)} – ${formatarData(filtro.fim)}`
  if (filtro.tipo === 'mes') {
    const m = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(inicio)
    return m.charAt(0).toUpperCase() + m.slice(1)
  }
  if (filtro.tipo === 'ano') return String(inicio.getFullYear())
  return `${formatarData(filtro.inicio)} – ${formatarData(filtro.fim)}`
}

// paleta para gráficos (HSL slate-azul de chroma baixo, alinhada ao globals.css)
export const CORES_GRAFICOS = {
  receita: 'hsl(220, 50%, 50%)',
  receitaArea: 'hsla(220, 50%, 50%, 0.18)',
  despesa: 'hsl(0, 70%, 50%)',
  despesaArea: 'hsla(0, 70%, 50%, 0.18)',
  lucro: 'hsl(142, 45%, 45%)',
  lucroNeg: 'hsl(0, 70%, 50%)',
  paleta: [
    'hsl(220, 50%, 50%)',
    'hsl(142, 45%, 45%)',
    'hsl(30, 65%, 55%)',
    'hsl(280, 35%, 55%)',
    'hsl(200, 55%, 50%)',
    'hsl(340, 50%, 55%)',
  ],
}

export function rotularFormaPagamento(forma: string): string {
  if (!forma) return 'Não informado'
  const f = forma.toLowerCase()
  if (f.includes('pix')) return 'Pix'
  if (f.includes('credito') || f.includes('crédito') || f.includes('credit')) return 'Crédito'
  if (f.includes('debito') || f.includes('débito') || f.includes('debit')) return 'Débito'
  if (f === 'dinheiro' || f === 'especie' || f === 'espécie') return 'Dinheiro'
  if (f === 'online') return 'Online'
  return forma.charAt(0).toUpperCase() + forma.slice(1)
}
