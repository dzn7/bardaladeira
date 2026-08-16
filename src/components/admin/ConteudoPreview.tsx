'use client'

import Home from '@/app/page'

/**
 * Renderiza a Home real do site dentro do contexto de preview.
 * O contexto de simulação é provido pelo PreviewProvider no componente pai.
 */
export default function ConteudoPreview() {
    return (
        <div className="w-full h-full bg-white dark:bg-zinc-950">
            <Home />
        </div>
    )
}
