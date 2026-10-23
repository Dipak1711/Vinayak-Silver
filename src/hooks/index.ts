import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onOutside])

  return ref
}

export type Theme = 'light' | 'dark'

/* The theme lives on <html data-theme>. index.html always starts it as
   light on load; this hook just keeps React in step and lets the toggle
   switch it for the current visit only. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const current = document.documentElement.getAttribute('data-theme')
    return current === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  return { theme, setTheme, toggle }
}

/**
 * FLIP animation for keyed items. Mark each movable element with
 * `data-flip="<id>"`; whenever `signal` changes, every marked element
 * slides from where it was to where it now is, even across containers.
 * Uses the Web Animations API on transform only, so it stays on the
 * compositor and costs nothing when nothing moves.
 */
export function useFlip<T extends HTMLElement>(signal: string) {
  const ref = useRef<T | null>(null)
  const rects = useRef(new Map<string, DOMRect>())

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, DOMRect>()
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const id = el.dataset.flip as string
      const rect = el.getBoundingClientRect()
      next.set(id, rect)
      const prev = rects.current.get(id)
      if (!prev || reduce) return
      const dx = prev.left - rect.left
      const dy = prev.top - rect.top
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 380,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      })
    })
    rects.current = next
  }, [signal])

  return ref
}
