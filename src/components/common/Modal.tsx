import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'

interface ModalProps extends ComponentPropsWithoutRef<'dialog'> {
  onClose: () => void
  /** Busy dialogs stay modal until their operation finishes. */
  dismissible?: boolean
}

/** Native modal semantics provide a focus trap and make the background inert. */
export function Modal({ onClose, dismissible = true, children, ...props }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    return () => {
      dialog.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [])

  return (
    <dialog
      {...props}
      ref={ref}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (dismissible) onClose()
      }}
      onKeyDown={(event) => {
        props.onKeyDown?.(event)
        // Global rolling shortcuts must never consume keys inside a modal.
        event.stopPropagation()
      }}
      onClick={(event) => {
        props.onClick?.(event)
        if (event.target !== event.currentTarget || !dismissible) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
      }}
    >
      {children}
    </dialog>
  )
}
