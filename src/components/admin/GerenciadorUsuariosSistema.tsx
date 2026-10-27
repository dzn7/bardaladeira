'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Shield, ForkKnife as UtensilsCrossed, Truck, Plus, MagnifyingGlass as Search, CircleNotch as Loader2, Key, Eye, EyeSlash as EyeOff, Camera } from '@phosphor-icons/react'
import { supabase } from '@/lib/supabase'
import {
  criarUsuarioSistema,
  atualizarUsuarioSistema,
  atualizarSenhaUsuario,
  excluirUsuarioSistema,
  type PapelUsuario,
} from '@/lib/autenticacao'
import {
  garantirFuncionario,
  PAPEL_PARA_TIPO_FUNCIONARIO,
  TIPOS_FUNCIONARIO,
  type TipoFuncionario,
} from '@/lib/cadastro-equipe'
import { enviarImagemParaR2 } from '@/lib/servicoUploadImagem'
import { validarArquivoImagem, arquivoParaUrl } from '@/lib/recorteImagem'
import ModalRecorteAvatar from './ModalRecorteAvatar'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { toast } from 'sonner'
import {
  Botao,
  Campo,
  Chip,
  Entrada,
  Gaveta,
  Interruptor,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'

type UsuarioComStatus = {
  id: string
  nome: string
  nome_usuario: string
  papel: PapelUsuario
  avatar_url: string | null
  cor_avatar: string
  ativo: boolean
  funcionario_id: string | null
  ultimo_acesso: string | null
  created_at: string
}

type FormularioUsuario = {
  nome: string
  nomeUsuario: string
  senha: string
  papel: PapelUsuario
  corAvatar: string
  ativo: boolean
}

const COLUNAS_SEGURAS =
  'id, nome, nome_usuario, papel, avatar_url, cor_avatar, ativo, funcionario_id, ultimo_acesso, created_at'

const CORES_AVATAR = [
  '#0296F9',
  '#ef4444',
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
]

const PAPEIS: { valor: PapelUsuario; rotulo: string; icone: typeof Shield }[] = [
  { valor: 'admin', rotulo: 'Administrador', icone: Shield },
  { valor: 'garcom', rotulo: 'Garçom', icone: UtensilsCrossed },
  { valor: 'entregador', rotulo: 'Entregador', icone: Truck },
]

const FILTROS_PAPEL: Array<{ valor: PapelUsuario | 'todos'; label: string }> = [
  { valor: 'todos', label: 'Todos' },
  ...PAPEIS.map((p) => ({ valor: p.valor, label: p.rotulo })),
]

const formularioInicial: FormularioUsuario = {
  nome: '',
  nomeUsuario: '',
  senha: '',
  papel: 'garcom',
  corAvatar: '#0296F9',
  ativo: true,
}

const rotuloPapel = (papel: PapelUsuario) =>
  PAPEIS.find((p) => p.valor === papel)?.rotulo ?? papel

export default function GerenciadorUsuariosSistema() {
  const confirmar = useConfirmar()
  const [usuarios, setUsuarios] = useState<UsuarioComStatus[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroPapel, setFiltroPapel] = useState<PapelUsuario | 'todos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const [editando, setEditando] = useState<UsuarioComStatus | null>(null)
  const [formulario, setFormulario] = useState<FormularioUsuario>(formularioInicial)
  const [novaSenha, setNovaSenha] = useState('')
  const [usuarioSenha, setUsuarioSenha] = useState<UsuarioComStatus | null>(null)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [recorteAvatarAberto, setRecorteAvatarAberto] = useState(false)
  const [imagemParaRecorte, setImagemParaRecorte] = useState('')
  const [usuarioAvatar, setUsuarioAvatar] = useState<UsuarioComStatus | null>(null)
  const [enviandoAvatar, setEnviandoAvatar] = useState<string | null>(null)
  const [criarFuncionario, setCriarFuncionario] = useState(true)
  const [tipoFuncionario, setTipoFuncionario] = useState<TipoFuncionario>(
    PAPEL_PARA_TIPO_FUNCIONARIO[formularioInicial.papel],
  )
  const [telefoneFuncionario, setTelefoneFuncionario] = useState('')
  const inputAvatarRef = useRef<HTMLInputElement>(null)

  const carregarUsuarios = useCallback(async () => {
    try {
      setCarregando(true)
      const { data, error } = await supabase
        .from('usuarios_sistema')
        .select(COLUNAS_SEGURAS)
        .order('nome')

      if (error) throw error
      setUsuarios((data || []) as UsuarioComStatus[])
    } catch (erro) {
      console.error('Erro ao carregar usuários:', erro)
      toast.error('Erro ao carregar usuários')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarUsuarios()
  }, [carregarUsuarios])

  const abrirModalNovo = () => {
    setEditando(null)
    setFormulario(formularioInicial)
    setMostrarSenha(false)
    setCriarFuncionario(true)
    setTipoFuncionario(PAPEL_PARA_TIPO_FUNCIONARIO[formularioInicial.papel])
    setTelefoneFuncionario('')
    setModalAberto(true)
  }

  /** Trocar o papel reposiciona a função sugerida do funcionário. */
  const alterarPapel = (papel: PapelUsuario) => {
    setFormulario((atual) => ({ ...atual, papel }))
    setTipoFuncionario(PAPEL_PARA_TIPO_FUNCIONARIO[papel])
  }

  const abrirModalEditar = (usuario: UsuarioComStatus) => {
    setEditando(usuario)
    // Editar usuário não mexe no cadastro de funcionário.
    setCriarFuncionario(false)
    setFormulario({
      nome: usuario.nome,
      nomeUsuario: usuario.nome_usuario,
      senha: '',
      papel: usuario.papel,
      corAvatar: usuario.cor_avatar || '#0296F9',
      ativo: usuario.ativo,
    })
    setMostrarSenha(false)
    setModalAberto(true)
  }

  const abrirModalSenha = (usuario: UsuarioComStatus) => {
    setUsuarioSenha(usuario)
    setNovaSenha('')
    setMostrarSenha(false)
    setModalSenhaAberto(true)
  }

  const fecharModal = () => {
    setModalAberto(false)
    setEditando(null)
    setFormulario(formularioInicial)
  }

  const salvarUsuario = async () => {
    if (!formulario.nome.trim() || !formulario.nomeUsuario.trim()) {
      toast.error('Nome e usuário são obrigatórios')
      return
    }
    if (!editando && !formulario.senha.trim()) {
      toast.error('Senha é obrigatória para novo usuário')
      return
    }
    if (!editando && formulario.senha.length < 4) {
      toast.error('Senha deve ter no mínimo 4 caracteres')
      return
    }

    try {
      setSalvando(true)

      if (editando) {
        const resultado = await atualizarUsuarioSistema(editando.id, {
          nome: formulario.nome,
          papel: formulario.papel,
          corAvatar: formulario.corAvatar,
          ativo: formulario.ativo,
        })
        if (!resultado.sucesso) {
          toast.error(resultado.erro || 'Erro ao atualizar')
          return
        }
        toast.success('Usuário atualizado')
      } else {
        // O funcionário vem primeiro para o usuário já nascer com o vínculo.
        let funcionarioId: string | undefined
        let funcionarioReaproveitado = false

        if (criarFuncionario) {
          const vinculo = await garantirFuncionario({
            nome: formulario.nome,
            tipo: tipoFuncionario,
            telefone: telefoneFuncionario,
            ativo: formulario.ativo,
          })
          if (!vinculo.sucesso) {
            toast.error(vinculo.erro || 'Erro ao criar o funcionário')
            return
          }
          funcionarioId = vinculo.funcionarioId
          funcionarioReaproveitado = Boolean(vinculo.reaproveitado)
        }

        const resultado = await criarUsuarioSistema({
          nome: formulario.nome,
          nomeUsuario: formulario.nomeUsuario,
          senha: formulario.senha,
          papel: formulario.papel,
          corAvatar: formulario.corAvatar,
          funcionarioId,
        })
        if (!resultado.sucesso) {
          // O funcionário fica cadastrado: ao tentar de novo com outro login,
          // `garantirFuncionario` reaproveita pelo nome em vez de duplicar.
          toast.error(
            funcionarioId && !funcionarioReaproveitado
              ? `Funcionário cadastrado, mas o acesso falhou: ${resultado.erro || 'erro ao criar'}`
              : resultado.erro || 'Erro ao criar',
          )
          return
        }

        if (!criarFuncionario) {
          toast.success('Usuário criado')
        } else if (funcionarioReaproveitado) {
          toast.success('Usuário criado e vinculado ao funcionário já cadastrado')
        } else {
          toast.success('Usuário e funcionário criados')
        }
      }

      fecharModal()
      void carregarUsuarios()
    } catch (erro) {
      console.error('Erro ao salvar usuário:', erro)
      toast.error('Erro ao salvar usuário')
    } finally {
      setSalvando(false)
    }
  }

  const handleAlterarSenha = async () => {
    if (!usuarioSenha || !novaSenha.trim()) return
    if (novaSenha.length < 4) {
      toast.error('Senha deve ter no mínimo 4 caracteres')
      return
    }

    try {
      setSalvando(true)
      const resultado = await atualizarSenhaUsuario(usuarioSenha.id, novaSenha)
      if (resultado.sucesso) {
        toast.success('Senha alterada')
        setModalSenhaAberto(false)
      } else {
        toast.error(resultado.erro || 'Erro ao alterar senha')
      }
    } catch {
      toast.error('Erro ao alterar senha')
    } finally {
      setSalvando(false)
    }
  }

  const excluirUsuario = async (usuario: UsuarioComStatus) => {
    const ok = await confirmar({
      titulo: `Excluir o acesso de ${usuario.nome}?`,
      descricao: 'A pessoa não consegue mais entrar no sistema. Não dá para desfazer.',
      confirmar: 'Excluir acesso',
      perigo: true,
    })
    if (!ok) return

    const resultado = await excluirUsuarioSistema(usuario.id)
    if (resultado.sucesso) {
      toast.success('Usuário excluído')
      if (editando?.id === usuario.id) fecharModal()
      void carregarUsuarios()
    } else {
      toast.error(resultado.erro || 'Erro ao excluir')
    }
  }

  const handleAlternarStatus = async (usuario: UsuarioComStatus) => {
    const resultado = await atualizarUsuarioSistema(usuario.id, { ativo: !usuario.ativo })
    if (resultado.sucesso) {
      toast.success(usuario.ativo ? 'Usuário desativado' : 'Usuário ativado')
      void carregarUsuarios()
    } else {
      toast.error('Erro ao alterar status')
    }
  }

  const abrirUploadAvatar = (usuario: UsuarioComStatus) => {
    setUsuarioAvatar(usuario)
    inputAvatarRef.current?.click()
  }

  const aoSelecionarArquivoAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return
    e.target.value = ''

    const validacao = validarArquivoImagem(arquivo)
    if (!validacao.valido) {
      toast.error(validacao.erro || 'Arquivo inválido')
      return
    }

    const url = await arquivoParaUrl(arquivo)
    setImagemParaRecorte(url)
    setRecorteAvatarAberto(true)
  }

  const aoConfirmarRecorteAvatar = async (blob: Blob) => {
    if (!usuarioAvatar) return
    setEnviandoAvatar(usuarioAvatar.id)
    setRecorteAvatarAberto(false)

    try {
      const resultado = await enviarImagemParaR2(blob, 'avatars', usuarioAvatar.id)
      if (!resultado.sucesso || !resultado.url) {
        throw new Error(resultado.erro || 'Falha no upload')
      }

      const { error } = await supabase
        .from('usuarios_sistema')
        .update({ avatar_url: resultado.url })
        .eq('id', usuarioAvatar.id)

      if (error) throw error

      toast.success('Avatar atualizado')
      void carregarUsuarios()
    } catch (erro) {
      console.error('Erro ao enviar avatar:', erro)
      toast.error('Erro ao enviar avatar')
    } finally {
      setEnviandoAvatar(null)
      setUsuarioAvatar(null)
    }
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return usuarios.filter((u) => {
      const matchBusca =
        !termo ||
        u.nome.toLowerCase().includes(termo) ||
        u.nome_usuario.toLowerCase().includes(termo)
      const matchPapel = filtroPapel === 'todos' || u.papel === filtroPapel
      return matchBusca && matchPapel
    })
  }, [usuarios, busca, filtroPapel])

  const resumo = useMemo(
    () => ({
      total: usuarios.length,
      ativos: usuarios.filter((u) => u.ativo).length,
      admins: usuarios.filter((u) => u.papel === 'admin' && u.ativo).length,
      garcons: usuarios.filter((u) => u.papel === 'garcom' && u.ativo).length,
      entregadores: usuarios.filter((u) => u.papel === 'entregador' && u.ativo).length,
    }),
    [usuarios],
  )

  const handleLimparFiltros = () => {
    setBusca('')
    setFiltroPapel('todos')
  }

  const botaoMostrarSenha = (
    <button
      type="button"
      onClick={() => setMostrarSenha(!mostrarSenha)}
      className="absolute right-0.5 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
    >
      {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </button>
  )

  const avatarClicavel = (usuario: UsuarioComStatus) => (
    <button
      type="button"
      onClick={(evento) => {
        evento.stopPropagation()
        abrirUploadAvatar(usuario)
      }}
      disabled={enviandoAvatar === usuario.id}
      className="group relative flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Trocar foto de ${usuario.nome}`}
    >
      {enviandoAvatar === usuario.id ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </span>
      ) : (
        <AvatarUsuario nome={usuario.nome} src={usuario.avatar_url} cor={usuario.cor_avatar} size="md" />
      )}
      <span className="pointer-events-none absolute inset-0.5 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/40">
        <Camera className="size-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  )

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {resumo.ativos} de {resumo.total} com acesso · {resumo.admins} admin · {resumo.garcons} garçons ·{' '}
          {resumo.entregadores} entregadores
        </p>
        <Botao onClick={abrirModalNovo} className="h-11 md:h-10">
          <Plus />
          Novo acesso
        </Botao>
      </div>

      <div className="relative sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Entrada
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou usuário"
          className="pl-9"
          aria-label="Buscar usuário do sistema"
        />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="Filtrar por função">
        {FILTROS_PAPEL.map((item) => (
          <Chip key={item.valor} ativo={filtroPapel === item.valor} onClick={() => setFiltroPapel(item.valor)} className="h-10">
            {item.label}
          </Chip>
        ))}
      </div>

      {carregando ? (
        <ListaCarregando linhas={5} />
      ) : usuariosFiltrados.length === 0 ? (
        <ListaVazia
          icone={<Shield />}
          titulo={usuarios.length === 0 ? 'Nenhum acesso cadastrado' : 'Ninguém encontrado'}
          descricao={
            usuarios.length === 0
              ? 'Crie o login de quem usa o painel, o app do garçom ou o do entregador.'
              : 'Tente outro nome ou função.'
          }
          acao={
            usuarios.length === 0 ? (
              <Botao onClick={abrirModalNovo}>
                <Plus />
                Novo acesso
              </Botao>
            ) : (
              <Botao variante="contorno" onClick={handleLimparFiltros}>Limpar filtros</Botao>
            )
          }
        />
      ) : (
        <Lista>
          {usuariosFiltrados.map((usuario) => {
            const Icone = PAPEIS.find((p) => p.valor === usuario.papel)?.icone ?? Shield
            return (
              <li key={usuario.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirModalEditar(usuario)}
                  onKeyDown={(evento) => {
                    if (evento.key === 'Enter' && evento.target === evento.currentTarget) abrirModalEditar(usuario)
                  }}
                  className={cn(
                    'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    !usuario.ativo && 'opacity-60',
                  )}
                >
                  {avatarClicavel(usuario)}
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate font-medium text-foreground">{usuario.nome}</p>
                      {!usuario.ativo ? <Selo>Sem acesso</Selo> : null}
                    </div>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                      <Icone className="size-3.5 shrink-0" />
                      <span className="truncate">
                        {rotuloPapel(usuario.papel)} · @{usuario.nome_usuario}
                      </span>
                    </p>
                  </div>
                  <Interruptor
                    marcado={usuario.ativo}
                    aoMudar={() => void handleAlternarStatus(usuario)}
                    rotuloAcessivel={`${usuario.ativo ? 'Desativar' : 'Ativar'} acesso de ${usuario.nome}`}
                  />
                </div>
              </li>
            )
          })}
        </Lista>
      )}

      <input
        ref={inputAvatarRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={aoSelecionarArquivoAvatar}
        className="hidden"
      />

      <Gaveta
        aberto={modalAberto}
        aoFechar={fecharModal}
        bloqueada={salvando}
        titulo={editando ? 'Editar acesso' : 'Novo acesso'}
        descricao={editando ? `@${editando.nome_usuario}` : 'Nome, login e o que a pessoa faz.'}
        rodape={
          editando ? (
            <>
              <Botao
                variante="perigoSuave"
                className="md:mr-auto"
                onClick={() => void excluirUsuario(editando)}
                disabled={salvando}
              >
                Excluir
              </Botao>
              <Botao
                carregando={salvando}
                onClick={() => void salvarUsuario()}
                disabled={!formulario.nome.trim() || !formulario.nomeUsuario.trim()}
              >
                Salvar
              </Botao>
            </>
          ) : (
            <>
              <Botao variante="contorno" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </Botao>
              <Botao
                carregando={salvando}
                onClick={() => void salvarUsuario()}
                disabled={!formulario.nome.trim() || !formulario.nomeUsuario.trim()}
              >
                Criar acesso
              </Botao>
            </>
          )
        }
      >
        <form
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            void salvarUsuario()
          }}
        >
          {editando ? (
            <div className="flex items-center gap-3">
              {avatarClicavel(usuarios.find((u) => u.id === editando.id) ?? editando)}
              <div className="flex flex-wrap gap-2">
                <Botao variante="contorno" tamanho="sm" className="h-11 md:h-9" onClick={() => abrirUploadAvatar(editando)}>
                  <Camera />
                  Trocar foto
                </Botao>
                <Botao variante="contorno" tamanho="sm" className="h-11 md:h-9" onClick={() => abrirModalSenha(editando)}>
                  <Key />
                  Trocar senha
                </Botao>
              </div>
            </div>
          ) : null}

          <Campo rotulo="Nome" htmlFor="usr-nome">
            <Entrada
              id="usr-nome"
              value={formulario.nome}
              onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
              placeholder="Nome completo"
              autoComplete="off"
            />
          </Campo>

          <Campo
            rotulo="Usuário para entrar"
            htmlFor="usr-login"
            ajuda={editando ? 'O usuário não muda depois de criado.' : 'Sem espaços. Ex.: joao.silva'}
          >
            <Entrada
              id="usr-login"
              value={formulario.nomeUsuario}
              onChange={(e) =>
                setFormulario({
                  ...formulario,
                  nomeUsuario: e.target.value.toLowerCase().replace(/\s/g, ''),
                })
              }
              placeholder="nome.usuario"
              disabled={!!editando}
              autoCapitalize="none"
              autoComplete="off"
            />
          </Campo>

          {!editando && (
            <Campo rotulo="Senha" htmlFor="usr-senha" ajuda="Mínimo de 4 caracteres.">
              <div className="relative">
                <Entrada
                  id="usr-senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={formulario.senha}
                  onChange={(e) => setFormulario({ ...formulario, senha: e.target.value })}
                  autoComplete="new-password"
                  className="pr-12"
                />
                {botaoMostrarSenha}
              </div>
            </Campo>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Função</p>
            <div role="radiogroup" aria-label="Função" className="flex flex-wrap gap-2">
              {PAPEIS.map((papel) => {
                const Icone = papel.icone
                const selecionado = formulario.papel === papel.valor
                return (
                  <button
                    key={papel.valor}
                    type="button"
                    role="radio"
                    aria-checked={selecionado}
                    onClick={() => alterarPapel(papel.valor)}
                    className={cn(
                      'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors',
                      selecionado
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/70 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icone className="size-4" />
                    {papel.rotulo}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Cor da bolinha</p>
            <div className="flex flex-wrap gap-2">
              {CORES_AVATAR.map((cor) => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setFormulario({ ...formulario, corAvatar: cor })}
                  className={cn(
                    'size-10 rounded-full transition-shadow',
                    formulario.corAvatar === cor && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                  style={{ backgroundColor: cor }}
                  aria-label={`Cor ${cor}`}
                  aria-pressed={formulario.corAvatar === cor}
                />
              ))}
            </div>
          </div>

          {!editando ? (
            <div className="space-y-3">
              <LinhaInterruptor
                titulo="Cadastrar também em Funcionários"
                descricao="Se já existir alguém com o mesmo nome, usa esse cadastro."
                marcado={criarFuncionario}
                aoMudar={setCriarFuncionario}
                rotuloAcessivel="Cadastrar também em Funcionários"
              />

              {criarFuncionario ? (
                <div className="space-y-4 rounded-xl border border-border/70 p-4">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">Função na equipe</p>
                    <div role="radiogroup" aria-label="Função na equipe" className="flex flex-wrap gap-2">
                      {TIPOS_FUNCIONARIO.map((tipo) => {
                        const selecionado = tipoFuncionario === tipo.valor
                        return (
                          <button
                            key={tipo.valor}
                            type="button"
                            role="radio"
                            aria-checked={selecionado}
                            onClick={() => setTipoFuncionario(tipo.valor)}
                            className={cn(
                              'inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
                              selecionado
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border/70 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                            )}
                          >
                            {tipo.rotulo}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <Campo rotulo="Telefone" htmlFor="usr-telefone" opcional>
                    <Entrada
                      id="usr-telefone"
                      type="tel"
                      inputMode="tel"
                      value={telefoneFuncionario}
                      onChange={(e) => setTelefoneFuncionario(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </Campo>
                </div>
              ) : null}
            </div>
          ) : null}

          <LinhaInterruptor
            titulo="Pode entrar no sistema"
            descricao="Desligue para bloquear o login sem apagar o cadastro."
            marcado={formulario.ativo}
            aoMudar={(ativo) => setFormulario({ ...formulario, ativo })}
            rotuloAcessivel="Pode entrar no sistema"
          />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Gaveta>

      <Gaveta
        aberto={modalSenhaAberto}
        aoFechar={() => setModalSenhaAberto(false)}
        bloqueada={salvando}
        titulo="Trocar senha"
        descricao={usuarioSenha ? `Nova senha para ${usuarioSenha.nome}.` : 'Defina a nova senha.'}
        rodape={
          <>
            <Botao variante="contorno" onClick={() => setModalSenhaAberto(false)} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao carregando={salvando} onClick={() => void handleAlterarSenha()} disabled={novaSenha.length < 4}>
              Salvar senha
            </Botao>
          </>
        }
      >
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            void handleAlterarSenha()
          }}
        >
          <Campo rotulo="Nova senha" htmlFor="usr-nova-senha" ajuda="Mínimo de 4 caracteres.">
            <div className="relative">
              <Entrada
                id="usr-nova-senha"
                type={mostrarSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                autoComplete="new-password"
                className="pr-12"
              />
              {botaoMostrarSenha}
            </div>
          </Campo>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Gaveta>

      <ModalRecorteAvatar
        aberto={recorteAvatarAberto}
        imagemUrl={imagemParaRecorte}
        onFechar={() => setRecorteAvatarAberto(false)}
        onConfirmar={aoConfirmarRecorteAvatar}
        titulo="Ajustar foto"
      />
    </div>
  )
}
