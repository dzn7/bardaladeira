'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { tocarSomLogin } from '@/lib/somLogin'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'

type TransicaoLoginProps = {
  ativo: boolean
  nome: string
  corAvatar: string
  avatarUrl?: string | null
  aoFinalizar: () => void
}

export default function TransicaoLogin({
  ativo,
  nome,
  corAvatar,
  avatarUrl,
  aoFinalizar,
}: TransicaoLoginProps) {
  const [fase, setFase] = useState<'entrada' | 'sucesso' | 'saida'>('entrada')

  useEffect(() => {
    if (!ativo) {
      setFase('entrada')
      return
    }

    tocarSomLogin()

    const t1 = setTimeout(() => setFase('sucesso'), 700)
    const t2 = setTimeout(() => setFase('saida'), 1600)
    const t3 = setTimeout(() => aoFinalizar(), 2100)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [ativo, aoFinalizar])

  return (
    <AnimatePresence>
      {ativo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
        >
          {/* Glow de fundo pulsante */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: fase === 'saida' ? 12 : 6,
                opacity: fase === 'saida' ? 0 : 0.08,
              }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full"
              style={{ backgroundColor: corAvatar }}
            />
          </div>

          {/* Conteudo central */}
          <div className="relative flex flex-col items-center gap-7">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={
                fase === 'entrada'
                  ? { scale: 1, opacity: 1 }
                  : fase === 'sucesso'
                    ? { scale: 1.08, opacity: 1 }
                    : { scale: 0.85, opacity: 0, y: -40 }
              }
              transition={{
                type: 'spring',
                damping: 22,
                stiffness: 180,
                duration: 0.6,
              }}
              className="relative"
            >
              <AvatarUsuario
                nome={nome}
                src={avatarUrl}
                cor={corAvatar}
                className="h-32 w-32 text-5xl shadow-2xl ring-2 ring-white/10"
              />

              {/* Glow abaixo do avatar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: fase === 'sucesso' ? 0.4 : 0.2 }}
                className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-8 rounded-full blur-2xl"
                style={{ backgroundColor: corAvatar }}
              />

              {/* Check de sucesso */}
              <AnimatePresence>
                {fase === 'sucesso' && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 12, stiffness: 300 }}
                    className="absolute -bottom-2 -right-2 w-11 h-11 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30"
                  >
                    <Check className="w-6 h-6 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Nome e mensagem */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={
                fase === 'saida'
                  ? { opacity: 0, y: -25 }
                  : { opacity: 1, y: 0 }
              }
              transition={{
                delay: fase === 'entrada' ? 0.35 : 0,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-center space-y-1.5"
            >
              <h2 className="text-2xl font-bold text-white tracking-tight">{nome}</h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: fase === 'sucesso' ? 1 : 0 }}
                transition={{ duration: 0.4 }}
                className="text-sm text-green-400 font-medium"
              >
                Bem-vindo de volta
              </motion.p>
            </motion.div>

            {/* Barra de progresso */}
            <motion.div
              className="w-28 h-0.5 rounded-full overflow-hidden bg-zinc-800"
            >
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: fase === 'saida' ? 1 : 0.5 }}
                transition={{ duration: 1, ease: 'easeInOut' }}
                className="h-full rounded-full origin-left"
                style={{ backgroundColor: corAvatar }}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
