'use client'

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ComponentType,
  type CSSProperties,
} from 'react'
import dynamic from 'next/dynamic'
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Check,
  RefreshCw,
  Image as ImageIcon,
  Maximize2,
  Square,
  Loader2,
  Plus,
  Eye,
} from 'lucide-react'
import {
  obterImagemRecortada,
  blobParaBase64,
  type AreaRecorte,
} from '@/lib/recorteImagem'
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
    <div className="flex h-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
})

type Point = { x: number; y: number }
type Area = { x: number; y: number; width: number; height: number }

type ProporcoesPreset = {
  nome: string
  valor: number
  icone: React.ReactNode
}

type ModalRecorteImagemProps = {
  aberto: boolean
  imagemUrl: string
  onFechar: () => void
  onConfirmar: (imagemRecortadaBase64: string, blob: Blob) => void
  proporcaoInicial?: number
  titulo?: string
}

const PROPORCOES_PRESET: ProporcoesPreset[] = [
  { nome: 'Livre', valor: 0, icone: <Maximize2 className="h-4 w-4" /> },
  { nome: '1:1', valor: 1, icone: <Square className="h-4 w-4" /> },
  { nome: '4:3', valor: 4 / 3, icone: <ImageIcon className="h-4 w-4" /> },
  { nome: '16:9', valor: 16 / 9, icone: <ImageIcon className="h-4 w-4" /> },
  { nome: '3:4', valor: 3 / 4, icone: <ImageIcon className="h-4 w-4" /> },
]

