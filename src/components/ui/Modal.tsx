import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-6xl',
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  size?: ModalSize
  footer?: ReactNode
  children: ReactNode
}

export function Modal({ open, onClose, title, subtitle, size = 'md', footer, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  const titleId = useId()

  // Keep the latest handler in a ref so the effects below do not re-run on
  // every parent render (which would steal focus while the user types).
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), 150)
    return () => window.clearTimeout(timer)
  }, [open])

  // Remember the trigger when opening, hand focus back to it when closing.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      return
    }
    restoreRef.current?.focus?.({ preventScroll: true })
  }, [open])

  // Move focus into the dialog once the panel is actually in the DOM —
  // `mounted` lags `open` by one render, so this cannot depend on `open` alone.
  useEffect(() => {
    if (!open || !mounted) return
    const panel = panelRef.current
    if (!panel) return
    const items = panel.querySelectorAll<HTMLElement>(FOCUSABLE)
    const target = items.length > 0 ? items[0] : panel
    target?.focus({ preventScroll: true })
  }, [open, mounted])

  // Escape to dismiss, Tab cycles inside the dialog, background does not scroll.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (item) => item.offsetParent !== null,
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!mounted) return null

  // Portalled to <body>: any animating ancestor (e.g. the page-enter wrapper,
  // whose transform makes it a containing block) would otherwise trap these
  // `fixed` layers inside the content column and leave an undimmed strip.
  return createPortal(
    <div
      className={cn(
        'no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center',
        open ? 'animate-fade-in' : 'animate-fade-out',
      )}
    >
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[3px]"
        onClick={() => closeRef.current()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 my-4 flex w-full flex-col overflow-hidden rounded-3xl bg-surface shadow-modal outline-none sm:my-8',
          open ? 'animate-slide-up' : 'animate-scale-out',
          SIZES[size],
        )}
      >
        <header className="relative flex items-start justify-between gap-4 border-b border-silver-200 bg-linear-to-b from-silver-50/80 to-surface px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-[17px] font-bold tracking-[-0.02em] text-navy-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-xs text-silver-600">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => closeRef.current()}
            className="hit pressable -mt-0.5 -mr-1 shrink-0 rounded-lg p-1.5 text-silver-600 transition-colors hover:bg-silver-200/70 hover:text-navy-800"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="max-h-[calc(100vh-16rem)] flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-silver-200 bg-silver-50/80 px-5 py-3.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset',
            tone === 'danger' ? 'bg-rose-50 text-rose-600 ring-rose-200' : 'bg-blue-50 text-blue-600 ring-blue-200',
          )}
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="pt-0.5 text-sm leading-relaxed text-silver-700">{message}</div>
      </div>
    </Modal>
  )
}
