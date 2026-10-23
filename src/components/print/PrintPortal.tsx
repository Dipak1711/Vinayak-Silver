import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders print content into document.body and triggers the browser print
 * dialog. The application shell is marked `no-print`, so only this content
 * appears on paper.
 */
export function PrintPortal({
  open,
  onDone,
  children,
}: {
  open: boolean
  onDone: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      window.print()
      onDone()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [open, onDone])

  if (!open) return null
  return createPortal(<div className="print-only bg-white text-navy-950">{children}</div>, document.body)
}