export default function ModalRecorteImagem({
  aberto,
  imagemUrl,
  onFechar,
  onConfirmar,
  proporcaoInicial = 1,
  titulo = 'Ajustar Imagem',
}: ModalRecorteImagemProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotacao, setRotacao] = useState(0)
  const [areaRecortada, setAreaRecortada] = useState<AreaRecorte | null>(null)
  const [proporcao, setProporcao] = useState(proporcaoInicial)
  const [flip, setFlip] = useState({ horizontal: false, vertical: false })
  const [processando, setProcessando] = useState(false)
  const [erroProcessamento, setErroProcessamento] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [gerandoPreview, setGerandoPreview] = useState(false)
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const zoomMinimo = 1
  const zoomMaximo = 3

  const gerarPreview = useCallback(async () => {
    if (!areaRecortada || !imagemUrl) return

    setGerandoPreview(true)
    try {
      const blobRecortado = await obterImagemRecortada(imagemUrl, areaRecortada, rotacao, flip)
      if (blobRecortado) {
        const url = URL.createObjectURL(blobRecortado)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
      }
    } catch {
      /* preview é best-effort */
    } finally {
      setGerandoPreview(false)
    }
  }, [areaRecortada, imagemUrl, rotacao, flip])

  useEffect(() => {
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    previewTimeoutRef.current = setTimeout(() => {
      void gerarPreview()
    }, 300)
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current)
    }
  }, [gerarPreview])

  useEffect(() => {
    if (!aberto && previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [aberto, previewUrl])

  useEffect(() => {
    if (!aberto) return
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotacao(0)
    setFlip({ horizontal: false, vertical: false })
    setProporcao(proporcaoInicial)
    setErroProcessamento(null)
    setAreaRecortada(null)
  }, [aberto, proporcaoInicial, imagemUrl])

  const aoCompletarRecorte = useCallback((_areaCortada: Area, areaPixels: Area) => {
    setAreaRecortada(areaPixels)
  }, [])

  const resetarAjustes = useCallback(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setRotacao(0)
    setFlip({ horizontal: false, vertical: false })
    setProporcao(proporcaoInicial)
    setErroProcessamento(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [proporcaoInicial, previewUrl])

  const confirmarRecorte = async () => {
    if (!areaRecortada) {
      setErroProcessamento('Selecione uma área para recortar')
      return
    }

    setProcessando(true)
    setErroProcessamento(null)

    try {
      const blobRecortado = await obterImagemRecortada(imagemUrl, areaRecortada, rotacao, flip)
      if (!blobRecortado) throw new Error('Falha ao processar a imagem')
      const base64 = await blobParaBase64(blobRecortado)
      onConfirmar(base64, blobRecortado)
      resetarAjustes()
    } catch {
      setErroProcessamento('Não foi possível processar a imagem. Tente novamente.')
    } finally {
      setProcessando(false)
    }
  }

  const fecharModal = () => {
    resetarAjustes()
    onFechar()
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        if (!proximo) fecharModal()
      }}
      variant="dialog"
    >
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[92dvh] sm:rounded-xl"
        showCloseButton
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 pr-12 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-semibold tracking-tight">{titulo}</DialogTitle>
              <DialogDescription className="text-[13px] text-muted-foreground">
                Arraste para posicionar e use os controles para ajustar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <div className="relative min-h-[220px] flex-1 bg-muted/40 md:min-h-[360px]">
            {(() => {
              const CropperAny = Cropper as unknown as ComponentType<{
                image: string
                crop: Point
                zoom: number
                rotation: number
                aspect?: number
                onCropChange: (valor: Point) => void
                onZoomChange: (valor: number) => void
                onCropComplete: (area: Area, pixels: Area) => void
                cropShape?: 'rect' | 'round'
                showGrid?: boolean
                style?: {
                  containerStyle?: CSSProperties
                  cropAreaStyle?: CSSProperties
                }
              }>
              return (
                <CropperAny
                  image={imagemUrl}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotacao}
                  aspect={proporcao > 0 ? proporcao : undefined}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={aoCompletarRecorte}
                  cropShape="rect"
                  showGrid
                  style={{
                    containerStyle: { backgroundColor: 'hsl(var(--muted))' },
                    cropAreaStyle: {
                      border: '2px solid hsl(var(--primary))',
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                    },
                  }}
                />
              )
            })()}
          </div>

          <div className="hidden w-44 shrink-0 flex-col items-center overflow-y-auto border-l border-border/60 bg-muted/20 p-3 sm:flex md:w-48">
            <div className="mb-2 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Preview</span>
            </div>
            <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-card">
              <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
                {gerandoPreview ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : previewUrl ? (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                ) : imagemUrl ? (
                  <img src={imagemUrl} alt="" className="h-full w-full object-cover opacity-50" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="absolute left-2 top-2 rounded-md border border-border/70 bg-background/90 px-1.5 py-0.5 text-[8px] font-semibold uppercase backdrop-blur">
                  Exemplo
                </div>
              </div>
              <div className="space-y-1.5 p-2">
                <p className="truncate text-xs font-semibold">Produto</p>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold">R$ 29,90</span>
                  <div className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <Plus className="h-2.5 w-2.5" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 max-h-[38dvh] space-y-3 overflow-y-auto overscroll-contain border-t border-border/60 px-4 py-3 sm:max-h-none sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Proporção</span>
            {PROPORCOES_PRESET.map((preset) => (
              <Button
                key={preset.nome}
                type="button"
                size="sm"
                variant={proporcao === preset.valor ? 'default' : 'outline'}
                className="h-8 gap-1.5 shadow-none"
                onClick={() => setProporcao(preset.valor)}
              >
                {preset.icone}
                {preset.nome}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">Zoom</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 shadow-none"
              onClick={() => setZoom((prev) => Math.max(prev - 0.1, zoomMinimo))}
              disabled={zoom <= zoomMinimo}
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <input
              type="range"
              min={zoomMinimo}
              max={zoomMaximo}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
              aria-label="Controle de zoom"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 shadow-none"
              onClick={() => setZoom((prev) => Math.min(prev + 0.1, zoomMaximo))}
              disabled={zoom >= zoomMaximo}
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="w-10 text-right text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Rotação</span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shadow-none"
                onClick={() => setRotacao((prev) => (prev - 90) % 360)}
                aria-label="Rotacionar para esquerda"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-8 shadow-none"
                onClick={() => setRotacao((prev) => (prev + 90) % 360)}
                aria-label="Rotacionar para direita"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{rotacao}°</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Espelhar</span>
              <Button
                type="button"
                size="icon"
                variant={flip.horizontal ? 'default' : 'outline'}
                className="size-8 shadow-none"
                onClick={() => setFlip((prev) => ({ ...prev, horizontal: !prev.horizontal }))}
                aria-label="Espelhar horizontalmente"
              >
                <FlipHorizontal className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant={flip.vertical ? 'default' : 'outline'}
                className="size-8 shadow-none"
                onClick={() => setFlip((prev) => ({ ...prev, vertical: !prev.vertical }))}
                aria-label="Espelhar verticalmente"
              >
                <FlipVertical className="h-4 w-4" />
              </Button>
            </div>

            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 shadow-none" onClick={resetarAjustes}>
              <RefreshCw className="h-3.5 w-3.5" />
              Resetar
            </Button>
          </div>

          {erroProcessamento ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erroProcessamento}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full shadow-none sm:h-9 sm:w-auto"
            onClick={fecharModal}
            disabled={processando}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-11 w-full gap-2 shadow-none sm:h-9 sm:w-auto"
            onClick={() => void confirmarRecorte()}
            disabled={processando || !areaRecortada}
          >
            {processando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aplicar recorte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
