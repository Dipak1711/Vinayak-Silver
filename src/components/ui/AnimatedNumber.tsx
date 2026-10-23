import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reveals a change in value rather than decorating a number.
 *
 * The element is readable at every frame and the layout never shifts, so
 * this never delays the task — it only makes the magnitude of a figure
 * legible as it settles. Reduced-motion visitors get the final value
 * immediately.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 520,
  className,
}: {
  value: number
  format?: (value: number) => string
  duration?: number
  className?: string
}) {
  const render = format ?? ((n: number) => String(Math.round(n)))
  const reduced = useRef(prefersReducedMotion()).current
  const [display, setDisplay] = useState(() => (reduced ? value : 0))
  const fromRef = useRef(reduced ? value : 0)

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      fromRef.current = value
      return
    }

    const from = fromRef.current
    const delta = value - from
    if (delta === 0) {
      setDisplay(value)
      return
    }

    // easeOutQuint: decelerate hard, settle cleanly, no bounce.
    const duration_ = Math.min(duration, 900)
    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration_, 1)
      const eased = 1 - Math.pow(1 - t, 5)
      setDisplay(from + delta * eased)
      if (t < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        setDisplay(value)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      fromRef.current = value
    }
  }, [value, duration, reduced])

  return <span className={cn('tnum', className)}>{render(display)}</span>
}
