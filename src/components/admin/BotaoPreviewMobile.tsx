'use client'

import { useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ModalPreviewMobile from './ModalPreviewMobile'

/**
 * Botão flutuante para abrir preview do site do cliente
 * Visível em todas as páginas do admin
 */
export default function BotaoPreviewMobile() {
    const [modalAberto, setModalAberto] = useState(false)
    const [mostrarTooltip, setMostrarTooltip] = useState(false)

    return (
        <>
            {/* Botão Flutuante */}
            <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
                <div className="relative">
                    {/* Tooltip */}
                    <AnimatePresence>
                        {mostrarTooltip && !modalAberto && (
                            <motion.div
                                initial={{ opacity: 0, x: 10, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 10, scale: 0.9 }}
                                className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap
                         bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100
                         text-sm font-medium px-3 py-2 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700"
                            >
                                Preview do Site
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 
                              w-2 h-2 bg-white dark:bg-zinc-900 border-r border-b border-zinc-200 dark:border-zinc-700 rotate-45" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Botão Principal */}
                    <motion.button
                        onClick={() => setModalAberto(true)}
                        onMouseEnter={() => setMostrarTooltip(true)}
                        onMouseLeave={() => setMostrarTooltip(false)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative w-11 h-11 sm:w-12 sm:h-12 md:w-14 md:h-14 
                     bg-gradient-to-br from-bordo-600 to-bordo-700 
                     hover:from-bordo-700 hover:to-bordo-800
                     text-white rounded-full shadow-lg shadow-bordo-500/30
                     flex items-center justify-center
                     transition-all duration-300 ease-out
                     focus:outline-none focus:ring-2 focus:ring-bordo-500 focus:ring-offset-2
                     dark:focus:ring-offset-zinc-900"
                        aria-label="Abrir preview do site"
                    >
                        {/* Efeito de pulse */}
                        <span className="absolute inset-0 rounded-full bg-bordo-500 animate-ping opacity-20" />

                        {/* Ícone */}
                        <Smartphone className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 relative z-10" />
                    </motion.button>
                </div>
            </div>

            {/* Modal de Preview */}
            <AnimatePresence>
                {modalAberto && (
                    <ModalPreviewMobile onFechar={() => setModalAberto(false)} />
                )}
            </AnimatePresence>
        </>
    )
}
