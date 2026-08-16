import { supabase } from './supabase'

export type PapelUsuario = 'admin' | 'garcom' | 'entregador'

export type UsuarioSistema = {
  id: string
  nome: string
  nome_usuario: string
  papel: PapelUsuario
  avatar_url: string | null
  cor_avatar: string
  funcionario_id: string | null
}

export type ResultadoLogin = {
  sucesso: boolean
  usuario?: UsuarioSistema
  erro?: string
}

const CHAVE_SESSAO = 'usuario_sistema_sessao'

export async function loginUsuarioSistema(
  nomeUsuario: string,
  senha: string
): Promise<ResultadoLogin> {
  try {
    const { data, error } = await supabase.rpc('verificar_senha_usuario', {
      p_nome_usuario: nomeUsuario,
      p_senha: senha,
    })

    if (error) {
      console.error('[Autenticacao] Erro ao verificar senha:', error)
      return { sucesso: false, erro: 'Erro ao conectar com o servidor' }
    }

    if (!data || data.length === 0) {
      return { sucesso: false, erro: 'Usuario ou senha incorretos' }
    }

    const registro = data[0]
    const usuario: UsuarioSistema = {
      id: registro.id,
      nome: registro.nome,
      nome_usuario: registro.nome_usuario,
      papel: registro.papel as PapelUsuario,
      avatar_url: registro.avatar_url,
      cor_avatar: registro.cor_avatar || '#f97316',
      funcionario_id: registro.funcionario_id,
    }

    salvarSessao(usuario)
    return { sucesso: true, usuario }
  } catch (erro) {
    console.error('[Autenticacao] Erro inesperado:', erro)
    return { sucesso: false, erro: 'Erro inesperado ao fazer login' }
  }
}

export function salvarSessao(usuario: UsuarioSistema): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(usuario))
}

export function obterSessao(): UsuarioSistema | null {
  if (typeof window === 'undefined') return null
  try {
    const dados = localStorage.getItem(CHAVE_SESSAO)
    if (!dados) return null
    return JSON.parse(dados) as UsuarioSistema
  } catch {
    return null
  }
}

export function limparSessao(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(CHAVE_SESSAO)
}

export function verificarPapel(
  usuario: UsuarioSistema | null,
  papelRequerido: PapelUsuario
): boolean {
  if (!usuario) return false
  return usuario.papel === papelRequerido
}

export async function listarUsuariosSistema(): Promise<UsuarioSistema[]> {
  try {
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('id, nome, nome_usuario, papel, avatar_url, cor_avatar, funcionario_id, ativo')
      .order('nome')

    if (error) throw error
    return (data || []).map((u) => ({
      id: u.id,
      nome: u.nome,
      nome_usuario: u.nome_usuario,
      papel: u.papel as PapelUsuario,
      avatar_url: u.avatar_url,
      cor_avatar: u.cor_avatar || '#f97316',
      funcionario_id: u.funcionario_id,
    }))
  } catch (erro) {
    console.error('[Autenticacao] Erro ao listar usuarios:', erro)
    return []
  }
}

export async function listarUsuariosPorPapel(
  papel: PapelUsuario
): Promise<UsuarioSistema[]> {
  try {
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('id, nome, nome_usuario, papel, avatar_url, cor_avatar, funcionario_id')
      .eq('papel', papel)
      .eq('ativo', true)
      .order('nome')

    if (error) throw error
    return (data || []).map((u) => ({
      id: u.id,
      nome: u.nome,
      nome_usuario: u.nome_usuario,
      papel: u.papel as PapelUsuario,
      avatar_url: u.avatar_url,
      cor_avatar: u.cor_avatar || '#f97316',
      funcionario_id: u.funcionario_id,
    }))
  } catch (erro) {
    console.error('[Autenticacao] Erro ao listar usuarios por papel:', erro)
    return []
  }
}

export async function criarUsuarioSistema(dados: {
  nome: string
  nomeUsuario: string
  senha: string
  papel: PapelUsuario
  avatarUrl?: string
  corAvatar?: string
  funcionarioId?: string
}): Promise<{ sucesso: boolean; id?: string; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('criar_usuario_sistema', {
      p_nome: dados.nome,
      p_nome_usuario: dados.nomeUsuario,
      p_senha: dados.senha,
      p_papel: dados.papel,
      p_avatar_url: dados.avatarUrl || null,
      p_cor_avatar: dados.corAvatar || '#f97316',
      p_funcionario_id: dados.funcionarioId || null,
    })

    if (error) {
      if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
        return { sucesso: false, erro: 'Nome de usuario ja existe' }
      }
      console.error('[Autenticacao] Erro ao criar usuario:', error)
      return { sucesso: false, erro: 'Erro ao criar usuario' }
    }

    return { sucesso: true, id: data }
  } catch (erro) {
    console.error('[Autenticacao] Erro inesperado ao criar usuario:', erro)
    return { sucesso: false, erro: 'Erro inesperado' }
  }
}

export async function atualizarUsuarioSistema(
  id: string,
  dados: {
    nome?: string
    papel?: PapelUsuario
    avatarUrl?: string | null
    corAvatar?: string
    ativo?: boolean
    funcionarioId?: string | null
  }
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const atualizacao: Record<string, unknown> = {}
    if (dados.nome !== undefined) atualizacao.nome = dados.nome.trim()
    if (dados.papel !== undefined) atualizacao.papel = dados.papel
    if (dados.avatarUrl !== undefined) atualizacao.avatar_url = dados.avatarUrl
    if (dados.corAvatar !== undefined) atualizacao.cor_avatar = dados.corAvatar
    if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo
    if (dados.funcionarioId !== undefined) atualizacao.funcionario_id = dados.funcionarioId

    const { error } = await supabase
      .from('usuarios_sistema')
      .update(atualizacao)
      .eq('id', id)

    if (error) throw error
    return { sucesso: true }
  } catch (erro) {
    console.error('[Autenticacao] Erro ao atualizar usuario:', erro)
    return { sucesso: false, erro: 'Erro ao atualizar usuario' }
  }
}

export async function atualizarSenhaUsuario(
  id: string,
  novaSenha: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { data, error } = await supabase.rpc('atualizar_senha_usuario', {
      p_usuario_id: id,
      p_nova_senha: novaSenha,
    })

    if (error) throw error
    if (!data) return { sucesso: false, erro: 'Usuario nao encontrado' }
    return { sucesso: true }
  } catch (erro) {
    console.error('[Autenticacao] Erro ao atualizar senha:', erro)
    return { sucesso: false, erro: 'Erro ao atualizar senha' }
  }
}

export async function excluirUsuarioSistema(
  id: string
): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const { error } = await supabase
      .from('usuarios_sistema')
      .delete()
      .eq('id', id)

    if (error) throw error
    return { sucesso: true }
  } catch (erro) {
    console.error('[Autenticacao] Erro ao excluir usuario:', erro)
    return { sucesso: false, erro: 'Erro ao excluir usuario' }
  }
}
