'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, X, Loader2, Eye, EyeOff } from 'lucide-react'
import type { UsuarioSistema } from '@/lib/autenticacao'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'

type ModalSenhaLoginProps = {
  usuario: UsuarioSistema
  aberto: boolean
  carregando: boolean
  erro: string
  aoFechar: () => void
  aoSubmeter: (senha: string) => void
}

export default function ModalSenhaLogin({
  usuario,
  aberto,
  carregando,
  erro,
  aoFechar,
  aoSubmeter,
}: ModalSenhaLoginProps) {
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (aberto) {
      setSenha('')
      setMostrarSenha(false)
      setTimeout(() => inputRef.current?.focus(), 250)
    }
  }, [aberto])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!senha.trim() || carregando) return
    aoSubmeter(senha)
  }

  return (
    <AnimatePresence>
      {aberto && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={(e) => e.target === e.currentTarget && aoFechar()}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 30 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="w-full max-w-sm bg-zinc-900/95 backdrop-blur-sm border border-zinc-800/60 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            <div className="relative p-7">
              <button
                onClick={aoFechar}
                className="absolute top-4 right-4 p-2 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all duration-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center gap-4 mb-7">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', damping: 20, stiffness: 250 }}
                  className="relative"
                >
                  <AvatarUsuario
                    nome={usuario.nome}
                    src={usuario.avatar_url}
                    cor={usuario.cor_avatar || '#f97316'}
                    className="h-24 w-24 text-3xl shadow-2xl ring-2 ring-white/10"
                  />
                  <div
                    className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-16 h-6 rounded-full blur-xl opacity-30"
                    style={{ backgroundColor: usuario.cor_avatar || '#f97316' }}
                  />
                </motion.div>

                <div className="text-center">
                  <h2 className="text-lg font-bold text-white">{usuario.nome}</h2>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence>
                  {erro && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-900/40">
                        <p className="text-sm text-red-400">{erro}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    ref={inputRef}
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className="w-full pl-10 pr-12 py-3.5 bg-zinc-800/80 border border-zinc-700/50 rounded-xl
                             text-white placeholder-zinc-500 text-sm
                             focus:outline-none focus:ring-2 focus:ring-laranja-500/70 focus:border-transparent
                             transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={carregando || !senha.trim()}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm text-white cursor-pointer
                           bg-laranja-600 hover:bg-laranja-700
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all duration-300 shadow-lg shadow-laranja-900/20"
                >
                  {carregando ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando...
                    </span>
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
