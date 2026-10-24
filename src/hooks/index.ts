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
  const positions = useRef(new Map<string, { x: number; y: number }>())

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Positions are measured against the container's scrolled content and the
    // page, so scrolling between two renders never reads as movement.
    const box = root.getBoundingClientRect()
    const next = new Map<string, { x: number; y: number }>()
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach((el) => {
      const id = el.dataset.flip as string
      const rect = el.getBoundingClientRect()
      const pos = { x: rect.left - box.left + root.scrollLeft, y: rect.top + window.scrollY }
      next.set(id, pos)
      const prev = positions.current.get(id)
      if (!prev || reduce) return
      const dx = prev.x - pos.x
      const dy = prev.y - pos.y
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return
      // Lift the card's column above its neighbours while it travels across them.
      const layer = el.closest<HTMLElement>('[data-flip-layer]')
      if (layer) layer.style.zIndex = '20'
      const animation = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
        duration: 420,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      })
      animation.onfinish = animation.oncancel = () => {
        if (layer) layer.style.zIndex = ''
      }
    })
    positions.current = next
  }, [signal])

  return ref
}
