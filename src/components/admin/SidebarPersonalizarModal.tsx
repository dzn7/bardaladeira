'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, EyeSlash as EyeOff, DotsSixVertical as GripVertical, PencilSimple as Pencil, ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Botao, Gaveta } from '@/components/admin/ui'
import {
  ITENS_MENU_ADMIN,
  type ItemSidebarRota,
  type SidebarConfigItem,
} from '@/lib/admin-sidebar-routes'

type LocalItem = {
  id: string
  name: string
  icone: ItemSidebarRota['icone']
  visible: boolean
}

type Section = {
  category: string
  items: LocalItem[]
}

type SidebarPersonalizarModalProps = {
  aberto: boolean
  onFechar: () => void
  configSalva: SidebarConfigItem[] | null
  onSalvar: (config: SidebarConfigItem[]) => Promise<void>
  onRestaurar: () => Promise<void>
  salvando?: boolean
  idsOcultosGlobais?: Set<string>
}

const IDS_OCULTOS_VAZIOS = new Set<string>()

export const SidebarPersonalizarModal = ({
  aberto,
  onFechar,
  configSalva,
  onSalvar,
  onRestaurar,
  salvando = false,
  idsOcultosGlobais = IDS_OCULTOS_VAZIOS,
}: SidebarPersonalizarModalProps) => {
  const [sections, setSections] = useState<Section[]>([])
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [acaoPendente, setAcaoPendente] = useState<'save' | 'reset' | null>(null)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inicializadoRef = useRef(false)

  useEffect(() => {
    if (!aberto) {
      inicializadoRef.current = false
      setEditingCategory(null)
      setEditValue('')
      setDraggedId(null)
      return
    }
    if (inicializadoRef.current) return
    inicializadoRef.current = true

    const itemsMap = new Map(
      ITENS_MENU_ADMIN
        .filter((item) => !idsOcultosGlobais.has(item.id))
        .map((item) => [item.id, item]),
    )
    const ordered: { item: ItemSidebarRota; visible: boolean; category: string }[] = []

    if (configSalva && configSalva.length > 0) {
      for (const cfg of configSalva) {
        const matched = itemsMap.get(cfg.id)
        if (!matched) continue
        ordered.push({
          item: matched,
          visible: cfg.visible !== false,
          category: cfg.category?.trim() || matched.categoria,
        })
        itemsMap.delete(cfg.id)
      }
    }

    Array.from(itemsMap.values()).forEach((matched) => {
      ordered.push({
        item: matched,
        visible: true,
        category: matched.categoria,
      })
    })

    const categoryOrder = Array.from(new Set(ordered.map((entry) => entry.category)))
    setSections(
      categoryOrder.map((category) => ({
        category,
        items: ordered
          .filter((entry) => entry.category === category)
          .map((entry) => ({
            id: entry.item.id,
            name: entry.item.texto,
            icone: entry.item.icone,
            visible: entry.visible,
          })),
      })),
    )
  }, [aberto, configSalva, idsOcultosGlobais])

  const moveItem = (id: string, targetCategory: string, targetId: string | null) => {
    setSections((prev) => {
      let dragged: LocalItem | undefined
      const without = prev.map((section) => {
        const index = section.items.findIndex((item) => item.id === id)
        if (index < 0) return section
        dragged = section.items[index]
        return {
          ...section,
          items: section.items.filter((item) => item.id !== id),
        }
      })

      if (!dragged) return prev
      const moved = dragged

      return without.map((section) => {
        if (section.category !== targetCategory) return section
        const items = [...section.items]
        if (targetId === null) {
          items.push(moved)
        } else {
          const targetIndex = items.findIndex((item) => item.id === targetId)
          items.splice(targetIndex < 0 ? items.length : targetIndex, 0, moved)
        }
        return { ...section, items }
      })
    })
  }

  const toggleVisible = (category: string, id: string) => {
    setSections((prev) =>
      prev.map((section) =>
        section.category !== category
          ? section
          : {
              ...section,
              items: section.items.map((item) =>
                item.id === id ? { ...item, visible: !item.visible } : item,
              ),
            },
      ),
    )
  }

  const isCategoryNameTaken = (name: string, current: string) =>
    sections.some((section) => section.category !== current && section.category === name)

  const startEditCategory = (category: string) => {
    setEditingCategory(category)
    setEditValue(category)
  }

  const cancelEditCategory = () => {
    setEditingCategory(null)
    setEditValue('')
  }

  const commitEditCategory = () => {
    if (editingCategory === null) return
    const name = editValue.trim()
    const valid =
      name.length > 0 &&
      name.length <= 120 &&
      !isCategoryNameTaken(name, editingCategory)

    if (valid && name !== editingCategory) {
      setSections((prev) =>
        prev.map((section) =>
          section.category === editingCategory
            ? { ...section, category: name }
            : section,
        ),
      )
    }
    cancelEditCategory()
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDropOnItem = (
    e: React.DragEvent,
    targetCategory: string,
    targetId: string,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null)
      return
    }
    moveItem(draggedId, targetCategory, targetId)
    setDraggedId(null)
  }

  const handleDropOnSection = (e: React.DragEvent, category: string) => {
    e.preventDefault()
    if (!draggedId) {
      setDraggedId(null)
      return
    }
    moveItem(draggedId, category, null)
    setDraggedId(null)
  }

  const handleSalvar = async () => {
    let sectionsParaSalvar = sections
    if (editingCategory !== null) {
      const name = editValue.trim()
      const valid =
        name.length > 0 &&
        name.length <= 120 &&
        !isCategoryNameTaken(name, editingCategory)
      if (valid && name !== editingCategory) {
        sectionsParaSalvar = sections.map((section) =>
          section.category === editingCategory
            ? { ...section, category: name }
            : section,
        )
        setSections(sectionsParaSalvar)
      }
      cancelEditCategory()
    }

    const payload: SidebarConfigItem[] = sectionsParaSalvar.flatMap((section) =>
      section.items.map((item) => ({
        id: item.id,
        visible: item.visible,
        category: section.category,
      })),
    )
    try {
      setAcaoPendente('save')
      await onSalvar(payload)
      onFechar()
    } finally {
      setAcaoPendente(null)
    }
  }

  const handleRestaurar = async () => {
    try {
      setAcaoPendente('reset')
      await onRestaurar()
      onFechar()
    } finally {
      setAcaoPendente(null)
    }
  }

  const ocupado = salvando || acaoPendente !== null
  const editNameValid =
    editValue.trim().length > 0 &&
    editValue.trim().length <= 120 &&
    (editingCategory === null || !isCategoryNameTaken(editValue.trim(), editingCategory))

  return (
    <Gaveta
      aberto={aberto}
      aoFechar={() => {
        if (!ocupado) onFechar()
      }}
      bloqueada={ocupado}
      titulo="Personalizar a barra lateral"
      descricao="Mostre ou oculte itens, arraste para reordenar e renomeie os grupos. Ocultos ficam em Mais. Vale só para a sua conta."
      rodape={
        <>
          <Botao
            variante="perigoSuave"
            className="md:mr-auto"
            onClick={() => void handleRestaurar()}
            disabled={ocupado}
            carregando={acaoPendente === 'reset'}
            aria-label="Restaurar padrão da sidebar"
          >
            <RotateCcw className="size-4" aria-hidden />
            Restaurar padrão
          </Botao>
          <Botao variante="contorno" onClick={onFechar} disabled={ocupado}>
            Cancelar
          </Botao>
          <Botao onClick={() => void handleSalvar()} disabled={ocupado} carregando={acaoPendente === 'save'}>
            Salvar
          </Botao>
        </>
      }
    >
        <div>
          <div className="flex flex-col gap-1">
            {sections.map((section) => (
              <div key={section.category || 'main'} className="flex flex-col gap-1">
                {section.category !== '' &&
                  (editingCategory === section.category ? (
                    <input
                      autoFocus
                      value={editValue}
                      maxLength={120}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEditCategory}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          commitEditCategory()
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          e.stopPropagation()
                          cancelEditCategory()
                        }
                      }}
                      aria-label={`Renomear grupo ${section.category}`}
                      aria-invalid={!editNameValid}
                      className={cn(
                        'mx-1 mb-1 mt-3 h-9 w-full max-w-[240px] rounded-md border bg-transparent px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        editNameValid ? 'border-primary' : 'border-destructive',
                      )}
                    />
                  ) : (
                    <div className="group/cat flex items-center gap-1.5 px-1 pb-1 pt-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {section.category}
                      </p>
                      <button
                        type="button"
                        onClick={() => startEditCategory(section.category)}
                        aria-label={`Renomear grupo ${section.category}`}
                        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground opacity-100 transition-colors hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-7 sm:opacity-0 sm:group-hover/cat:opacity-100"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                    </div>
                  ))}

                <div
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnSection(e, section.category)}
                  className={cn(
                    'flex flex-col gap-1 rounded-md',
                    section.items.length === 0 &&
                      'min-h-11 items-center justify-center border border-dashed border-border text-xs text-muted-foreground',
                  )}
                >
                  {section.items.length === 0 ? (
                    <span className="py-2">Solte um item aqui</span>
                  ) : (
                    section.items.map((item) => {
                      const Icone = item.icone
                      const isDragged = draggedId === item.id
                      return (
                        <div
                          key={item.id}
                          draggable={!ocupado}
                          onDragStart={(e) => handleDragStart(e, item.id)}
                          onDragOver={handleDragOver}
                          onDrop={(e) =>
                            handleDropOnItem(e, section.category, item.id)
                          }
                          onDragEnd={() => setDraggedId(null)}
                          className={cn(
                            'flex cursor-grab items-center gap-2 rounded-md border p-2 transition-colors active:cursor-grabbing',
                            'hover:bg-accent',
                            'focus-within:ring-2 focus-within:ring-ring/40',
                            isDragged
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-muted/40',
                            !item.visible && 'opacity-60',
                          )}
                        >
                          <span
                            className="inline-flex size-9 shrink-0 items-center justify-center text-muted-foreground sm:size-4 sm:justify-start"
                            aria-hidden
                          >
                            <GripVertical className="size-4" />
                          </span>

                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Icone
                             
                              className={cn(
                                'size-4 shrink-0',
                                item.visible ? 'text-primary' : 'text-muted-foreground',
                              )}
                            />
                            <span
                              className={cn(
                                'truncate text-sm',
                                item.visible ? 'font-medium text-foreground' : 'font-normal text-muted-foreground',
                              )}
                            >
                              {item.name}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleVisible(section.category, item.id)}
                            disabled={ocupado}
                            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:size-9"
                            aria-label={
                              item.visible
                                ? `Ocultar ${item.name}`
                                : `Exibir ${item.name}`
                            }
                            aria-pressed={item.visible}
                          >
                            {item.visible ? (
                              <Eye className="size-4 text-primary" aria-hidden />
                            ) : (
                              <EyeOff className="size-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
    </Gaveta>
  )
}
