import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { autorizarAdminLegado } from '@/lib/server/autorizacao-admin-legada'
import type { NotificacaoAdmin } from '@/lib/notificacoes-admin.mjs'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RESUMO_VAZIO = { urgentes: 0, urgentesNaoLidas: 0, normais: 0, naoLidas: 0, total: 0 }

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const idsValidos = (valor: unknown) => Array.from(new Set(
  (Array.isArray(valor) ? valor : [])
    .filter((item): item is string => typeof item === 'string' && UUID.test(item)),
)).slice(0, 200)

type LinhaResumo = {
  urgentes?: number | null
  urgentes_nao_lidas?: number | null
  normais?: number | null
  nao_lidas?: number | null
  total?: number | null
}

const lerResumo = async (usuarioChave: string) => {
  const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
  const { data, error } = await supabase.rpc('resumo_notificacoes_admin', {
    p_usuario_chave: usuarioChave,
  })
  if (error) throw new Error(error.message)
  const linha = (Array.isArray(data) ? data[0] : data) as LinhaResumo | null
  if (!linha) return RESUMO_VAZIO
  return {
    urgentes: Number(linha.urgentes || 0),
    urgentesNaoLidas: Number(linha.urgentes_nao_lidas || 0),
    normais: Number(linha.normais || 0),
    naoLidas: Number(linha.nao_lidas || 0),
    total: Number(linha.total || 0),
  }
}

export async function GET(request: NextRequest) {
  const autorizacao = await autorizarAdminLegado(request)
  if (!autorizacao) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }
  const usuarioChave = autorizacao.usuarioChave

  try {
    const completo = request.nextUrl.searchParams.get('modo') === 'completo'
    if (!completo) {
      return NextResponse.json({ sucesso: true, resumo: await lerResumo(usuarioChave) })
    }

    const incluirHistorico = request.nextUrl.searchParams.get('incluirHistorico') === 'true'
    const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
    const { error: erroReconciliar } = await supabase.rpc('reconciliar_notificacoes_admin')
    if (erroReconciliar) throw new Error(erroReconciliar.message)

    const [lista, preferencia, resumo] = await Promise.all([
      supabase.rpc('listar_notificacoes_admin', {
        p_usuario_chave: usuarioChave,
        p_limite: incluirHistorico ? 50 : 20,
        p_incluir_historico: incluirHistorico,
      }),
      supabase
        .from('notificacoes_admin_preferencias')
        .select('mostrar_modal_entrada, notificar_estoque, notificar_pedidos, notificar_pagamentos_funcionarios')
        .eq('usuario_chave', usuarioChave)
        .maybeSingle(),
      lerResumo(usuarioChave),
    ])
    if (lista.error) throw new Error(lista.error.message)
    if (preferencia.error) throw new Error(preferencia.error.message)

    return NextResponse.json({
      sucesso: true,
      resumo,
      modalAtivo: preferencia.data?.mostrar_modal_entrada !== false,
      preferencias: {
        estoque: preferencia.data?.notificar_estoque !== false,
        pedidos: preferencia.data?.notificar_pedidos !== false,
        pagamentosFuncionarios: preferencia.data?.notificar_pagamentos_funcionarios !== false,
      },
      notificacoes: (lista.data || []) as NotificacaoAdmin[],
    })
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao carregar notificações.' },
      { status: 500 },
    )
  }
}

type Corpo = {
  acao?: unknown
  ids?: unknown
  ativo?: unknown
  preferencias?: { estoque?: unknown; pedidos?: unknown; pagamentosFuncionarios?: unknown }
}

const salvarLeitura = async (
  usuarioChave: string,
  ids: string[],
  campos: Record<string, string>,
) => {
  if (ids.length === 0) return
  const agora = new Date().toISOString()
  const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
  const { error } = await supabase.from('notificacoes_admin_leituras').upsert(
    ids.map((id) => ({
      notificacao_id: id,
      usuario_chave: usuarioChave,
      atualizada_em: agora,
      ...campos,
    })),
    { onConflict: 'notificacao_id,usuario_chave' },
  )
  if (error) throw new Error(error.message)
}

export async function POST(request: NextRequest) {
  if (!origemValida(request)) {
    return NextResponse.json({ sucesso: false, erro: 'Origem inválida.' }, { status: 403 })
  }
  const autorizacao = await autorizarAdminLegado(request)
  if (!autorizacao) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const corpo = (await request.json()) as Corpo
    const usuarioChave = autorizacao.usuarioChave

    const agora = new Date().toISOString()
    const ids = idsValidos(corpo.ids)
    if (corpo.acao === 'apresentadas') {
      await salvarLeitura(usuarioChave, ids, { apresentada_em: agora })
    } else if (corpo.acao === 'lida') {
      await salvarLeitura(usuarioChave, ids, { apresentada_em: agora, lida_em: agora })
    } else if (corpo.acao === 'silenciada') {
      await salvarLeitura(usuarioChave, ids, { apresentada_em: agora, silenciada_em: agora })
    } else if (corpo.acao === 'lidas_todas') {
      const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
      const { error } = await supabase.rpc('marcar_todas_notificacoes_admin_lidas', {
        p_usuario_chave: usuarioChave,
      })
      if (error) throw new Error(error.message)
    } else if (corpo.acao === 'preferencia_modal') {
      const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
      const { error } = await supabase.from('notificacoes_admin_preferencias').upsert({
        usuario_chave: usuarioChave,
        mostrar_modal_entrada: corpo.ativo === true,
        atualizada_em: agora,
      }, { onConflict: 'usuario_chave' })
      if (error) throw new Error(error.message)
    } else if (corpo.acao === 'preferencias_categorias') {
      const preferencias = corpo.preferencias
      if (!preferencias || typeof preferencias.estoque !== 'boolean'
        || typeof preferencias.pedidos !== 'boolean'
        || typeof preferencias.pagamentosFuncionarios !== 'boolean') {
        return NextResponse.json({ sucesso: false, erro: 'Preferências inválidas.' }, { status: 400 })
      }
      const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
      const { error } = await supabase.from('notificacoes_admin_preferencias').upsert({
        usuario_chave: usuarioChave,
        notificar_estoque: preferencias.estoque,
        notificar_pedidos: preferencias.pedidos,
        notificar_pagamentos_funcionarios: preferencias.pagamentosFuncionarios,
        atualizada_em: agora,
      }, { onConflict: 'usuario_chave' })
      if (error) throw new Error(error.message)
    } else {
      return NextResponse.json({ sucesso: false, erro: 'Ação inválida.' }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true, resumo: await lerResumo(usuarioChave) })
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao atualizar notificações.' },
      { status: 500 },
    )
  }
}
