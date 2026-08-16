import { supabase } from './supabase'
import { criarUsuarioSistema, type PapelUsuario } from './autenticacao'

/**
 * Regras de cadastro casado entre `funcionarios` (quem trabalha) e
 * `usuarios_sistema` (quem faz login). As duas telas usam este arquivo para que
 * o vínculo seja idêntico nos dois sentidos.
 *
 * Contexto: em 2026-07-25 nenhum dos 11 usuários tinha `funcionario_id` e havia
 * pares duplicados ("Bom Parto" / "Bom parto"), porque cada cadastro era feito
 * à mão em uma tela diferente.
 */

export type TipoFuncionario = 'entregador' | 'cozinheiro' | 'atendente' | 'gerente' | 'dono'

export const TIPOS_FUNCIONARIO: { valor: TipoFuncionario; rotulo: string }[] = [
  { valor: 'entregador', rotulo: 'Entregador' },
  { valor: 'cozinheiro', rotulo: 'Cozinheiro' },
  { valor: 'atendente', rotulo: 'Atendente' },
  { valor: 'gerente', rotulo: 'Gerente' },
  { valor: 'dono', rotulo: 'Dono' },
]

export const rotuloTipoFuncionario = (tipo: TipoFuncionario) =>
  TIPOS_FUNCIONARIO.find((item) => item.valor === tipo)?.rotulo ?? tipo

/**
 * Sugestões de tradução entre os dois cadastros. `usuarios_sistema.papel` tem
 * CHECK (admin | garcom | entregador), então cozinheiro cai em `garcom`, que é o
 * papel operacional de menor privilégio. Em ambas as telas o campo continua
 * editável — isto é só o valor inicial.
 */
export const PAPEL_PARA_TIPO_FUNCIONARIO: Record<PapelUsuario, TipoFuncionario> = {
  admin: 'gerente',
  garcom: 'atendente',
  entregador: 'entregador',
}

export const TIPO_FUNCIONARIO_PARA_PAPEL: Record<TipoFuncionario, PapelUsuario> = {
  entregador: 'entregador',
  cozinheiro: 'garcom',
  atendente: 'garcom',
  gerente: 'admin',
  dono: 'admin',
}

// Faixa ̀-ͯ = marcas de acento separadas pelo NFD (escapada de propósito:
// colar os caracteres combinantes crus no arquivo quebra dependendo do editor).
const DIACRITICOS = /[̀-ͯ]/g

const semAcento = (valor: string) => valor.normalize('NFD').replace(DIACRITICOS, '')

/** Chave de comparação de nomes: sem acento, minúsculo e sem espaço repetido. */
export const normalizarNome = (nome: string) =>
  semAcento(nome).toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Login no padrão já usado na base: minúsculo, sem acento e com `_` no lugar do
 * espaço (`joao_pedro`, `md_chefe`).
 */
export const sugerirNomeUsuario = (nome: string) =>
  semAcento(nome)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 24)

/**
 * `usuarios_sistema.nome_usuario` é UNIQUE: devolve a sugestão livre, somando um
 * sufixo numérico quando já existe. Em caso de falha na consulta devolve a base
 * — o INSERT ainda protege, e a tela mostra o erro de duplicado.
 */
export async function sugerirNomeUsuarioDisponivel(nome: string): Promise<string> {
  const base = sugerirNomeUsuario(nome)
  if (!base) return ''

  const { data, error } = await supabase
    .from('usuarios_sistema')
    .select('nome_usuario')
    .ilike('nome_usuario', `${base}%`)

  if (error || !data) return base

  const usados = new Set(
    (data as { nome_usuario: string }[]).map((linha) => linha.nome_usuario.toLowerCase()),
  )
  if (!usados.has(base)) return base

  for (let sufixo = 2; sufixo < 100; sufixo += 1) {
    const candidato = `${base}${sufixo}`
    if (!usados.has(candidato)) return candidato
  }
  return base
}

export type FuncionarioResumo = {
  id: string
  nome: string
  tipo: TipoFuncionario
}

/** Procura um funcionário já cadastrado com o mesmo nome (ignorando acento/caixa). */
export async function buscarFuncionarioPorNome(
  nome: string,
): Promise<FuncionarioResumo | null> {
  const alvo = normalizarNome(nome)
  if (!alvo) return null

  const { data, error } = await supabase.from('funcionarios').select('id, nome, tipo')
  if (error || !data) return null

  const encontrado = (data as FuncionarioResumo[]).find(
    (funcionario) => normalizarNome(funcionario.nome) === alvo,
  )
  return encontrado ?? null
}

export type ResultadoVinculo = {
  sucesso: boolean
  funcionarioId?: string
  /** true quando o funcionário já existia e foi apenas vinculado. */
  reaproveitado?: boolean
  erro?: string
}

/**
 * Garante um funcionário para um usuário do sistema: reaproveita o cadastro de
 * mesmo nome, se houver, em vez de criar um duplicado.
 */
export async function garantirFuncionario(dados: {
  nome: string
  tipo: TipoFuncionario
  telefone?: string | null
  ativo?: boolean
}): Promise<ResultadoVinculo> {
  try {
    const existente = await buscarFuncionarioPorNome(dados.nome)
    if (existente) {
      return { sucesso: true, funcionarioId: existente.id, reaproveitado: true }
    }

    const { data, error } = await supabase
      .from('funcionarios')
      .insert({
        nome: dados.nome.trim(),
        telefone: dados.telefone?.trim() || null,
        tipo: dados.tipo,
        cargo: dados.tipo,
        ativo: dados.ativo ?? true,
      })
      .select('id')
      .single()

    if (error) throw error
    return { sucesso: true, funcionarioId: (data as { id: string }).id, reaproveitado: false }
  } catch (erro) {
    console.error('[CadastroEquipe] Erro ao criar funcionário:', erro)
    return { sucesso: false, erro: 'Erro ao criar o funcionário vinculado' }
  }
}

export type ResultadoAcesso = {
  sucesso: boolean
  usuarioId?: string
  erro?: string
}

/** Cria o usuário de sistema já apontando para o funcionário. */
export async function criarAcessoParaFuncionario(dados: {
  nome: string
  nomeUsuario: string
  senha: string
  papel: PapelUsuario
  corAvatar: string
  funcionarioId: string
}): Promise<ResultadoAcesso> {
  const resultado = await criarUsuarioSistema({
    nome: dados.nome,
    nomeUsuario: dados.nomeUsuario,
    senha: dados.senha,
    papel: dados.papel,
    corAvatar: dados.corAvatar,
    funcionarioId: dados.funcionarioId,
  })

  if (!resultado.sucesso) {
    return { sucesso: false, erro: resultado.erro || 'Erro ao criar o acesso' }
  }
  return { sucesso: true, usuarioId: resultado.id }
}

/** Validação compartilhada pelos dois modais antes de gravar qualquer coisa. */
export function validarDadosAcesso(dados: {
  nomeUsuario: string
  senha: string
}): string | null {
  if (!dados.nomeUsuario.trim()) return 'Informe o nome de usuário do acesso'
  if (dados.nomeUsuario.trim().length < 3) return 'O nome de usuário precisa ter ao menos 3 letras'
  if (!dados.senha.trim()) return 'Informe a senha do acesso'
  if (dados.senha.length < 4) return 'A senha deve ter no mínimo 4 caracteres'
  return null
}
