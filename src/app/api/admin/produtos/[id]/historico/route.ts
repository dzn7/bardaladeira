import { NextRequest, NextResponse } from 'next/server'
import { autorizarAdminLegado } from '@/lib/server/autorizacao-admin-legada'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CATEGORIAS = new Set(['tudo', 'alteracao', 'estoque', 'promocao', 'visibilidade', 'comercial'])

type Cursor = {
  ocorreuEm: string
  id: string
}

type EventoHistorico = {
  id: string
  tipo: string
  categoria: string
  ocorreu_em: string
  actor_type: string
  actor_name_snapshot: string
  origem: string
  referencia_origem: string | null
  pedido_id: string | null
  pedido_numero: number | null
  promocao_id: string | null
  antes: Record<string, unknown>
  depois: Record<string, unknown>
  metadados: Record<string, unknown>
}

const decodificarCursor = (valor: string | null): Cursor | null => {
  if (!valor) return null

  try {
    const texto = Buffer.from(valor, 'base64url').toString('utf8')
    const cursor = JSON.parse(texto) as Partial<Cursor>
    if (!cursor.ocorreuEm || Number.isNaN(Date.parse(cursor.ocorreuEm)) || !cursor.id || !UUID.test(cursor.id)) {
      return null
    }
    return { ocorreuEm: cursor.ocorreuEm, id: cursor.id }
  } catch {
    return null
  }
}

const codificarCursor = (evento: EventoHistorico) => Buffer
  .from(JSON.stringify({ ocorreuEm: evento.ocorreu_em, id: evento.id }))
  .toString('base64url')

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const autorizacao = await autorizarAdminLegado(request)
  if (!autorizacao) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  const { id: produtoId } = await params
  if (!UUID.test(produtoId)) {
    return NextResponse.json({ sucesso: false, erro: 'Produto inválido.' }, { status: 400 })
  }

  const categoria = request.nextUrl.searchParams.get('categoria') || 'tudo'
  if (!CATEGORIAS.has(categoria)) {
    return NextResponse.json({ sucesso: false, erro: 'Filtro inválido.' }, { status: 400 })
  }

  const cursorTexto = request.nextUrl.searchParams.get('cursor')
  const cursor = decodificarCursor(cursorTexto)
  if (cursorTexto && !cursor) {
    return NextResponse.json({ sucesso: false, erro: 'CURSOR_INVALIDO' }, { status: 400 })
  }

  const limiteInformado = Number(request.nextUrl.searchParams.get('limite') || 25)
  const limite = Number.isInteger(limiteInformado) ? Math.min(Math.max(limiteInformado, 1), 50) : 25

  try {
    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase.rpc('listar_historico_produto', {
      p_produto_id: produtoId,
      p_categoria: categoria,
      p_ocorreu_antes: cursor?.ocorreuEm || null,
      p_id_antes: cursor?.id || null,
      p_limite: limite + 1,
    })
    if (error) {
      return NextResponse.json({ sucesso: true, eventos: [], cursorProximo: null })
    }

    const linhas = (Array.isArray(data) ? data : []) as EventoHistorico[]
    const possuiProximaPagina = linhas.length > limite
    const eventos = possuiProximaPagina ? linhas.slice(0, limite) : linhas
    const ultimoEvento = eventos.at(-1)

    return NextResponse.json({
      sucesso: true,
      eventos,
      cursorProximo: possuiProximaPagina && ultimoEvento ? codificarCursor(ultimoEvento) : null,
    })
  } catch {
    return NextResponse.json({ sucesso: true, eventos: [], cursorProximo: null })
  }
}
