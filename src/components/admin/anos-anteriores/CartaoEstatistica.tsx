'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

type CartaoEstatisticaProps = {
  titulo: string
  valor: string | number
  subtitulo?: string
  icone: LucideIcon
  corGradiente: string
  delay?: number
}

export default function CartaoEstatistica({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  corGradiente,
  delay = 0
}: CartaoEstatisticaProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-gradient-to-br ${corGradiente} rounded-xl p-6 text-white`}
    >
      <div className="flex items-center justify-between mb-4">
        <Icone className="w-8 h-8" />
        <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
          2025
        </span>
      </div>
      <h3 className="text-3xl font-bold mb-1">{valor}</h3>
      <p className="text-white/80 text-sm">{titulo}</p>
      {subtitulo && (
        <p className="text-white/60 text-xs mt-1">{subtitulo}</p>
      )}
    </motion.div>
  )
}
