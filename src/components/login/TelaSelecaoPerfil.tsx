'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Lock } from 'lucide-react'
import Image from 'next/image'
import CardPerfilUsuario from './CardPerfilUsuario'
import ModalSenhaLogin from './ModalSenhaLogin'
import TransicaoLogin from './TransicaoLogin'
import {
  listarUsuariosPorPapel,
  loginUsuarioSistema,
  type UsuarioSistema,
  type PapelUsuario,
} from '@/lib/autenticacao'

type TelaSelecaoPerfilProps = {
  papel: PapelUsuario
  aoAutenticar: (usuario: UsuarioSistema) => void
  loginHardcoded?: (usuario: string, senha: string) => boolean
  rotaLoginClassico?: string
}

const TITULOS_PAPEL: Record<PapelUsuario, string> = {
  admin: 'Painel Administrativo',
  garcom: 'Painel do Garcom',
  entregador: 'Painel de Entregas',
}

export default function TelaSelecaoPerfil({
  papel,
  aoAutenticar,
  loginHardcoded,
  rotaLoginClassico,
}: TelaSelecaoPerfilProps) {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([])
  const [carregando, setCarregando] = useState(true)
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<UsuarioSistema | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [loginEmAndamento, setLoginEmAndamento] = useState(false)
  const [modoClassico, setModoClassico] = useState(false)
  const [usuarioClassico, setUsuarioClassico] = useState('')
  const [senhaClassica, setSenhaClassica] = useState('')
  const [transicaoAtiva, setTransicaoAtiva] = useState(false)
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<UsuarioSistema | null>(null)

  useEffect(() => {
    carregarUsuarios()
  }, [papel])

  const carregarUsuarios = async () => {
    setCarregando(true)
    const lista = await listarUsuariosPorPapel(papel)
    setUsuarios(lista)
    setCarregando(false)
  }

  const handleSelecionarPerfil = (usuario: UsuarioSistema) => {
    setUsuarioSelecionado(usuario)
    setErroLogin('')
    setModalAberto(true)
  }

  const iniciarTransicao = useCallback((usuario: UsuarioSistema) => {
    setUsuarioAutenticado(usuario)
    setModalAberto(false)
    setTransicaoAtiva(true)
  }, [])

  const finalizarTransicao = useCallback(() => {
    if (usuarioAutenticado) {
      aoAutenticar(usuarioAutenticado)
    }
  }, [usuarioAutenticado, aoAutenticar])

  const handleLoginPerfil = async (senha: string) => {
    if (!usuarioSelecionado) return
    setLoginEmAndamento(true)
    setErroLogin('')

    const resultado = await loginUsuarioSistema(usuarioSelecionado.nome_usuario, senha)
    if (resultado.sucesso && resultado.usuario) {
      iniciarTransicao(resultado.usuario)
    } else {
      setErroLogin(resultado.erro || 'Senha incorreta')
    }
    setLoginEmAndamento(false)
  }

  const handleLoginClassico = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuarioClassico.trim() || !senhaClassica.trim()) return
    setLoginEmAndamento(true)
    setErroLogin('')

    if (loginHardcoded) {
      const sucesso = loginHardcoded(usuarioClassico, senhaClassica)
      if (sucesso) {
        setLoginEmAndamento(false)
        return
      }
    }

    const resultado = await loginUsuarioSistema(usuarioClassico, senhaClassica)
    if (resultado.sucesso && resultado.usuario) {
      iniciarTransicao(resultado.usuario)
    } else {
      setErroLogin(resultado.erro || 'Credenciais invalidas')
    }
    setLoginEmAndamento(false)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Background cinematografico */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-zinc-950 to-black" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-laranja-600/[0.04] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-laranja-700/[0.03] rounded-full blur-[100px]" />
      </div>

      {/* Header com logo */}
      <header className="relative z-10 pt-12 sm:pt-16 pb-6 px-4">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src="/logo.webp"
              alt="Bar da Ladeira"
              width={72}
              height={72}
              className="rounded-2xl shadow-2xl shadow-black/50"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="text-center space-y-2"
          >
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {TITULOS_PAPEL[papel]}
            </h1>
            <p className="text-sm text-zinc-500">
              {!modoClassico ? 'Quem esta acessando?' : 'Entre com suas credenciais'}
            </p>
          </motion.div>
        </motion.div>
      </header>

      {/* Conteudo principal */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <AnimatePresence mode="wait">
          {carregando ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-16"
            >
              <div className="w-12 h-12 rounded-full border-2 border-zinc-800 border-t-laranja-500 animate-spin" />
              <p className="text-sm text-zinc-600">Carregando perfis...</p>
            </motion.div>
          ) : !modoClassico && usuarios.length > 0 ? (
            <motion.div
              key="profiles"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl"
            >
              <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
                {usuarios.map((usuario, indice) => (
                  <CardPerfilUsuario
                    key={usuario.id}
                    nome={usuario.nome}
                    papel={usuario.papel}
                    corAvatar={usuario.cor_avatar}
                    avatarUrl={usuario.avatar_url}
                    indice={indice}
                    aoClicar={() => handleSelecionarPerfil(usuario)}
                  />
                ))}
              </div>

              {(loginHardcoded || rotaLoginClassico) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mt-12 flex justify-center"
                >
                  <button
                    onClick={() => setModoClassico(true)}
                    className="flex items-center gap-2.5 px-5 py-2.5 text-sm text-zinc-600 hover:text-zinc-300
                             border border-zinc-800/60 hover:border-zinc-700 rounded-lg transition-all duration-300 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Entrar com usuario e senha
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : !modoClassico && usuarios.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 max-w-sm"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/50 flex items-center justify-center">
                <Lock className="w-8 h-8 text-zinc-700" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">Nenhum perfil cadastrado</h2>
              <p className="text-sm text-zinc-500 mb-8">
                Cadastre usuarios no painel administrativo ou entre com usuario e senha.
              </p>
              {(loginHardcoded || rotaLoginClassico) && (
                <button
                  onClick={() => setModoClassico(true)}
                  className="px-6 py-3 text-sm font-semibold text-white bg-laranja-600 hover:bg-laranja-700
                           rounded-lg transition-colors duration-300 cursor-pointer"
                >
                  Entrar com usuario e senha
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="classic"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-sm"
            >
              <form onSubmit={handleLoginClassico} className="space-y-5">
                <div className="bg-zinc-900/70 backdrop-blur-sm border border-zinc-800/60 rounded-2xl p-7 space-y-5">
                  <h2 className="text-lg font-bold text-white text-center mb-1">
                    Entrar com credenciais
                  </h2>

                  <AnimatePresence>
                    {erroLogin && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-900/40">
                          <p className="text-sm text-red-400">{erroLogin}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <input
                    type="text"
                    value={usuarioClassico}
                    onChange={(e) => setUsuarioClassico(e.target.value)}
                    placeholder="Usuario"
                    autoComplete="username"
                    className="w-full px-4 py-3.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl
                             text-white placeholder-zinc-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-laranja-500/70 focus:border-transparent
                             transition-all duration-300"
                  />

                  <input
                    type="password"
                    value={senhaClassica}
                    onChange={(e) => setSenhaClassica(e.target.value)}
                    placeholder="Senha"
                    autoComplete="current-password"
                    className="w-full px-4 py-3.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl
                             text-white placeholder-zinc-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-laranja-500/70 focus:border-transparent
                             transition-all duration-300"
                  />

                  <button
                    type="submit"
                    disabled={loginEmAndamento || !usuarioClassico.trim() || !senhaClassica.trim()}
                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-white cursor-pointer
                             bg-laranja-600 hover:bg-laranja-700
                             disabled:opacity-40 disabled:cursor-not-allowed
                             transition-all duration-300 shadow-lg shadow-laranja-900/20"
                  >
                    {loginEmAndamento ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Entrando...
                      </span>
                    ) : (
                      'Entrar'
                    )}
                  </button>
                </div>

                {usuarios.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setModoClassico(false)
                      setErroLogin('')
                    }}
                    className="w-full text-center text-sm text-zinc-600 hover:text-zinc-300 transition-colors duration-300 py-2 cursor-pointer"
                  >
                    Voltar para selecao de perfis
                  </button>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 pb-8 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-xs text-zinc-800"
        >
          Bar da Ladeira &copy; 2026
        </motion.p>
      </footer>

      {/* Modal de senha */}
      {usuarioSelecionado && (
        <ModalSenhaLogin
          usuario={usuarioSelecionado}
          aberto={modalAberto}
          carregando={loginEmAndamento}
          erro={erroLogin}
          aoFechar={() => {
            setModalAberto(false)
            setErroLogin('')
          }}
          aoSubmeter={handleLoginPerfil}
        />
      )}

      {/* Transicao de login */}
      {usuarioAutenticado && (
        <TransicaoLogin
          ativo={transicaoAtiva}
          nome={usuarioAutenticado.nome}
          corAvatar={usuarioAutenticado.cor_avatar}
          avatarUrl={usuarioAutenticado.avatar_url}
          aoFinalizar={finalizarTransicao}
        />
      )}
    </div>
  )
}
