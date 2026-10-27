'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Eye, EyeSlash as EyeOff, Plus, MagnifyingGlass as Search, Users } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Chip,
  Entrada,
  Gaveta,
  Interruptor,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Segmentos,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
import ModalRecorteAvatar from '@/components/admin/ModalRecorteAvatar'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { supabase } from '@/lib/supabase'
import { atualizarUsuarioSistema, type PapelUsuario } from '@/lib/autenticacao'
import {
  criarAcessoParaFuncionario,
  rotuloTipoFuncionario as rotuloTipo,
  sugerirNomeUsuario,
  sugerirNomeUsuarioDisponivel,
  TIPO_FUNCIONARIO_PARA_PAPEL,
  TIPOS_FUNCIONARIO,
  validarDadosAcesso,
  type TipoFuncionario,
} from '@/lib/cadastro-equipe'
import { enviarImagemParaR2 } from '@/lib/servicoUploadImagem'
import { arquivoParaUrl, validarArquivoImagem } from '@/lib/recorteImagem'
import { cn } from '@/lib/utils'

type Funcionario = {
  id: string
  nome: string
  telefone: string | null
  tipo: TipoFuncionario
  ativo: boolean
  created_at: string
}

type FuncionarioFormulario = {
  nome: string
  telefone: string
  tipo: TipoFuncionario
  ativo: boolean
}

/** Campos do acesso criado junto com o funcionário. */
type AcessoFormulario = {
  nomeUsuario: string
  senha: string
  papel: PapelUsuario
  corAvatar: string
}

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

const PAPEIS_ACESSO: { valor: PapelUsuario; rotulo: string }[] = [
  { valor: 'admin', rotulo: 'Administrador' },
  { valor: 'garcom', rotulo: 'Garçom' },
  { valor: 'entregador', rotulo: 'Entregador' },
]

const formularioInicial: FuncionarioFormulario = {
  nome: '',
  telefone: '',
  tipo: 'entregador',
  ativo: true,
}

const acessoInicial: AcessoFormulario = {
  nomeUsuario: '',
  senha: '',
  papel: TIPO_FUNCIONARIO_PARA_PAPEL[formularioInicial.tipo],
  corAvatar: '#0296F9',
}

