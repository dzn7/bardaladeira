'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Shield,
  UtensilsCrossed,
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Key,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Camera,
  Save,
} from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
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
  const [usuarioExclusao, setUsuarioExclusao] = useState<UsuarioComStatus | null>(null)
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

  const confirmarExclusao = async () => {
    if (!usuarioExclusao) return

    const resultado = await excluirUsuarioSistema(usuarioExclusao.id)
    if (resultado.sucesso) {
      toast.success('Usuário excluído')
      setUsuarioExclusao(null)
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

  const chipsFiltroAtivo = useMemo((): ChipFiltroAtivo[] => {
    const chips: ChipFiltroAtivo[] = []
    if (busca.trim()) chips.push({ key: 'busca', label: 'Busca', value: busca.trim() })
    if (filtroPapel !== 'todos') {
      chips.push({ key: 'papel', label: 'Função', value: rotuloPapel(filtroPapel) })
    }
    return chips
  }, [busca, filtroPapel])

  const handleLimparFiltros = () => {
    setBusca('')
    setFiltroPapel('todos')
  }

  const itensAcao = (usuario: UsuarioComStatus): MenuAcaoItem[] => [
    {
      key: 'editar',
      label: 'Editar',
      icon: <Edit2 className="h-4 w-4" />,
      onSelect: () => abrirModalEditar(usuario),
    },
    {
      key: 'senha',
      label: 'Alterar senha',
      icon: <Key className="h-4 w-4" />,
      onSelect: () => abrirModalSenha(usuario),
    },
    {
      key: 'avatar',
      label: enviandoAvatar === usuario.id ? 'Enviando…' : 'Alterar avatar',
      icon: <Camera className="h-4 w-4" />,
      disabled: enviandoAvatar === usuario.id,
      onSelect: () => abrirUploadAvatar(usuario),
    },
    {
      key: 'toggle',
      label: usuario.ativo ? 'Desativar' : 'Ativar',
      icon: usuario.ativo ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />,
      onSelect: () => void handleAlternarStatus(usuario),
    },
    {
      key: 'excluir',
      label: 'Excluir',
      icon: <Trash2 className="h-4 w-4" />,
      separatorBefore: true,
      variant: 'destructive',
      onSelect: () => setUsuarioExclusao(usuario),
    },
  ]

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Acessos do sistema</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Logins do painel, garçom e entregador.
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
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Admins</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.admins}</p>
          </div>
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Garçons</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.garcons}</p>
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
            {usuariosFiltrados.length}{' '}
            {usuariosFiltrados.length === 1 ? 'usuário' : 'usuários'}
          </span>
        </div>

        <div className="mb-3 flex flex-col gap-3">
          <div className="relative min-w-0 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou usuário…"
              className="h-9 border-border/70 bg-background pl-9 shadow-none"
              aria-label="Buscar usuário do sistema"
            />
          </div>

          <div className="w-full overflow-x-auto">
            <ToggleGroup
              type="single"
              value={filtroPapel}
              onValueChange={(valor) => {
                if (!valor) return
                setFiltroPapel(valor as PapelUsuario | 'todos')
              }}
              aria-label="Filtrar por função"
              className="flex w-max items-center justify-start gap-2"
            >
              {FILTROS_PAPEL.map((item) => (
                <ToggleGroupItem key={item.valor} value={item.valor} className={CHIP_FILTRO_DEFAULT}>
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <FiltrosAtivosChips chips={chipsFiltroAtivo} onLimpar={handleLimparFiltros} />
        </div>

        {carregando ? (
          <TabelaSkeleton linhas={6} />
        ) : usuariosFiltrados.length === 0 ? (
          <ListaVazia
            icone={<Shield className="h-5 w-5" />}
            titulo={
              usuarios.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum resultado'
            }
            descricao={
              usuarios.length === 0
                ? 'Cadastre acessos para o painel, garçom e entregador.'
                : 'Ajuste a busca ou o filtro de função.'
            }
            acao={
              usuarios.length === 0 ? (
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Usuário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Função</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Login</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((usuario) => {
                    const Icone = PAPEIS.find((p) => p.valor === usuario.papel)?.icone ?? Shield

                    return (
                      <tr
                        key={usuario.id}
                        className={cn(
                          'border-b border-border/40 last:border-0 hover:bg-muted/20',
                          !usuario.ativo && 'opacity-60',
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => abrirUploadAvatar(usuario)}
                              className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Alterar avatar de ${usuario.nome}`}
                            >
                              {enviandoAvatar === usuario.id ? (
                                <span className="flex size-9 items-center justify-center rounded-full bg-primary">
                                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                                </span>
                              ) : (
                                <AvatarUsuario
                                  nome={usuario.nome}
                                  src={usuario.avatar_url}
                                  cor={usuario.cor_avatar}
                                  size="sm"
                                  className="size-9"
                                />
                              )}
                              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-all group-hover:bg-black/40">
                                <Camera className="h-3.5 w-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                              </span>
                            </button>
                            <p className="truncate font-medium text-foreground">{usuario.nome}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Icone className="h-3.5 w-3.5 text-primary" />
                            {rotuloPapel(usuario.papel)}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">
                          @{usuario.nome_usuario}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              usuario.ativo
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : 'border-border/70 bg-muted/40 text-muted-foreground',
                            )}
                          >
                            {usuario.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <MenuAcoes
                            ariaLabel={`Ações de ${usuario.nome}`}
                            items={itensAcao(usuario)}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {usuariosFiltrados.map((usuario) => {
                const Icone = PAPEIS.find((p) => p.valor === usuario.papel)?.icone ?? Shield

                return (
                  <article
                    key={usuario.id}
                    className={cn(
                      'rounded-xl border border-border/70 bg-background p-4',
                      !usuario.ativo && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <button
                          type="button"
                          onClick={() => abrirUploadAvatar(usuario)}
                          className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Alterar avatar de ${usuario.nome}`}
                        >
                          {enviandoAvatar === usuario.id ? (
                            <span className="flex size-10 items-center justify-center rounded-full bg-primary">
                              <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
                            </span>
                          ) : (
                            <AvatarUsuario
                              nome={usuario.nome}
                              src={usuario.avatar_url}
                              cor={usuario.cor_avatar}
                              size="md"
                            />
                          )}
                        </button>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{usuario.nome}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Icone className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">
                              {rotuloPapel(usuario.papel)} · @{usuario.nome_usuario}
                            </span>
                          </p>
                        </div>
                      </div>
                      <MenuAcoes
                        ariaLabel={`Ações de ${usuario.nome}`}
                        items={itensAcao(usuario)}
                      />
                    </div>
                    <div className="mt-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                          usuario.ativo
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'border-border/70 bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {usuario.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </div>

      <input
        ref={inputAvatarRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={aoSelecionarArquivoAvatar}
        className="hidden"
      />

      <ModalRecorteAvatar
        aberto={recorteAvatarAberto}
        imagemUrl={imagemParaRecorte}
        onFechar={() => setRecorteAvatarAberto(false)}
        onConfirmar={aoConfirmarRecorteAvatar}
        titulo="Ajustar Avatar"
      />

      <Dialog
        open={modalAberto}
        onOpenChange={(aberto) => {
          if (!aberto) fecharModal()
          else setModalAberto(true)
        }}
      >
        <DialogContent className="flex max-h-[92dvh] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-h-[90dvh]">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="text-[15px] font-semibold tracking-tight">
              {editando ? 'Editar usuário' : 'Novo usuário do sistema'}
            </DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              Defina nome, login e função de acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="usr-nome">Nome *</Label>
              <Input
                id="usr-nome"
                value={formulario.nome}
                onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
                placeholder="Nome completo"
                className="h-11 border-border/70 shadow-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usr-login">
                Nome de usuário *{editando ? ' (não editável)' : ''}
              </Label>
              <Input
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
                className="h-11 border-border/70 shadow-none"
              />
            </div>

            {!editando && (
              <div className="space-y-2">
                <Label htmlFor="usr-senha">Senha *</Label>
                <div className="relative">
                  <Input
                    id="usr-senha"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={formulario.senha}
                    onChange={(e) => setFormulario({ ...formulario, senha: e.target.value })}
                    placeholder="Mínimo 4 caracteres"
                    className="h-11 border-border/70 pr-12 shadow-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Função *</Label>
              <div className="flex flex-wrap gap-1.5">
                {PAPEIS.map((papel) => {
                  const Icone = papel.icone
                  const selecionado = formulario.papel === papel.valor
                  return (
                    <button
                      key={papel.valor}
                      type="button"
                      onClick={() => alterarPapel(papel.valor)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                        selecionado
                          ? 'border-primary/25 bg-primary/10 text-primary'
                          : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                      )}
                    >
                      <Icone className="h-3.5 w-3.5" />
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
                    onClick={() => setFormulario({ ...formulario, corAvatar: cor })}
                    className={cn(
                      'h-9 w-9 rounded-xl transition-all',
                      formulario.corAvatar === cor && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    )}
                    style={{ backgroundColor: cor }}
                    aria-label={`Cor ${cor}`}
                  />
                ))}
              </div>
            </div>

            {!editando ? (
              <div className="space-y-4 rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <UserCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      Cadastrar como funcionário
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Cria em Funcionários e liga a esta conta. Se já existir alguém com o
                      mesmo nome, aproveita o cadastro.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={criarFuncionario}
                    aria-label={
                      criarFuncionario ? 'Não cadastrar funcionário' : 'Cadastrar funcionário'
                    }
                    onClick={() => setCriarFuncionario((atual) => !atual)}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                      criarFuncionario ? 'bg-primary' : 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                        criarFuncionario && 'translate-x-5',
                      )}
                    />
                  </button>
                </div>

                {criarFuncionario ? (
                  <div className="space-y-4 border-t border-border/50 pt-4">
                    <div className="space-y-2">
                      <Label>Função na equipe</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {TIPOS_FUNCIONARIO.map((tipo) => {
                          const selecionado = tipoFuncionario === tipo.valor
                          return (
                            <button
                              key={tipo.valor}
                              type="button"
                              onClick={() => setTipoFuncionario(tipo.valor)}
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

                    <div className="space-y-2">
                      <Label htmlFor="usr-telefone">Telefone (opcional)</Label>
                      <Input
                        id="usr-telefone"
                        type="tel"
                        value={telefoneFuncionario}
                        onChange={(e) => setTelefoneFuncionario(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="h-11 border-border/70 shadow-none"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-foreground">Ativo</p>
                <p className="text-xs text-muted-foreground">Pode fazer login no sistema</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={formulario.ativo}
                aria-label={formulario.ativo ? 'Desativar usuário' : 'Ativar usuário'}
                onClick={() => setFormulario({ ...formulario, ativo: !formulario.ativo })}
                className={cn(
                  'relative h-6 w-11 rounded-full transition-colors',
                  formulario.ativo ? 'bg-primary' : 'bg-muted',
                )}
              >
                <span
                  className={cn(
                    'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    formulario.ativo && 'translate-x-5',
                  )}
                />
              </button>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:gap-2 sm:px-5 sm:pb-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full shadow-none sm:h-9 sm:w-auto"
              onClick={fecharModal}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 w-full shadow-none sm:h-9 sm:min-w-[140px] sm:w-auto"
              onClick={() => void salvarUsuario()}
              disabled={salvando || !formulario.nome.trim() || !formulario.nomeUsuario.trim()}
            >
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modalSenhaAberto}
        onOpenChange={(aberto) => {
          if (!aberto) setModalSenhaAberto(false)
        }}
      >
        <DialogContent className="flex max-h-[92dvh] w-full max-w-sm flex-col gap-0 overflow-hidden p-0 sm:max-h-[90dvh]">
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
            <DialogTitle className="text-[15px] font-semibold tracking-tight">Alterar senha</DialogTitle>
            <DialogDescription className="text-[13px] text-muted-foreground">
              {usuarioSenha
                ? `Nova senha para ${usuarioSenha.nome}.`
                : 'Defina a nova senha do usuário.'}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="relative">
              <Input
                type={mostrarSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Nova senha (mínimo 4 caracteres)"
                className="h-11 border-border/70 pr-12 shadow-none"
                aria-label="Nova senha"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:gap-2 sm:px-5 sm:pb-4">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full shadow-none sm:h-9 sm:w-auto"
              onClick={() => setModalSenhaAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="h-11 w-full shadow-none sm:h-9 sm:min-w-[140px] sm:w-auto"
              onClick={() => void handleAlterarSenha()}
              disabled={salvando || novaSenha.length < 4}
            >
              {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              Alterar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(usuarioExclusao)} onOpenChange={(aberto) => !aberto && setUsuarioExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              {usuarioExclusao
                ? `Excluir o acesso de ${usuarioExclusao.nome}? Essa ação remove o login do painel.`
                : 'Confirme a exclusão do usuário.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmarExclusao()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir usuário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
