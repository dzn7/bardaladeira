'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, ImageIcon, Loader2, Check, AlertCircle } from 'lucide-react'
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
      setErro(resultado.erro || 'Erro no upload')
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
    idle: 'border-gray-300 dark:border-gray-600',
    validando: 'border-yellow-400',
    comprimindo: 'border-yellow-400',
    enviando: 'border-laranja-400 animate-pulse',
    sucesso: 'border-green-500',
    erro: 'border-red-500',
  }[status]

  // Texto do status
  const textoStatus = {
    idle: 'Clique ou arraste uma imagem',
    validando: 'Validando...',
    comprimindo: 'Comprimindo...',
    enviando: 'Enviando...',
    sucesso: 'Upload concluído!',
    erro: erro || 'Erro no upload',
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
          relative cursor-pointer rounded-xl border-2 border-dashed
          transition-all duration-300 overflow-hidden
          ${borderClass}
          ${arrastando ? 'bg-laranja-50 dark:bg-laranja-950/20 scale-[1.02]' : 'bg-gray-50 dark:bg-gray-800/50'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-laranja-400 hover:bg-laranja-50/50 dark:hover:bg-laranja-950/10'}
        `}
        style={{ width: larguraPreview, height: alturaPreview }}
      >
        {previewUrl ? (
          <>
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-cover"
              sizes={`${larguraPreview}px`}
            />
            
            {/* Overlay de status */}
            {status !== 'idle' && status !== 'sucesso' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                {status === 'enviando' ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : status === 'erro' ? (
                  <AlertCircle className="w-8 h-8 text-red-400" />
                ) : null}
              </div>
            )}

            {/* Badge de sucesso */}
            {status === 'sucesso' && (
              <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                <Check className="w-4 h-4" />
              </div>
            )}

            {/* Botão remover */}
            {status === 'idle' && !disabled && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removerImagem()
                }}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full 
                         transition-all duration-200 opacity-0 group-hover:opacity-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            {status === 'enviando' ? (
              <Loader2 className="w-10 h-10 text-laranja-500 animate-spin mb-2" />
            ) : status === 'erro' ? (
              <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
            ) : (
              <div className="relative">
                <ImageIcon className="w-10 h-10 text-gray-400 mb-2" />
                <Upload className="w-5 h-5 text-laranja-500 absolute -bottom-1 -right-1" />
              </div>
            )}
            <span className={`text-sm ${status === 'erro' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
              {textoStatus}
            </span>
            {status === 'idle' && (
              <span className="text-xs text-gray-400 mt-1">
                JPG, PNG, WebP ou GIF (máx. 5MB)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mensagem de erro abaixo */}
      {erro && status === 'erro' && (
        <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {erro}
        </p>
      )}
    </div>
  )
}
