'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { obterUrlPublicaB2 } from '@/lib/backblaze'

type ImagemOtimizadaProps = {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  fill?: boolean
  priority?: boolean
  qualidade?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  onError?: () => void
}

/**
 * Componente de imagem otimizada com lazy loading e suporte ao Backblaze B2
 * - Lazy loading nativo com Intersection Observer
 * - Placeholder com blur effect
 * - Tratamento de erros com fallback
 * - Otimização automática de URL do B2
 */
export default function ImagemOtimizada({
  src,
  alt,
  width,
  height,
  className = '',
  fill = false,
  priority = false,
  qualidade = 80,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
}: ImagemOtimizadaProps) {
  const [carregado, setCarregado] = useState(false)
  const [erro, setErro] = useState(false)
  const [estaVisivel, setEstaVisivel] = useState(priority)
  const containerRef = useRef<HTMLDivElement>(null)

  // Placeholder padrão em base64 (cinza translúcido)
  const placeholderPadrao =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PC9zdmc+'

  // Imagem de fallback para erros
  const imagemFallback = '/placeholder-produto.svg'

  // Obtém a URL correta (converte para URL pública do B2 se necessário)
  const urlImagem = erro ? imagemFallback : obterUrlPublicaB2(src)

  // Intersection Observer para lazy loading
  useEffect(() => {
    if (priority || estaVisivel) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setEstaVisivel(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '100px', // Carrega 100px antes de entrar na viewport
        threshold: 0.01,
      }
    )

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [priority, estaVisivel])

  const handleLoad = () => {
    setCarregado(true)
    onLoad?.()
  }

  const handleError = () => {
    setErro(true)
    onError?.()
  }

  // Classes base do container
  const classesContainer = `
    relative overflow-hidden
    ${!carregado ? 'animate-pulse bg-gray-200 dark:bg-gray-800' : ''}
    ${className}
  `.trim()

  // Classes de transição da imagem
  const classesImagem = `
    transition-all duration-500 ease-out
    ${carregado ? 'opacity-100 scale-100' : 'opacity-0 scale-105'}
  `.trim()

  return (
    <div ref={containerRef} className={classesContainer}>
      {estaVisivel && (
        <>
          {fill ? (
            <Image
              src={urlImagem}
              alt={alt}
              fill
              quality={qualidade}
              className={`object-cover ${classesImagem}`}
              onLoad={handleLoad}
              onError={handleError}
              placeholder={placeholder}
              blurDataURL={blurDataURL || placeholderPadrao}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <Image
              src={urlImagem}
              alt={alt}
              width={width || 400}
              height={height || 300}
              quality={qualidade}
              className={classesImagem}
              onLoad={handleLoad}
              onError={handleError}
              placeholder={placeholder}
              blurDataURL={blurDataURL || placeholderPadrao}
            />
          )}
        </>
      )}

      {/* Placeholder skeleton enquanto carrega */}
      {!carregado && estaVisivel && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="w-8 h-8 border-2 border-laranja-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