export default function GerenciadorFuncionarios() {
  const confirmar = useConfirmar()
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoFuncionario | 'todos'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [funcionarioEditando, setFuncionarioEditando] = useState<Funcionario | null>(null)
  const [formulario, setFormulario] = useState<FuncionarioFormulario>(formularioInicial)
  const [processandoId, setProcessandoId] = useState<string | null>(null)
  const [criarAcesso, setCriarAcesso] = useState(true)
  const [acesso, setAcesso] = useState<AcessoFormulario>(acessoInicial)
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [imagemParaRecorte, setImagemParaRecorte] = useState('')
  const [recorteAberto, setRecorteAberto] = useState(false)
  // Enquanto o admin não digitar um login à mão, ele acompanha o nome.
  const loginEditadoManualmente = useRef(false)
  const inputAvatarRef = useRef<HTMLInputElement>(null)

  const carregarFuncionarios = useCallback(async (opcoes?: { silencioso?: boolean }) => {
    const silencioso = Boolean(opcoes?.silencioso)
    try {
      if (!silencioso) setCarregando(true)
      const { data, error } = await supabase.from('funcionarios').select('*').order('nome')
      if (error) throw error
      setFuncionarios(data || [])
    } catch (erro) {
      console.error('Erro ao carregar funcionários:', erro)
      toast.error('Erro ao carregar funcionários')
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarFuncionarios()
  }, [carregarFuncionarios])

  const limparAcesso = () => {
    setAcesso(acessoInicial)
    setMostrarSenha(false)
    setAvatarBlob(null)
    // O preview é um object URL: sem revogar, o blob fica retido na memória.
    setAvatarPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return null
    })
    setImagemParaRecorte('')
    loginEditadoManualmente.current = false
  }

  const abrirModalNovo = () => {
    setFuncionarioEditando(null)
    setFormulario(formularioInicial)
    limparAcesso()
    setCriarAcesso(true)
    setModalAberto(true)
  }

  const abrirModalEditar = (funcionario: Funcionario) => {
    setFuncionarioEditando(funcionario)
    setFormulario({
      nome: funcionario.nome,
      telefone: funcionario.telefone || '',
      tipo: funcionario.tipo,
      ativo: funcionario.ativo,
    })
    // Editar funcionário nunca cria acesso: quem já existe é ajustado em Usuários.
    limparAcesso()
    setCriarAcesso(false)
    setModalAberto(true)
  }

  const fecharModal = () => {
    setModalAberto(false)
    setFuncionarioEditando(null)
    setFormulario(formularioInicial)
    limparAcesso()
    setCriarAcesso(true)
  }

  const alterarNome = (nome: string) => {
    setFormulario((atual) => ({ ...atual, nome }))
    if (!loginEditadoManualmente.current) {
      setAcesso((atual) => ({ ...atual, nomeUsuario: sugerirNomeUsuario(nome) }))
    }
  }

  const alterarTipo = (tipo: TipoFuncionario) => {
    setFormulario((atual) => ({ ...atual, tipo }))
    setAcesso((atual) => ({ ...atual, papel: TIPO_FUNCIONARIO_PARA_PAPEL[tipo] }))
  }

  /** Ao sair do campo nome, resolve um login livre (nome_usuario é UNIQUE). */
  const aoSairDoNome = async () => {
    if (!criarAcesso || funcionarioEditando || loginEditadoManualmente.current) return
    if (!formulario.nome.trim()) return
    const sugestao = await sugerirNomeUsuarioDisponivel(formulario.nome)
    if (sugestao) setAcesso((atual) => ({ ...atual, nomeUsuario: sugestao }))
  }

  const aoSelecionarFoto = async (evento: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = evento.target.files?.[0]
    if (!arquivo) return
    evento.target.value = ''

    const validacao = validarArquivoImagem(arquivo)
    if (!validacao.valido) {
      toast.error(validacao.erro || 'Arquivo inválido')
      return
    }

    setImagemParaRecorte(await arquivoParaUrl(arquivo))
    setRecorteAberto(true)
  }

  const aoConfirmarRecorte = (blob: Blob) => {
    setAvatarBlob(blob)
    setAvatarPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return URL.createObjectURL(blob)
    })
    setRecorteAberto(false)
  }

  /** Sobe a foto escolhida e liga no usuário recém-criado (o upload exige o id). */
  const enviarAvatarDoAcesso = async (usuarioId: string) => {
    if (!avatarBlob) return
    try {
      const upload = await enviarImagemParaR2(avatarBlob, 'avatars', usuarioId)
      if (!upload.sucesso || !upload.url) throw new Error(upload.erro || 'Falha no upload')
      await atualizarUsuarioSistema(usuarioId, { avatarUrl: upload.url })
    } catch (erro) {
      console.error('Erro ao enviar foto do acesso:', erro)
      toast.warning('Acesso criado, mas a foto não subiu. Envie por Usuários.')
    }
  }

  const salvarFuncionario = async () => {
    if (!formulario.nome.trim()) {
      toast.error('Nome é obrigatório')
      return
    }

    const deveCriarAcesso = criarAcesso && !funcionarioEditando
    if (deveCriarAcesso) {
      const erroAcesso = validarDadosAcesso({
        nomeUsuario: acesso.nomeUsuario,
        senha: acesso.senha,
      })
      if (erroAcesso) {
        toast.error(erroAcesso)
        return
      }
    }

    try {
      setSalvando(true)
      const dados = {
        nome: formulario.nome.trim(),
        telefone: formulario.telefone.trim() || null,
        tipo: formulario.tipo,
        cargo: formulario.tipo,
        ativo: formulario.ativo,
      }

      if (funcionarioEditando) {
        const { error } = await supabase
          .from('funcionarios')
          .update(dados)
          .eq('id', funcionarioEditando.id)
        if (error) throw error
        toast.success('Funcionário atualizado')
      } else {
        const { data, error } = await supabase
          .from('funcionarios')
          .insert(dados)
          .select('id')
          .single()
        if (error) throw error

        if (!deveCriarAcesso) {
          toast.success('Funcionário cadastrado')
        } else {
          // O funcionário já está gravado: uma falha aqui não o desfaz, só
          // avisa que o acesso ficou pendente (é o dado mais barato de refazer).
          const funcionarioId = (data as { id: string }).id
          const resultado = await criarAcessoParaFuncionario({
            nome: dados.nome,
            nomeUsuario: acesso.nomeUsuario.trim(),
            senha: acesso.senha,
            papel: acesso.papel,
            corAvatar: acesso.corAvatar,
            funcionarioId,
          })

          if (!resultado.sucesso || !resultado.usuarioId) {
            toast.warning(
              `Funcionário cadastrado, mas o acesso não foi criado: ${resultado.erro ?? 'erro desconhecido'}`,
            )
          } else {
            await enviarAvatarDoAcesso(resultado.usuarioId)
            toast.success('Funcionário e acesso criados')
          }
        }
      }

      fecharModal()
      void carregarFuncionarios({ silencioso: true })
    } catch (erro) {
      console.error('Erro ao salvar funcionário:', erro)
      toast.error('Erro ao salvar funcionário')
    } finally {
      setSalvando(false)
    }
  }

  const excluirFuncionario = async (funcionario: Funcionario) => {
    const id = funcionario.id
    const ok = await confirmar({
      titulo: `Excluir "${funcionario.nome}"?`,
      descricao: 'O funcionário sai da equipe. Não dá para desfazer.',
      confirmar: 'Excluir funcionário',
      perigo: true,
    })
    if (!ok) return

    try {
      setProcessandoId(id)
      const { error } = await supabase.from('funcionarios').delete().eq('id', id)
      if (error) throw error
      toast.success('Funcionário excluído')
      fecharModal()
      void carregarFuncionarios({ silencioso: true })
    } catch (erro) {
      console.error('Erro ao excluir funcionário:', erro)
      toast.error('Erro ao excluir funcionário')
    } finally {
      setProcessandoId(null)
    }
  }

  const alternarStatus = async (funcionario: Funcionario) => {
    try {
      setProcessandoId(funcionario.id)
      const { error } = await supabase
        .from('funcionarios')
        .update({ ativo: !funcionario.ativo })
        .eq('id', funcionario.id)
      if (error) throw error
      toast.success(funcionario.ativo ? 'Funcionário desativado' : 'Funcionário ativado')
      void carregarFuncionarios({ silencioso: true })
    } catch (erro) {
      console.error('Erro ao alterar status:', erro)
      toast.error('Erro ao alterar status')
    } finally {
      setProcessandoId(null)
    }
  }

  const funcionariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return funcionarios.filter((f) => {
      if (filtroTipo !== 'todos' && f.tipo !== filtroTipo) return false
      if (filtroStatus === 'ativos' && !f.ativo) return false
      if (filtroStatus === 'inativos' && f.ativo) return false
      if (!termo) return true
      return (
        f.nome.toLowerCase().includes(termo) ||
        (f.telefone || '').toLowerCase().includes(termo)
      )
    })
  }, [funcionarios, busca, filtroTipo, filtroStatus])

  const resumo = useMemo(() => {
    const ativos = funcionarios.filter((f) => f.ativo).length
    const entregadores = funcionarios.filter((f) => f.tipo === 'entregador' && f.ativo).length
    return { total: funcionarios.length, ativos, entregadores }
  }, [funcionarios])

  const handleLimparFiltros = () => {
    setBusca('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
  }


  const temFiltro = Boolean(busca.trim()) || filtroTipo !== 'todos' || filtroStatus !== 'todos'

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Funcionários"
        descricao={`${resumo.total} na equipe · ${resumo.ativos} ativos · ${resumo.entregadores} entregadores`}
        acoes={
          <Botao onClick={abrirModalNovo}>
            <Plus className="size-4" />
            Novo funcionário
          </Botao>
        }
      />

      {funcionarios.length > 0 ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Entrada
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone"
              aria-label="Buscar funcionário"
              className="pl-9"
            />
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
            {(
              [
                { valor: 'todos', rotulo: 'Todos' },
                { valor: 'ativos', rotulo: 'Ativos' },
                { valor: 'inativos', rotulo: 'Inativos' },
              ] as const
            ).map((opcao) => (
              <Chip
                key={opcao.valor}
                ativo={filtroStatus === opcao.valor}
                onClick={() => setFiltroStatus(opcao.valor)}
              >
                {opcao.rotulo}
              </Chip>
            ))}
            <span className="mx-1 w-px shrink-0 self-stretch bg-border/70" aria-hidden />
            {TIPOS_FUNCIONARIO.map((tipo) => (
              <Chip
                key={tipo.valor}
                ativo={filtroTipo === tipo.valor}
                onClick={() => setFiltroTipo(filtroTipo === tipo.valor ? 'todos' : tipo.valor)}
              >
                {tipo.rotulo}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      {carregando ? (
        <ListaCarregando linhas={6} />
      ) : funcionariosFiltrados.length === 0 ? (
        <ListaVazia
          icone={<Users />}
          titulo={funcionarios.length === 0 ? 'Nenhum funcionário cadastrado' : 'Ninguém encontrado'}
          descricao={
            funcionarios.length === 0
              ? 'Cadastre a equipe para controlar entregas e operações.'
              : 'Tente outra busca ou outro filtro.'
          }
          acao={
            funcionarios.length === 0 ? (
              <Botao onClick={abrirModalNovo}>
                <Plus className="size-4" />
                Novo funcionário
              </Botao>
            ) : temFiltro ? (
              <Botao variante="contorno" onClick={handleLimparFiltros}>
                Limpar filtros
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <Lista>
          {funcionariosFiltrados.map((funcionario) => (
            <li key={funcionario.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => abrirModalEditar(funcionario)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter') abrirModalEditar(funcionario)
                }}
                className={cn(
                  'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  !funcionario.ativo && 'opacity-60',
                )}
              >
                <AvatarUsuario nome={funcionario.nome} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{funcionario.nome}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    <span>{rotuloTipo(funcionario.tipo)}</span>
                    {funcionario.telefone ? <span className="tabular-nums">· {funcionario.telefone}</span> : null}
                    {!funcionario.ativo ? <Selo>Inativo</Selo> : null}
                  </div>
                </div>
                <Interruptor
                  marcado={funcionario.ativo}
                  desabilitado={processandoId === funcionario.id}
                  aoMudar={() => void alternarStatus(funcionario)}
                  rotuloAcessivel={`${funcionario.ativo ? 'Desativar' : 'Ativar'} ${funcionario.nome}`}
                />
              </div>
            </li>
          ))}
        </Lista>
      )}

      <Gaveta
        aberto={modalAberto}
        aoFechar={fecharModal}
        bloqueada={salvando}
        titulo={funcionarioEditando ? 'Editar funcionário' : 'Novo funcionário'}
        descricao="Dados usados em entregas e operações do dia a dia."
        rodape={
          funcionarioEditando ? (
            <>
              <Botao
                variante="perigoSuave"
                className="md:mr-auto"
                onClick={() => void excluirFuncionario(funcionarioEditando)}
                disabled={salvando || processandoId === funcionarioEditando.id}
              >
                Excluir
              </Botao>
              <Botao
                carregando={salvando}
                onClick={() => void salvarFuncionario()}
                disabled={!formulario.nome.trim()}
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
                onClick={() => void salvarFuncionario()}
                disabled={!formulario.nome.trim()}
              >
                Cadastrar
              </Botao>
            </>
          )
        }
      >
        <form
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            void salvarFuncionario()
          }}
        >
          <Campo rotulo="Nome" htmlFor="func-nome">
            <Entrada
              id="func-nome"
              value={formulario.nome}
              onChange={(e) => alterarNome(e.target.value)}
              onBlur={() => void aoSairDoNome()}
              placeholder="Nome completo"
              autoComplete="off"
            />
          </Campo>

          <Campo rotulo="Telefone" htmlFor="func-telefone" opcional>
            <Entrada
              id="func-telefone"
              type="tel"
              inputMode="tel"
              value={formulario.telefone}
              onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </Campo>

          <Campo rotulo="Função">
            <Segmentos
              opcoes={TIPOS_FUNCIONARIO}
              valor={formulario.tipo}
              aoMudar={alterarTipo}
              rotuloAcessivel="Função"
            />
          </Campo>

          <LinhaInterruptor
            titulo="Ativo"
            descricao="Pode aparecer nas operações."
            marcado={formulario.ativo}
            aoMudar={(ativo) => setFormulario({ ...formulario, ativo })}
            rotuloAcessivel="Funcionário ativo"
          />

          {!funcionarioEditando ? (
            <div className="space-y-4">
              <LinhaInterruptor
                titulo="Criar acesso ao sistema"
                descricao="Já cadastra o login em Usuários, ligado a esta pessoa."
                marcado={criarAcesso}
                aoMudar={setCriarAcesso}
                rotuloAcessivel="Criar acesso ao sistema"
              />

              {criarAcesso ? (
                <div className="space-y-4 rounded-xl border border-border/70 p-4">
                  <div className="flex items-center gap-3">
                    <AvatarUsuario
                      nome={formulario.nome || 'Novo'}
                      src={avatarPreview}
                      cor={acesso.corAvatar}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <Botao variante="contorno" tamanho="sm" onClick={() => inputAvatarRef.current?.click()}>
                        <Camera className="size-4" />
                        {avatarPreview ? 'Trocar foto' : 'Adicionar foto'}
                      </Botao>
                      <p className="mt-1 text-[13px] text-muted-foreground">Opcional. Sem foto, usamos as iniciais.</p>
                    </div>
                    <input
                      ref={inputAvatarRef}
                      type="file"
                      accept="image/*"
                      onChange={(evento) => void aoSelecionarFoto(evento)}
                      className="hidden"
                    />
                  </div>

                  <Campo rotulo="Nome de usuário" htmlFor="func-login" ajuda="É o que a pessoa digita para entrar.">
                    <Entrada
                      id="func-login"
                      value={acesso.nomeUsuario}
                      onChange={(e) => {
                        loginEditadoManualmente.current = true
                        setAcesso({
                          ...acesso,
                          nomeUsuario: e.target.value.toLowerCase().replace(/\s/g, ''),
                        })
                      }}
                      placeholder="nome_usuario"
                      autoCapitalize="none"
                      autoComplete="off"
                    />
                  </Campo>

                  <Campo rotulo="Senha" htmlFor="func-senha">
                    <div className="relative">
                      <Entrada
                        id="func-senha"
                        type={mostrarSenha ? 'text' : 'password'}
                        value={acesso.senha}
                        onChange={(e) => setAcesso({ ...acesso, senha: e.target.value })}
                        placeholder="Mínimo 4 caracteres"
                        autoComplete="new-password"
                        className="pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarSenha((atual) => !atual)}
                        className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                        aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      >
                        {mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </Campo>

                  <Campo rotulo="O que o login pode acessar">
                    <Segmentos
                      opcoes={PAPEIS_ACESSO}
                      valor={acesso.papel}
                      aoMudar={(papel) => setAcesso({ ...acesso, papel })}
                      rotuloAcessivel="Acesso do login"
                    />
                  </Campo>

                  <Campo rotulo="Cor do avatar">
                    <div className="flex flex-wrap gap-2">
                      {CORES_AVATAR.map((cor) => (
                        <button
                          key={cor}
                          type="button"
                          onClick={() => setAcesso({ ...acesso, corAvatar: cor })}
                          className={cn(
                            'size-10 rounded-lg transition-shadow',
                            acesso.corAvatar === cor && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                          )}
                          style={{ backgroundColor: cor }}
                          aria-label={`Cor ${cor}`}
                          aria-pressed={acesso.corAvatar === cor}
                        />
                      ))}
                    </div>
                  </Campo>
                </div>
              ) : null}
            </div>
          ) : null}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Gaveta>

      <ModalRecorteAvatar
        aberto={recorteAberto}
        imagemUrl={imagemParaRecorte}
        onFechar={() => setRecorteAberto(false)}
        onConfirmar={aoConfirmarRecorte}
        titulo="Ajustar foto do acesso"
      />
    </Pagina>
  )
}
