// Tarifas oficiais por 1M tokens, conferidas em 2026-08-03.
// DeepSeek: https://api-docs.deepseek.com/quick_start/pricing
// OpenAI: https://developers.openai.com/api/docs/models/gpt-5-mini
const PRECOS_USD_POR_MILHAO = {
  deepseek: {
    'deepseek-v4-flash': { entrada: 0.14, cache: 0.0028, saida: 0.28 },
  },
  openai: {
    'gpt-5-mini': { entrada: 0.25, cache: 0.025, saida: 2 },
  },
}

const numeroSeguro = (valor) => {
  const numero = Number(valor || 0)
  return Number.isFinite(numero) ? Math.max(0, numero) : 0
}

const encontrarPreco = (provedor, modelo) => {
  const modelos = PRECOS_USD_POR_MILHAO[provedor]
  if (!modelos) return null
  const nome = String(modelo || '').toLowerCase()
  const modeloBase = Object.keys(modelos).find((chave) => nome === chave || nome.startsWith(`${chave}-`))
  return modeloBase ? { modeloBase, ...modelos[modeloBase] } : null
}

/**
 * @param {{
 *   provedor?: string,
 *   modelo?: string,
 *   runtime?: {
 *     prompt_tokens?: number,
 *     completion_tokens?: number,
 *     cache_hit_tokens?: number,
 *     cache_miss_tokens?: number
 *   }
 * }} dados
 */
export const calcularCustoEstimadoIa = ({ provedor = '', modelo = '', runtime = {} }) => {
  const tokensEntrada = numeroSeguro(runtime.prompt_tokens)
  const tokensCache = Math.min(tokensEntrada, numeroSeguro(runtime.cache_hit_tokens))
  const cacheMissInformado = numeroSeguro(runtime.cache_miss_tokens)
  const tokensEntradaSemCache = cacheMissInformado > 0
    ? Math.min(tokensEntrada, cacheMissInformado)
    : Math.max(0, tokensEntrada - tokensCache)
  const tokensSaida = numeroSeguro(runtime.completion_tokens)
  const preco = encontrarPreco(String(provedor).toLowerCase(), modelo)

  if (!preco) {
    return {
      disponivel: false,
      totalUsd: null,
      tokensEntrada,
      tokensEntradaSemCache,
      tokensCache,
      tokensSaida,
      preco: null,
    }
  }

  const entradaUsd = (tokensEntradaSemCache / 1_000_000) * preco.entrada
  const cacheUsd = (tokensCache / 1_000_000) * preco.cache
  const saidaUsd = (tokensSaida / 1_000_000) * preco.saida

  return {
    disponivel: true,
    totalUsd: entradaUsd + cacheUsd + saidaUsd,
    entradaUsd,
    cacheUsd,
    saidaUsd,
    tokensEntrada,
    tokensEntradaSemCache,
    tokensCache,
    tokensSaida,
    preco,
  }
}
