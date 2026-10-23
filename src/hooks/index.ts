import { useEffect, useRef, useState } from 'react'

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

/** Simple debounce hook for search inputs. */
export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export type Theme = 'light' | 'dark'

/* The theme lives on <html data-theme> so it can be applied before first
   paint by the inline script in index.html; this hook just keeps React and
   localStorage in step with it. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const current = document.documentElement.getAttribute('data-theme')
    return current === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('vinayak.theme', theme)
    } catch {
      /* private mode — the preference just isn't remembered */
    }
  }, [theme])

  const toggle = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  return { theme, setTheme, toggle }
}
