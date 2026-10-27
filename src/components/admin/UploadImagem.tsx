'use client'

import { useState, useRef, useCallback } from 'react'
import { UploadSimple as Upload, X, Image as ImageIcon, CircleNotch as Loader2, Check, WarningCircle as AlertCircle } from '@phosphor-icons/react'
import Image from 'next/image'
import { uploadImagemB2, validarImagem, obterUrlPublicaB2 } from '@/lib/backblaze'

type UploadImagemProps = {
  urlAtual?: string
  onUploadCompleto: (url: string) => void
  pasta?: string
  larguraPreview?: number
  alturaPreview?: number
  className?: string
  disabled?: boolean
}

type StatusUpload = 'idle' | 'validando' | 'comprimindo' | 'enviando' | 'sucesso' | 'erro'

/**
 * Componente de upload de imagens para o painel admin
 * - Drag and drop
 * - Preview da imagem
 * - Compressão automática
 * - Upload para Backblaze B2
 * - Feedback visual de progresso
 */
export default function UploadImagem({
  urlAtual,
  onUploadCompleto,
  pasta = 'produtos',
  larguraPreview = 200,
  alturaPreview = 200,
  className = '',
  disabled = false,
}: UploadImagemProps) {
  const [status, setStatus] = useState<StatusUpload>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(urlAtual ? obterUrlPublicaB2(urlAtual) : null)
  const [erro, setErro] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processarArquivo = useCallback(async (arquivo: File) => {
    setErro(null)
    
    // Validação
    setStatus('validando')
    const validacao = validarImagem(arquivo)
    if (!validacao.valido) {
      setErro(validacao.erro || 'Arquivo inválido')
      setStatus('erro')
      return
    }

    // Preview local
    const urlLocal = URL.createObjectURL(arquivo)
    setPreviewUrl(urlLocal)

    // Upload
    setStatus('enviando')
    const resultado = await uploadImagemB2(arquivo, pasta)

    if (resultado.sucesso && resultado.url) {
      setStatus('sucesso')
      setPreviewUrl(resultado.url)
      onUploadCompleto(resultado.url)
      
      // Limpa o preview local
      URL.revokeObjectURL(urlLocal)
      
      // Reset após 2 segundos
      setTimeout(() => setStatus('idle'), 2000)
    } else {
      setErro(resultado.erro || 'Não foi possível enviar')
      setStatus('erro')
      setPreviewUrl(urlAtual ? obterUrlPublicaB2(urlAtual) : null)
    }
  }, [pasta, onUploadCompleto, urlAtual])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    if (arquivo) {
      processarArquivo(arquivo)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    
    if (disabled) return
    
    const arquivo = e.dataTransfer.files[0]
    if (arquivo) {
      processarArquivo(arquivo)
    }
  }, [disabled, processarArquivo])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setArrastando(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
  }

  const removerImagem = () => {
    setPreviewUrl(null)
    setStatus('idle')
    setErro(null)
    onUploadCompleto('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const abrirSeletor = () => {
    if (!disabled && status !== 'enviando') {
      inputRef.current?.click()
    }
  }

  // Determina a cor do border baseado no status
  const borderClass = {
    idle: 'border-border',
    validando: 'border-primary/60',
    comprimindo: 'border-primary/60',
    enviando: 'border-primary animate-pulse',
    sucesso: 'border-primary',
    erro: 'border-destructive',
  }[status]

  // Texto do status
  const textoStatus = {
    idle: 'Toque ou arraste uma foto',
    validando: 'Conferindo…',
    comprimindo: 'Comprimindo…',
    enviando: 'Enviando…',
    sucesso: 'Foto enviada',
    erro: erro || 'Não foi possível enviar',
  }[status]

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || status === 'enviando'}
      />

      <div
        onClick={abrirSeletor}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          group relative cursor-pointer overflow-hidden rounded-xl border-2 border-dashed transition-colors
          ${borderClass}
          ${arrastando ? 'bg-primary/10' : 'bg-muted/40'}
          ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-primary/60 hover:bg-primary/5'}
        `}
        style={{ width: larguraPreview, height: alturaPreview }}
      >
        {previewUrl ? (
          <>
            <Image
              src={previewUrl}
              alt="Prévia da foto"
              fill
              className="object-cover"
              sizes={`${larguraPreview}px`}
            />
            
            {/* Overlay de status */}
            {status !== 'idle' && status !== 'sucesso' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                {status === 'enviando' ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : status === 'erro' ? (
                  <AlertCircle className="w-8 h-8 text-destructive" />
                ) : null}
              </div>
            )}

            {/* Badge de sucesso */}
            {status === 'sucesso' && (
              <div className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                <Check className="w-4 h-4" />
              </div>
            )}

            {/* Botão remover */}
            {status === 'idle' && !disabled && (
              <button
                type="button"
                aria-label="Remover foto"
                onClick={(e) => {
                  e.stopPropagation()
                  removerImagem()
                }}
                className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-full text-white"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-black/60 transition-colors hover:bg-destructive">
                  <X className="size-4" />
                </span>
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            {status === 'enviando' ? (
              <Loader2 className="w-10 h-10 mb-2 animate-spin text-primary" />
            ) : status === 'erro' ? (
              <AlertCircle className="w-10 h-10 mb-2 text-destructive" />
            ) : (
              <div className="relative">
                <ImageIcon className="w-10 h-10 mb-2 text-muted-foreground" />
                <Upload className="w-5 h-5 text-primary absolute -bottom-1 -right-1" />
              </div>
            )}
            <span className={`text-sm ${status === 'erro' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {textoStatus}
            </span>
            {status === 'idle' && (
              <span className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WebP ou GIF (máx. 5MB)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mensagem de erro abaixo */}
      {erro && status === 'erro' && (
        <p className="mt-2 text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {erro}
        </p>
      )}
    </div>
  )
}
