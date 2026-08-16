'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Eye, EyeOff, KeyRound, Loader2, Plus, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { FiltroFuncionariosAdmin } from '@/components/admin/funcionarios/FiltroFuncionariosAdmin'
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

  const excluirFuncionario = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return

    try {
      setProcessandoId(id)
      const { error } = await supabase.from('funcionarios').delete().eq('id', id)
      if (error) throw error
      toast.success('Funcionário excluído')
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

  const chipsFiltro: ChipFiltroAtivo[] = useMemo(() => {
    const chips: ChipFiltroAtivo[] = []
    if (busca.trim()) chips.push({ key: 'busca', label: 'Busca', value: busca.trim() })
    if (filtroTipo !== 'todos') {
      chips.push({ key: 'tipo', label: 'Função', value: rotuloTipo(filtroTipo) })
    }
    if (filtroStatus !== 'todos') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: filtroStatus === 'ativos' ? 'Ativos' : 'Inativos',
      })
    }
    return chips
  }, [busca, filtroTipo, filtroStatus])

  const handleLimparFiltros = () => {
    setBusca('')
    setFiltroTipo('todos')
    setFiltroStatus('todos')
  }

  const itensAcao = (funcionario: Funcionario): MenuAcaoItem[] => [
    {
      key: 'editar',
      label: 'Editar',
      onSelect: () => abrirModalEditar(funcionario),
    },
    {
      key: 'toggle',
      label: funcionario.ativo ? 'Desativar' : 'Ativar',
      disabled: processandoId === funcionario.id,
      onSelect: () => void alternarStatus(funcionario),
    },
    {
      key: 'excluir',
      label: 'Excluir',
      disabled: processandoId === funcionario.id,
      separatorBefore: true,
      variant: 'destructive',
      onSelect: () => void excluirFuncionario(funcionario.id),
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Funcionários</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Equipe operacional — entregadores, cozinha e atendimento.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Total</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.total}</p>
          </div>
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ativos</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.ativos}</p>
          </div>
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Entregadores</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.entregadores}</p>
          </div>
          <Button type="button" size="sm" className="h-9 shadow-none" onClick={abrirModalNovo}>
            <Plus className="mr-2 h-4 w-4" />
            Novo
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-foreground/90">Lista</span>
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {funcionariosFiltrados.length}{' '}
            {funcionariosFiltrados.length === 1 ? 'pessoa' : 'pessoas'}
          </span>
        </div>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou telefone…"
              className="h-9 border-border/70 bg-background pl-9 shadow-none"
              aria-label="Buscar funcionário"
            />
          </div>
          <FiltroFuncionariosAdmin
            hasFilter={filtroTipo !== 'todos' || filtroStatus !== 'todos'}
            onLimpar={handleLimparFiltros}
            valor={{
              tipo: filtroTipo === 'todos' ? 'todos' : filtroTipo,
              status: filtroStatus,
            }}
            onChange={(proximo) => {
              if (proximo.tipo !== undefined) {
                setFiltroTipo(proximo.tipo === 'todos' ? 'todos' : proximo.tipo)
              }
              if (proximo.status !== undefined) setFiltroStatus(proximo.status)
            }}
          />
        </div>

        <FiltrosAtivosChips chips={chipsFiltro} onLimpar={handleLimparFiltros} className="mb-4" />

        {carregando ? (
          <TabelaSkeleton linhas={6} />
        ) : funcionariosFiltrados.length === 0 ? (
          <ListaVazia
            icone={<Users className="h-5 w-5" />}
            titulo={
              funcionarios.length === 0 ? 'Nenhum funcionário cadastrado' : 'Nenhum resultado'
            }
            descricao={
              funcionarios.length === 0
                ? 'Cadastre a equipe para controlar entregas e operações.'
                : 'Ajuste a busca ou os filtros.'
            }
            acao={
              funcionarios.length === 0 ? (
                <Button type="button" size="sm" className="mt-2 shadow-none" onClick={abrirModalNovo}>
                  <Plus className="mr-2 h-4 w-4" />
                  Cadastrar
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Função</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Telefone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {funcionariosFiltrados.map((funcionario) => (
                    <tr
                      key={funcionario.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{funcionario.nome}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {rotuloTipo(funcionario.tipo)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {funcionario.telefone || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            funcionario.ativo
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-border/70 bg-muted/40 text-muted-foreground',
                          )}
                        >
                          {funcionario.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MenuAcoes
                          ariaLabel={`Ações de ${funcionario.nome}`}
                          items={itensAcao(funcionario)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {funcionariosFiltrados.map((funcionario) => (
                <article
                  key={funcionario.id}
                  className="rounded-xl border border-border/70 bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{funcionario.nome}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {rotuloTipo(funcionario.tipo)}
                        {funcionario.telefone ? ` · ${funcionario.telefone}` : ''}
                      </p>
                    </div>
                    <MenuAcoes
                      ariaLabel={`Ações de ${funcionario.nome}`}
                      items={itensAcao(funcionario)}
                    />
                  </div>
                  <div className="mt-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        funcionario.ativo
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'border-border/70 bg-muted/40 text-muted-foreground',
                      )}
                    >
                      {funcionario.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={modalAberto}
        onOpenChange={(aberto) => {
          if (!aberto) fecharModal()
          else setModalAberto(true)
        }}
      >
        <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="text-[15px] font-semibold tracking-tight">
              {funcionarioEditando ? 'Editar funcionário' : 'Novo funcionário'}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Dados usados em entregas e operações do dia a dia.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="func-nome">Nome</Label>
              <Input
                id="func-nome"
                value={formulario.nome}
                onChange={(e) => alterarNome(e.target.value)}
                onBlur={() => void aoSairDoNome()}
                placeholder="Nome completo"
                className="h-10 border-border/70 shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="func-telefone">Telefone</Label>
              <Input
                id="func-telefone"
                type="tel"
                value={formulario.telefone}
                onChange={(e) => setFormulario({ ...formulario, telefone: e.target.value })}
                placeholder="(00) 00000-0000"
                className="h-10 border-border/70 shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <div className="flex flex-wrap gap-1.5">
                {TIPOS_FUNCIONARIO.map((tipo) => {
                  const selecionado = formulario.tipo === tipo.valor
                  return (
                    <button
                      key={tipo.valor}
                      type="button"
                      onClick={() => alterarTipo(tipo.valor)}
                      className={cn(
                        'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                        selecionado
                          ? 'border-primary/25 bg-primary/10 text-primary'
                          : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      {tipo.rotulo}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Ativo</p>
                <p className="text-xs text-muted-foreground">Pode aparecer nas operações</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formulario.ativo}
                aria-label={formulario.ativo ? 'Desativar funcionário' : 'Ativar funcionário'}
                onClick={() => setFormulario({ ...formulario, ativo: !formulario.ativo })}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  formulario.ativo ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    formulario.ativo && 'translate-x-5',
                  )}
                />
              </button>
            </div>

            {!funcionarioEditando ? (
              <div className="space-y-4 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <KeyRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Criar acesso ao sistema
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Já cadastra o login em Usuários, vinculado a esta pessoa.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={criarAcesso}
                    aria-label={criarAcesso ? 'Não criar acesso' : 'Criar acesso'}
                    onClick={() => setCriarAcesso((atual) => !atual)}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      criarAcesso ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                        criarAcesso && 'translate-x-5',
                      )}
                    />
                  </button>
                </div>

                {criarAcesso ? (
                  <div className="space-y-4 border-t border-border/50 pt-4">
                    <div className="flex items-center gap-3">
                      <AvatarUsuario
                        nome={formulario.nome || 'Novo'}
                        src={avatarPreview}
                        cor={acesso.corAvatar}
                        size="lg"
                      />
                      <div className="min-w-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 shadow-none"
                          onClick={() => inputAvatarRef.current?.click()}
                        >
                          <Camera className="mr-2 h-3.5 w-3.5" />
                          {avatarPreview ? 'Trocar foto' : 'Adicionar foto'}
                        </Button>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Opcional — sem foto usamos as iniciais.
                        </p>
                      </div>
                      <input
                        ref={inputAvatarRef}
                        type="file"
                        accept="image/*"
                        onChange={(evento) => void aoSelecionarFoto(evento)}
                        className="hidden"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="func-login">Nome de usuário</Label>
                      <Input
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
                        className="h-10 border-border/70 shadow-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="func-senha">Senha</Label>
                      <div className="relative">
                        <Input
                          id="func-senha"
                          type={mostrarSenha ? 'text' : 'password'}
                          value={acesso.senha}
                          onChange={(e) => setAcesso({ ...acesso, senha: e.target.value })}
                          placeholder="Mínimo 4 caracteres"
                          className="h-10 border-border/70 pr-12 shadow-none"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenha((atual) => !atual)}
                          className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                          aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                          {mostrarSenha ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Acesso do login</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {PAPEIS_ACESSO.map((papel) => {
                          const selecionado = acesso.papel === papel.valor
                          return (
                            <button
                              key={papel.valor}
                              type="button"
                              onClick={() => setAcesso({ ...acesso, papel: papel.valor })}
                              className={cn(
                                'inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
                                selecionado
                                  ? 'border-primary/25 bg-primary/10 text-primary'
                                  : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                              )}
                            >
                              {papel.rotulo}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Cor do avatar</Label>
                      <div className="flex flex-wrap gap-2">
                        {CORES_AVATAR.map((cor) => (
                          <button
                            key={cor}
                            type="button"
                            onClick={() => setAcesso({ ...acesso, corAvatar: cor })}
                            className={cn(
                              'h-8 w-8 rounded-lg transition-all',
                              acesso.corAvatar === cor &&
                                'ring-2 ring-primary ring-offset-2 ring-offset-background',
                            )}
                            style={{ backgroundColor: cor }}
                            aria-label={`Cor ${cor}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-5 py-4 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 shadow-none"
              onClick={fecharModal}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-9 shadow-none"
              onClick={() => void salvarFuncionario()}
              disabled={salvando || !formulario.nome.trim()}
            >
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModalRecorteAvatar
        aberto={recorteAberto}
        imagemUrl={imagemParaRecorte}
        onFechar={() => setRecorteAberto(false)}
        onConfirmar={aoConfirmarRecorte}
        titulo="Ajustar foto do acesso"
      />
    </div>
  )
}
