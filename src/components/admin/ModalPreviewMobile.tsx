'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, RefreshCw, Monitor, Smartphone } from 'lucide-react'

type ModalPreviewMobileProps = {
    onFechar: () => void
}

type ModoVisualizacao = 'celular' | 'desktop'

/**
 * Modal de preview responsivo com opções de visualização mobile e desktop
 * Em dispositivos móveis, exibe o site em tela cheia sem mockup
 * Em desktop, permite alternar entre visualização mobile (com frame) e desktop
 */
export default function ModalPreviewMobile({ onFechar }: ModalPreviewMobileProps) {
    const [chaveRefresh, setChaveRefresh] = useState(0)
    const [modoVisualizacao, setModoVisualizacao] = useState<ModoVisualizacao>('celular')
    const [ehDispositivoMovel, setEhDispositivoMovel] = useState(false)

    // Detectar se é dispositivo móvel
    useEffect(() => {
        const verificarDispositivoMovel = () => {
            setEhDispositivoMovel(window.innerWidth < 768)
        }
        verificarDispositivoMovel()
        window.addEventListener('resize', verificarDispositivoMovel)
        return () => window.removeEventListener('resize', verificarDispositivoMovel)
    }, [])

    // Bloquear scroll do body quando modal estiver aberto
    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = ''
        }
    }, [])

    // Fechar com ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onFechar()
        }
        window.addEventListener('keydown', handleEsc)
        return () => window.removeEventListener('keydown', handleEsc)
    }, [onFechar])

    const recarregarPreview = () => {
        setChaveRefresh((prev) => prev + 1)
    }

    // Em dispositivos móveis, exibe tela cheia sem mockup
    if (ehDispositivoMovel) {
        return (
            <AnimatePresence>
                <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-900">
                    {/* Barra superior */}
                    <div className="flex items-center justify-between px-4 py-3 bg-zinc-800 border-b border-zinc-700">
                        <div className="flex items-center gap-2 text-white">
                            <Smartphone className="w-4 h-4 text-laranja-500" />
                            <span className="text-sm font-medium">Preview do Site</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={recarregarPreview}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                                title="Recarregar"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={onFechar}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                                title="Fechar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Iframe em tela cheia */}
                    <div className="flex-1 overflow-hidden">
                        <iframe
                            key={chaveRefresh}
                            src="/preview-mobile-frame"
                            className="w-full h-full border-none bg-white dark:bg-zinc-950"
                            title="Preview Mobile"
                        />
                    </div>
                </div>
            </AnimatePresence>
        )
    }

    // Em desktop, exibe com opções de visualização
    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex flex-col">
                {/* Overlay */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onFechar}
                    className="absolute inset-0 bg-zinc-900/95"
                />

                {/* Barra superior */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-20 flex items-center justify-between px-6 py-3 bg-zinc-800 border-b border-zinc-700"
                >
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-white">Preview do Site</span>
                        
                        {/* Seletor de modo */}
                        <div className="flex items-center bg-zinc-700 rounded-lg p-1">
                            <button
                                onClick={() => setModoVisualizacao('celular')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    modoVisualizacao === 'celular'
                                        ? 'bg-laranja-500 text-white'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <Smartphone className="w-3.5 h-3.5" />
                                Mobile
                            </button>
                            <button
                                onClick={() => setModoVisualizacao('desktop')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                    modoVisualizacao === 'desktop'
                                        ? 'bg-laranja-500 text-white'
                                        : 'text-zinc-400 hover:text-white'
                                }`}
                            >
                                <Monitor className="w-3.5 h-3.5" />
                                Desktop
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={recarregarPreview}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Recarregar Preview"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onFechar}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-lg transition-colors"
                            title="Fechar (ESC)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </motion.div>

                {/* Container do Preview */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="relative z-10 flex-1 flex items-center justify-center p-6 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                >
                    {modoVisualizacao === 'celular' ? (
                        /* Frame de celular para desktop */
                        <div className="relative w-[375px] h-[812px] max-h-[calc(100dvh-120px)] bg-zinc-800 rounded-[3rem] p-3 shadow-2xl border-4 border-zinc-700">
                            {/* Notch */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-7 bg-zinc-900 rounded-full z-10" />
                            
                            {/* Tela */}
                            <div className="w-full h-full bg-white dark:bg-zinc-950 rounded-[2.25rem] overflow-hidden">
                                <iframe
                                    key={chaveRefresh}
                                    src="/preview-mobile-frame"
                                    className="w-full h-full border-none"
                                    title="Preview Mobile"
                                />
                            </div>
                            
                            {/* Barra inferior (home indicator) */}
                            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-32 h-1 bg-zinc-600 rounded-full" />
                        </div>
                    ) : (
                        /* Visualização desktop */
                        <div className="w-full max-w-6xl h-full bg-white dark:bg-zinc-950 rounded-lg overflow-hidden shadow-2xl border border-zinc-700">
                            <iframe
                                key={chaveRefresh}
                                src="/preview-mobile-frame"
                                className="w-full h-full border-none"
                                title="Preview Desktop"
                            />
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    )
}
