import { useEffect, useState } from 'react'

/**
 * Detecta se há um modal/dialog da aplicação aberto (Radix/Vaul) que não
 * pertence ao onboarding.
 *
 * Quando um demo abre um modal, o spotlight escuro atrapalharia a leitura do
 * formulário — o renderer usa este sinal para ocultar o escurecimento e
 * fixar o pop-up no canto.
 */

const DIALOG_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [data-vaul-drawer][data-state="open"]'

const hasForeignDialog = () => {
  if (typeof document === 'undefined') return false

  const dialogs = Array.from(document.querySelectorAll(DIALOG_SELECTOR))
  return dialogs.some((el) => !el.closest('[data-onboarding-ui]'))
}

export const useForeignDialog = (active: boolean) => {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!active) {
      setIsOpen(false)
      return
    }

    const update = () => setIsOpen(hasForeignDialog())
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state', 'class', 'style'],
    })

    return () => observer.disconnect()
  }, [active])

  return isOpen
}
