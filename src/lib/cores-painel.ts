import { supabase } from './supabase'

/**
 * Cores das colunas do painel Kanban (`/admin/painel`).
 *
 * As colunas daqui são fixas (status do pedido), diferente do Juridiq, onde cada
 * coluna é um registro com `hexColor`. Então a cor vive em `configuracoes_loja`,
 * no mesmo padrão de `horario_funcionamento_json`: um JSON por chave, igual para
 * toda a loja e para qualquer aparelho.
 */

export type ChaveColunaPainel = 'novos' | 'emPreparo' | 'prontos'

export type CoresColunasPainel = Record<ChaveColunaPainel, string>

export const CHAVE_CONFIG_CORES_PAINEL = 'painel_cores_colunas_json'

/** Mantém a leitura de hoje: âmbar para análise, azul para produção, verde para pronto. */
export const CORES_PADRAO_COLUNAS: CoresColunasPainel = {
  novos: '#F59E0B',
  emPreparo: '#0296F9',
  prontos: '#10B981',
}

export const PALETA_CORES_PAINEL = [
  '#0296F9',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
  '#F97316',
  '#64748B',
]

const HEX_RE = /^#([0-9a-f]{6})$/i

export const corValida = (valor: unknown): valor is string =>
  typeof valor === 'string' && HEX_RE.test(valor.trim())

/** `#0296F9` + alfa → `rgba(...)`. Devolve transparente se o hex for inválido. */
export function hexParaRgba(hex: string, alfa: number): string {
  if (!corValida(hex)) return 'transparent'
  const limpo = hex.trim()
  const r = parseInt(limpo.slice(1, 3), 16)
  const g = parseInt(limpo.slice(3, 5), 16)
  const b = parseInt(limpo.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alfa})`
}

/** Preto ou branco, o que tiver mais contraste sobre a cor (luminância ITU-R BT.601). */
export function corDeTextoPorContraste(hex: string): string {
  if (!corValida(hex)) return '#000000'
  const limpo = hex.trim()
  const r = parseInt(limpo.slice(1, 3), 16)
  const g = parseInt(limpo.slice(3, 5), 16)
  const b = parseInt(limpo.slice(5, 7), 16)
  const brilho = (r * 299 + g * 587 + b * 114) / 1000
  return brilho > 128 ? '#000000' : '#FFFFFF'
}

export function normalizarCoresColunas(valor: unknown): CoresColunasPainel {
  const cores: CoresColunasPainel = { ...CORES_PADRAO_COLUNAS }
  if (!valor || typeof valor !== 'object') return cores

  const bruto = valor as Record<string, unknown>
  for (const chave of Object.keys(cores) as ChaveColunaPainel[]) {
    const candidata = bruto[chave]
    if (corValida(candidata)) cores[chave] = candidata.trim().toUpperCase()
  }
  return cores
}

/**
 * Lê as cores salvas. Qualquer falha devolve o padrão: cor de coluna nunca pode
 * impedir o painel de abrir.
 */
export async function carregarCoresColunas(): Promise<CoresColunasPainel> {
  try {
    const { data, error } = await supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_CONFIG_CORES_PAINEL)
      .maybeSingle()

    if (error || !data?.valor) return { ...CORES_PADRAO_COLUNAS }
    return normalizarCoresColunas(JSON.parse(data.valor as string))
  } catch (erro) {
    console.error('[CoresPainel] Falha ao carregar cores das colunas:', erro)
    return { ...CORES_PADRAO_COLUNAS }
  }
}

export async function salvarCoresColunas(
  cores: CoresColunasPainel,
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const normalizadas = normalizarCoresColunas(cores)
    const { error } = await supabase.from('configuracoes_loja').upsert(
      {
        chave: CHAVE_CONFIG_CORES_PAINEL,
        valor: JSON.stringify(normalizadas),
        tipo: 'json',
        descricao: 'Cores das colunas do painel Kanban',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'chave' },
    )

    if (error) throw error
    return { sucesso: true }
  } catch (erro) {
    console.error('[CoresPainel] Falha ao salvar cores das colunas:', erro)
    return { sucesso: false, erro: 'Não foi possível salvar a cor' }
  }
}

/** Estilos derivados de uma cor, usados pela coluna e pelas pills do mobile. */
export function estilosDaColuna(cor: string) {
  return {
    /** Fundo da coluna — visível nos dois temas sem apagar o conteúdo. */
    fundoColuna: hexParaRgba(cor, 0.08),
    /** Faixa sólida no topo, que dá a leitura imediata da coluna. */
    bordaTopo: cor,
    /** Chip do título. */
    fundoTitulo: hexParaRgba(cor, 0.16),
    textoTitulo: cor,
    /** Contador ao lado do título. */
    bordaContador: hexParaRgba(cor, 0.45),
    fundoContador: hexParaRgba(cor, 0.12),
  }
}
