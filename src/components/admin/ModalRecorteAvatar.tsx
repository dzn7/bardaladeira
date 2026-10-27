'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { MagnifyingGlassPlus as ZoomIn, MagnifyingGlassMinus as ZoomOut, ArrowClockwise as RotateCw, ArrowCounterClockwise as RotateCcw, Check, ArrowsClockwise as RefreshCw, CircleNotch as Loader2, User } from '@phosphor-icons/react'
import { obterImagemRecortada, type AreaRecorte } from '@/lib/recorteImagem'
import { Botao, Gaveta } from '@/components/admin/ui'

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
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      bloqueada={processando}
      titulo={titulo}
      descricao="Arraste a foto e ajuste o zoom. O recorte é redondo."
      largura="lg"
      rodape={
        <>
          <Botao variante="contorno" onClick={onFechar} disabled={processando}>
            Cancelar
          </Botao>
          <Botao carregando={processando} onClick={() => void confirmar()} disabled={!areaRecortada}>
            {!processando && <Check />}
            Aplicar
          </Botao>
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative h-[300px] overflow-hidden rounded-xl bg-muted/40 sm:h-[340px]">
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

        <div className="flex items-center gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-full border-2 border-primary bg-muted">
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <User className="size-6 text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Como a foto aparece no perfil.</p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Zoom</p>
          <div className="flex items-center gap-2">
            <Botao
              variante="contorno"
              tamanho="icone"
              className="size-11 md:size-10"
              onClick={() => setZoom((z) => Math.max(z - 0.1, zoomMin))}
              disabled={zoom <= zoomMin}
              aria-label="Diminuir zoom"
            >
              <ZoomOut />
            </Botao>
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
            <Botao
              variante="contorno"
              tamanho="icone"
              className="size-11 md:size-10"
              onClick={() => setZoom((z) => Math.min(z + 0.1, zoomMax))}
              disabled={zoom >= zoomMax}
              aria-label="Aumentar zoom"
            >
              <ZoomIn />
            </Botao>
            <span className="w-11 text-right text-sm tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Botao
              variante="contorno"
              tamanho="icone"
              className="size-11 md:size-10"
              onClick={() => setRotacao((r) => (r - 90) % 360)}
              aria-label="Girar para a esquerda"
            >
              <RotateCcw />
            </Botao>
            <Botao
              variante="contorno"
              tamanho="icone"
              className="size-11 md:size-10"
              onClick={() => setRotacao((r) => (r + 90) % 360)}
              aria-label="Girar para a direita"
            >
              <RotateCw />
            </Botao>
            <span className="text-sm tabular-nums text-muted-foreground">{rotacao}°</span>
          </div>
          <Botao
            variante="fantasma"
            className="h-11 md:h-10"
            onClick={() => {
              setCrop({ x: 0, y: 0 })
              setZoom(1)
              setRotacao(0)
            }}
          >
            <RefreshCw />
            Desfazer ajustes
          </Botao>
        </div>

        {erro ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        ) : null}
      </div>
    </Gaveta>
  )
}
