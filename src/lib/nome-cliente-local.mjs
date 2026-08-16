const LOCAIS_PARCEIROS_NAO_PESSOAIS = new Set(['marcelo'])

/**
 * @typedef {{ localParceiro?: boolean }} OpcoesNomePessoal
 * @typedef {{ nomeCliente?: string | null, tipoEntrega?: string | null, localParceiro?: boolean }} OpcoesNomePedido
 * @typedef {{ nomeCliente?: string | null, localParceiro?: boolean }} OpcoesNomePontoSalao
 */

function normalizar(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * @param {string | null | undefined} valor
 * @param {OpcoesNomePessoal} [opcoes]
 */
export function nomeClientePessoalValido(valor, { localParceiro = false } = {}) {
  const limpo = String(valor || '').trim()
  if (!limpo) return false

  const n = normalizar(limpo)
  if (!/[a-z]/.test(n)) return false
  if (/^(mesa|comanda|local|parceiro|cliente|consumidor pdv)(?:\s+\d+)?$/.test(n)) return false
  if (/\b(no|na)\s+marcelo\b/.test(n)) return false
  if (localParceiro && LOCAIS_PARCEIROS_NAO_PESSOAIS.has(n)) return false

  return true
}

/**
 * @param {OpcoesNomePedido} [opcoes]
 */
export function nomeClienteParaPedido({ nomeCliente, tipoEntrega, localParceiro = false } = {}) {
  const limpo = String(nomeCliente || '').trim()
  if (nomeClientePessoalValido(limpo, { localParceiro })) return limpo
  return 'Cliente'
}

/**
 * @param {OpcoesNomePontoSalao} [opcoes]
 */
export function nomeClienteParaPontoSalao({ nomeCliente, localParceiro = false } = {}) {
  const limpo = String(nomeCliente || '').trim()
  return nomeClientePessoalValido(limpo, { localParceiro }) ? limpo : null
}
