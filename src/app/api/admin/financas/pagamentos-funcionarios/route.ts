import { NextRequest, NextResponse } from 'next/server'
import { validarConfiguracaoPagamento } from '@/lib/pagamentos-funcionarios.mjs'
import { autorizarAdminLegado } from '@/lib/server/autorizacao-admin-legada'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])-01$/
const FORMAS = new Set(['pix', 'dinheiro', 'transferencia', 'cheque'])

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const erroJson = (erro: unknown, padrao: string) => NextResponse.json(
  { sucesso: false, erro: erro instanceof Error ? erro.message : padrao },
  { status: 500 },
)

export async function GET(request: NextRequest) {
  if (!await autorizarAdminLegado(request)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
    const inicioHistorico = new Date()
    inicioHistorico.setMonth(inicioHistorico.getMonth() - 60, 1)
    inicioHistorico.setHours(0, 0, 0, 0)

    const [funcionarios, configuracoes, pagamentos] = await Promise.all([
      supabase.from('funcionarios').select('id, nome, cargo, ativo').eq('ativo', true).order('nome'),
      supabase.from('funcionarios_pagamento_config')
        .select('funcionario_id, dia_vencimento, antecedencia_dias, valor_previsto, ativo, inicia_em, atualizada_em'),
      supabase.from('funcionarios_pagamentos')
        .select('id, funcionario_id, competencia, vencimento, pago_em, valor, forma_pagamento, categoria_id, movimentacao_id, observacoes')
        .gte('competencia', inicioHistorico.toISOString().slice(0, 10))
        .order('competencia', { ascending: false })
        .limit(1000),
    ])
    const falha = funcionarios.error || configuracoes.error || pagamentos.error
    if (falha) throw new Error(falha.message)

    return NextResponse.json({
      sucesso: true,
      funcionarios: funcionarios.data || [],
      configuracoes: configuracoes.data || [],
      pagamentos: pagamentos.data || [],
    })
  } catch (erro) {
    return erroJson(erro, 'Falha ao carregar pagamentos da equipe.')
  }
}

type Corpo = {
  acao?: unknown
  funcionarioId?: unknown
  diaVencimento?: unknown
  antecedenciaDias?: unknown
  valorPrevisto?: unknown
  ativo?: unknown
  competencia?: unknown
  pagoEm?: unknown
  valor?: unknown
  formaPagamento?: unknown
  categoriaId?: unknown
  observacoes?: unknown
}

export async function POST(request: NextRequest) {
  if (!origemValida(request)) {
    return NextResponse.json({ sucesso: false, erro: 'Origem inválida.' }, { status: 403 })
  }
  if (!await autorizarAdminLegado(request)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const corpo = (await request.json()) as Corpo
    const funcionarioId = typeof corpo.funcionarioId === 'string' ? corpo.funcionarioId : ''
    if (!UUID.test(funcionarioId)) {
      return NextResponse.json({ sucesso: false, erro: 'Funcionário inválido.' }, { status: 400 })
    }
    const supabase = obterSupabaseAdmin({ exigirServiceRole: true })

    if (corpo.acao === 'configurar') {
      const config = validarConfiguracaoPagamento({
        diaVencimento: Number(corpo.diaVencimento),
        antecedenciaDias: Number(corpo.antecedenciaDias),
        valorPrevisto: corpo.valorPrevisto as number | string | null,
      })
      if (!config.valida || typeof corpo.ativo !== 'boolean') {
        return NextResponse.json({ sucesso: false, erro: 'Configuração de pagamento inválida.' }, { status: 400 })
      }
      const { error } = await supabase.from('funcionarios_pagamento_config').upsert({
        funcionario_id: funcionarioId,
        dia_vencimento: config.diaVencimento,
        antecedencia_dias: config.antecedenciaDias,
        valor_previsto: config.valorPrevisto,
        ativo: corpo.ativo,
        atualizada_em: new Date().toISOString(),
      }, { onConflict: 'funcionario_id' })
      if (error) throw new Error(error.message)
    } else if (corpo.acao === 'registrar_pagamento') {
      const competencia = typeof corpo.competencia === 'string' ? corpo.competencia : ''
      const pagoEm = typeof corpo.pagoEm === 'string' ? corpo.pagoEm : ''
      const valor = Number(corpo.valor)
      const formaPagamento = typeof corpo.formaPagamento === 'string' ? corpo.formaPagamento : ''
      const categoriaId = corpo.categoriaId === null || corpo.categoriaId === '' ? null : corpo.categoriaId
      const observacoes = typeof corpo.observacoes === 'string' ? corpo.observacoes.trim() : null
      if (!COMPETENCIA.test(competencia) || !Number.isFinite(new Date(pagoEm).getTime())
        || !Number.isFinite(valor) || valor <= 0 || !FORMAS.has(formaPagamento)
        || (categoriaId !== null && (typeof categoriaId !== 'string' || !UUID.test(categoriaId)))
        || (observacoes?.length || 0) > 500) {
        return NextResponse.json({ sucesso: false, erro: 'Dados do pagamento inválidos.' }, { status: 400 })
      }
      const { error } = await supabase.rpc('registrar_pagamento_funcionario_admin', {
        p_funcionario_id: funcionarioId,
        p_competencia: competencia,
        p_pago_em: pagoEm,
        p_valor: valor,
        p_forma_pagamento: formaPagamento,
        p_categoria_id: categoriaId,
        p_observacoes: observacoes,
      })
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ sucesso: false, erro: 'Esta competência já foi paga.' }, { status: 409 })
        }
        throw new Error(error.message)
      }
    } else {
      return NextResponse.json({ sucesso: false, erro: 'Ação inválida.' }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true })
  } catch (erro) {
    return erroJson(erro, 'Falha ao salvar pagamento da equipe.')
  }
}
