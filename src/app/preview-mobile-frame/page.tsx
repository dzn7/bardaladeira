'use client'

import Home from '@/app/page'
import { PreviewProvider } from '@/contexts/PreviewContext'

/**
 * PÁGINA DE PREVIEW ISOLADA (IFRAME)
 * 
 * Esta página é carregada DENTRO do iframe do componente ModalPreviewMobile.
 * Ela serve para garantir o isolamento total de CSS e Scroll.
 * 
 * A flag `simulacaoInicial` garante que o contexto já inicie em modo simulação.
 */
export default function PreviewFramePage() {
    return (
        <PreviewProvider simulacaoInicial={true}>
            <div className="w-full min-h-screen bg-white dark:bg-zinc-950">
                <Home />
            </div>
        </PreviewProvider>
    )
}
