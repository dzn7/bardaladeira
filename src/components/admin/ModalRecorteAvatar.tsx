'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Check,
  RefreshCw,
  Loader2,
  User,
} from 'lucide-react'
import { obterImagemRecortada, type AreaRecorte } from '@/lib/recorteImagem'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const Cropper = dynamic(() => import('react-easy-crop'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
})

type Point = { x: number; y: number }
type Area = { x: number; y: number; width: number; height: number }

type ModalRecorteAvatarProps = {
  aberto: boolean
  imagemUrl: string
  onFechar: () => void
  onConfirmar: (blob: Blob) => void
  titulo?: string
}

const TAMANHO_AVATAR_MAX = 200 * 1024
const DIMENSAO_AVATAR = 400

async function comprimirAvatar(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })

    const canvas = document.createElement('canvas')
    let lado = Math.min(img.naturalWidth, img.naturalHeight, DIMENSAO_AVATAR)
    canvas.width = lado
    canvas.height = lado

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas indisponivel')

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, lado, lado)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, lado, lado)

    let qualidade = 0.85
    let resultado: Blob | null = null

    while (qualidade >= 0.3) {
      resultado = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), 'image/jpeg', qualidade),
      )
      if (resultado && resultado.size <= TAMANHO_AVATAR_MAX) return resultado
      qualidade -= 0.05
    }

    if (resultado && resultado.size > TAMANHO_AVATAR_MAX) {
      lado = Math.floor(lado * 0.7)
      const c2 = document.createElement('canvas')
      c2.width = lado
      c2.height = lado
      const ctx2 = c2.getContext('2d')
      if (ctx2) {
        ctx2.fillStyle = '#FFFFFF'
        ctx2.fillRect(0, 0, lado, lado)
        ctx2.imageSmoothingEnabled = true
        ctx2.imageSmoothingQuality = 'high'
        ctx2.drawImage(canvas, 0, 0, lado, lado)
        resultado = await new Promise<Blob | null>((res) =>
          c2.toBlob((b) => res(b), 'image/jpeg', 0.6),
        )
      }
    }

    return resultado || blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function ModalRecorteAvatar({
  aberto,
  imagemUrl,
  onFechar,
  onConfirmar,
  titulo = 'Ajustar avatar',
}: ModalRecorteAvatarProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotacao, setRotacao] = useState(0)
  const [areaRecortada, setAreaRecortada] = useState<AreaRecorte | null>(null)
  const [processando, setProcessando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const zoomMin = 1
  const zoomMax = 3

  useEffect(() => {
    if (aberto) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotacao(0)
    setAreaRecortada(null)
    setErro(null)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [aberto])

  const gerarPreview = useCallback(async () => {
    if (!areaRecortada || !imagemUrl) return
    try {
      const blob = await obterImagemRecortada(imagemUrl, areaRecortada, rotacao, {
        horizontal: false,
        vertical: false,
      })
      if (blob) {
        const url = URL.createObjectURL(blob)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      }
    } catch {
      /* preview best-effort */
    }
  }, [areaRecortada, imagemUrl, rotacao])

  useEffect(() => {
    if (previewRef.current) clearTimeout(previewRef.current)
    previewRef.current = setTimeout(() => {
      void gerarPreview()
    }, 250)
    return () => {
      if (previewRef.current) clearTimeout(previewRef.current)
    }
  }, [gerarPreview])

  const aoCompletarRecorte = useCallback((_: Area, pixels: Area) => setAreaRecortada(pixels), [])

  const confirmar = async () => {
    if (!areaRecortada) {
      setErro('Selecione a área de recorte')
      return
    }
    setProcessando(true)
    setErro(null)
    try {
      const blob = await obterImagemRecortada(imagemUrl, areaRecortada, rotacao, {
        horizontal: false,
        vertical: false,
      })
      if (!blob) throw new Error('Falha ao recortar')
      const comprimido = await comprimirAvatar(blob)
      onConfirmar(comprimido)
      onFechar()
    } catch {
      setErro('Erro ao processar imagem. Tente novamente.')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        if (!proximo) onFechar()
      }}
      variant="dialog"
    >
      <DialogContent className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 pr-12 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-[15px] font-semibold tracking-tight">{titulo}</DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                Recorte circular para o perfil.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
          <div className="relative min-h-[280px] flex-1 bg-muted/40">
            {/* @ts-expect-error react-easy-crop via dynamic() tipagem incompleta */}
            <Cropper
              image={imagemUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotacao}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={aoCompletarRecorte}
              cropShape="round"
              showGrid={false}
              style={{
                containerStyle: { backgroundColor: 'hsl(var(--muted))' },
                cropAreaStyle: {
                  border: '3px solid hsl(var(--primary))',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                },
              }}
            />
          </div>

          <div className="flex w-full shrink-0 flex-row items-center justify-center gap-4 border-t border-border/60 bg-muted/20 p-3 sm:w-36 sm:flex-col sm:border-l sm:border-t-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Preview
            </span>
            <div className="size-20 overflow-hidden rounded-full border-2 border-primary bg-muted shadow-sm sm:size-24">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
            </div>
            <p className="hidden text-center text-[10px] text-muted-foreground sm:block">
              Como fica no perfil
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border/60 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="w-12 text-xs font-medium text-muted-foreground">Zoom</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 shadow-none"
              onClick={() => setZoom((z) => Math.max(z - 0.1, zoomMin))}
              disabled={zoom <= zoomMin}
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <input
              type="range"
              min={zoomMin}
              max={zoomMax}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              aria-label="Zoom"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 shadow-none"
              onClick={() => setZoom((z) => Math.min(z + 0.1, zoomMax))}
              disabled={zoom >= zoomMax}
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="w-10 text-right text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Rotação</span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shadow-none"
                onClick={() => setRotacao((r) => (r - 90) % 360)}
                aria-label="Rotacionar esquerda"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shadow-none"
                onClick={() => setRotacao((r) => (r + 90) % 360)}
                aria-label="Rotacionar direita"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{rotacao}°</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 shadow-none"
              onClick={() => {
                setCrop({ x: 0, y: 0 })
                setZoom(1)
                setRotacao(0)
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resetar
            </Button>
          </div>

          {erro ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shadow-none sm:h-9 sm:w-auto"
            onClick={onFechar}
            disabled={processando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 w-full gap-2 shadow-none sm:h-9 sm:w-auto"
            onClick={() => void confirmar()}
            disabled={processando || !areaRecortada}
          >
            {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
