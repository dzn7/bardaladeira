import { NextRequest, NextResponse } from 'next/server'
import { botRequest } from '@/app/api/bot/_lib/evolution-admin'
import {
  montarMensagemCobrancaCrediario,
  resolverTelefoneCobranca,
} from '@/lib/crediario-cobranca.mjs'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COOLDOWN_ENVIO_MS = 60_000
const enviosRecentes = new Map<string, number>()

const origemPermitida = (request: NextRequest) => {
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) return process.env.NODE_ENV !== 'production'

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

const erroJson = (erro: string, status: number) => {
  return NextResponse.json({ sucesso: false, erro }, { status })
}

export async function POST(request: NextRequest) {
  if (!origemPermitida(request)) return erroJson('Origem da solicitação não permitida.', 403)
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return erroJson('Conteúdo da solicitação inválido.', 415)
  }

  const body = (await request.json().catch(() => null)) as { contaId?: unknown; telefone?: unknown } | null
  const contaId = typeof body?.contaId === 'string' && UUID_RE.test(body.contaId) ? body.contaId : null
  if (!contaId) return erroJson('Conta do crediário inválida.', 400)

  const ultimoEnvio = enviosRecentes.get(contaId) || 0
  if (Date.now() - ultimoEnvio < COOLDOWN_ENVIO_MS) {
    return erroJson('A cobrança desta conta acabou de ser enviada.', 409)
  }

  try {
    const supabase = obterSupabaseAdmin()
    const { data: conta, error: erroConta } = await supabase
      .from('crediario_contas')
      .select('id, cliente_nome, telefone, status, saldo_atual, atualizado_em')
      .eq('id', contaId)
      .maybeSingle()

    if (erroConta) throw erroConta
    if (!conta) return erroJson('Conta do crediário não encontrada.', 404)
    if (String(conta.status) !== 'aberto' || Number(conta.saldo_atual || 0) <= 0) {
      return erroJson('Esta conta não possui saldo em aberto.', 409)
    }

    const telefoneInformado = typeof body?.telefone === 'string' ? body.telefone : null
    const { telefone, deveCadastrar } = resolverTelefoneCobranca(conta.telefone, telefoneInformado)
    if (!telefone) return erroJson('Informe um WhatsApp válido para este cliente.', 422)

    if (deveCadastrar) {
      let atualizacaoTelefone = supabase
        .from('crediario_contas')
        .update({ telefone })
        .eq('id', contaId)
      atualizacaoTelefone = conta.telefone === null
        ? atualizacaoTelefone.is('telefone', null)
        : atualizacaoTelefone.eq('telefone', conta.telefone)

      const { data: contaAtualizada, error: erroTelefone } = await atualizacaoTelefone
        .select('id')
        .maybeSingle()

      if (erroTelefone) throw erroTelefone
      if (!contaAtualizada) {
        return erroJson('O WhatsApp desta conta foi atualizado por outra pessoa. Recarregue e tente novamente.', 409)
      }
    }

    const { data: movimentos, error: erroMovimentos } = await supabase
      .from('crediario_movimentos')
      .select('tipo, status, valor, descricao, itens, realizado_em, criado_em')
      .eq('conta_id', contaId)
      .eq('status', 'ativo')
      .order('realizado_em', { ascending: true })

    if (erroMovimentos) throw erroMovimentos

    const mensagem = montarMensagemCobrancaCrediario({
      clienteNome: conta.cliente_nome,
      saldoAtual: conta.saldo_atual,
      movimentos: movimentos || [],
      referenciaEm: conta.atualizado_em,
    })

    await botRequest('/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, mensagem, queue: false }),
    }, 25_000)

    enviosRecentes.set(contaId, Date.now())
    return NextResponse.json({
      sucesso: true,
      mensagem: 'Cobrança enviada pelo WhatsApp.',
      telefone,
    })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Não foi possível enviar a cobrança.'
    return erroJson(mensagem, 503)
  }
}
