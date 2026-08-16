'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

/**
 * Contexto para controlar o modo de preview/simulação do site
 * Quando ativado, pedidos não são salvos no banco de dados
 */

type PreviewContextType = {
    modoSimulacao: boolean
    ativarSimulacao: () => void
    desativarSimulacao: () => void
    alternarSimulacao: () => void
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined)

export function PreviewProvider({ children, simulacaoInicial = false }: { children: ReactNode, simulacaoInicial?: boolean }) {
    const [modoSimulacao, setModoSimulacao] = useState(simulacaoInicial)

    const ativarSimulacao = () => setModoSimulacao(true)
    const desativarSimulacao = () => setModoSimulacao(false)
    const alternarSimulacao = () => setModoSimulacao((prev) => !prev)

    return (
        <PreviewContext.Provider
            value={{
                modoSimulacao,
                ativarSimulacao,
                desativarSimulacao,
                alternarSimulacao,
            }}
        >
            {children}
        </PreviewContext.Provider>
    )
}

export function usePreviewMode() {
    const context = useContext(PreviewContext)
    if (context === undefined) {
        // Retorna valores padrão quando fora do provider (site real)
        return {
            modoSimulacao: false,
            ativarSimulacao: () => { },
            desativarSimulacao: () => { },
            alternarSimulacao: () => { },
        }
    }
    return context
}
