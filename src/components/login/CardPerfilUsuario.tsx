'use client'

import { motion } from 'framer-motion'
import type { PapelUsuario } from '@/lib/autenticacao'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'

type CardPerfilUsuarioProps = {
  nome: string
  papel: PapelUsuario
  corAvatar: string
  avatarUrl?: string | null
  indice: number
  aoClicar: () => void
}

export default function CardPerfilUsuario({
  nome,
  corAvatar,
  avatarUrl,
  indice,
  aoClicar,
}: CardPerfilUsuarioProps) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: 0.15 + indice * 0.1,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.96 }}
      onClick={aoClicar}
      className="group flex cursor-pointer flex-col items-center gap-4 rounded-2xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative">
        <AvatarUsuario
          nome={nome}
          src={avatarUrl}
          cor={corAvatar || '#0296F9'}
          className="h-[110px] w-[110px] text-4xl shadow-xl ring-2 ring-transparent transition-all duration-500 group-hover:shadow-2xl group-hover:ring-white/60 sm:h-[130px] sm:w-[130px] sm:text-5xl"
        />
        <div
          className="absolute -bottom-2 left-1/2 h-4 w-3/4 -translate-x-1/2 rounded-full opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-40"
          style={{ backgroundColor: corAvatar || '#0296F9' }}
        />
      </div>

      <div className="text-center">
        <p className="max-w-[130px] truncate text-sm font-semibold text-zinc-400 transition-colors duration-300 group-hover:text-white sm:text-base">
          {nome}
        </p>
      </div>
    </motion.button>
  )
}
