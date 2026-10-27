import { NextRequest, NextResponse } from 'next/server'
import { autorizarAdminLegado } from '@/lib/server/autorizacao-admin-legada'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIPOS = new Set(['entrada', 'saida', 'ajuste'])

type Cursor = {
  ocorreuEm: string
  id: string
}

type Movimentacao = {
  id: string
  item_id: string
  item_tipo: 'produto' | 'bebida'
  item_nome: string
  ocorreu_em: string
  tipo: 'entrada' | 'saida' | 'ajuste'
  quantidade: number
  saldo_antes: number | null
  saldo_depois: number
  origem: string
  pedido_id: string | null
  pedido_numero: number | null
}

const dataOuNula = (valor: string | null) => {
  if (!valor) return null
  return Number.isNaN(Date.parse(valor)) ? undefined : valor
}

const decodificarCursor = (valor: string | null): Cursor | null => {
  if (!valor) return null
  try {
    const cursor = JSON.parse(Buffer.from(valor, 'base64url').toString('utf8')) as Partial<Cursor>
    if (!cursor.ocorreuEm || Number.isNaN(Date.parse(cursor.ocorreuEm)) || !cursor.id || !UUID.test(cursor.id)) {
      return null
    }
    return { ocorreuEm: cursor.ocorreuEm, id: cursor.id }
  } catch {
    return null
  }
}

const codificarCursor = (movimentacao: Movimentacao) => Buffer
  .from(JSON.stringify({ ocorreuEm: movimentacao.ocorreu_em, id: movimentacao.id }))
  .toString('base64url')

export async function GET(request: NextRequest) {
  const autorizacao = await autorizarAdminLegado(request)
  if (!autorizacao) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  const parametros = request.nextUrl.searchParams
  const itemId = parametros.get('item')
  if (itemId && !UUID.test(itemId)) {
    return NextResponse.json({ sucesso: false, erro: 'Produto inválido.' }, { status: 400 })
  }

  const tipo = parametros.get('tipo')
  if (tipo && !TIPOS.has(tipo)) {
    return NextResponse.json({ sucesso: false, erro: 'Filtro inválido.' }, { status: 400 })
  }

  const inicio = dataOuNula(parametros.get('inicio'))
  const fim = dataOuNula(parametros.get('fim'))
  if (inicio === undefined || fim === undefined) {
    return NextResponse.json({ sucesso: false, erro: 'Período inválido.' }, { status: 400 })
  }

  const cursorTexto = parametros.get('cursor')
  const cursor = decodificarCursor(cursorTexto)
  if (cursorTexto && !cursor) {
    return NextResponse.json({ sucesso: false, erro: 'CURSOR_INVALIDO' }, { status: 400 })
  }

  const limiteInformado = Number(parametros.get('limite') || 30)
  const limite = Number.isInteger(limiteInformado) ? Math.min(Math.max(limiteInformado, 1), 100) : 30

  try {
    const { data, error } = await obterSupabaseAdmin().rpc('listar_movimentacoes_estoque', {
      p_item_id: itemId || null,
      p_tipo: tipo || null,
      p_inicio: inicio,
      p_fim: fim,
      p_ocorreu_antes: cursor?.ocorreuEm || null,
      p_id_antes: cursor?.id || null,
      p_limite: limite + 1,
    })
    if (error) {
      return NextResponse.json({ sucesso: false, erro: 'Não foi possível carregar as movimentações.' }, { status: 500 })
    }

    const linhas = (Array.isArray(data) ? data : []) as Movimentacao[]
    const possuiProximaPagina = linhas.length > limite
    const movimentacoes = possuiProximaPagina ? linhas.slice(0, limite) : linhas
    const ultima = movimentacoes.at(-1)

    return NextResponse.json({
      sucesso: true,
      movimentacoes,
      cursorProximo: possuiProximaPagina && ultima ? codificarCursor(ultima) : null,
    })
  } catch {
    return NextResponse.json({ sucesso: false, erro: 'Não foi possível carregar as movimentações.' }, { status: 500 })
  }
}
