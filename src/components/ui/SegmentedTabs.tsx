import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedItem<T extends string> {
  value: T
  label: string
  count?: number
  icon?: ReactNode
}

/**
 * Selection is shown by one indicator that slides between options rather
 * than each option lighting up on its own, so the change of state is
 * legible as a movement from somewhere to somewhere else.
 */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
  className,
  size = 'md',
}: {
  value: T
  onChange: (value: T) => void
  items: Array<SegmentedItem<T>>
  className?: string
  size?: 'sm' | 'md'
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current
      const active = container?.querySelector<HTMLElement>('[data-active="true"]')
      if (!container || !active) {
        setIndicator(null)
        return
      }
      const containerRect = container.getBoundingClientRect()
      const rect = active.getBoundingClientRect()
      setIndicator({ left: rect.left - containerRect.left, width: rect.width })
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [value, items.length])

  return (
    <div
      ref={containerRef}
      role="tablist"
      className={cn(
        'relative inline-flex flex-wrap items-center gap-0.5 rounded-xl border border-silver-200 bg-silver-100/80 p-1 shadow-[inset_0_1px_2px_0_rgba(15,23,42,0.05)]',
        className,
      )}
    >
      {indicator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg bg-surface shadow-card transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
            top: 4,
            bottom: 4,
            left: 0,
          }}
        />
      ) : null}

      {items.map((item) => {
        const isActive = item.value === value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive || undefined}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative z-10 inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors duration-150',
              size === 'sm' ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs',
              isActive ? 'text-navy-900' : 'text-silver-600 hover:text-navy-800',
            )}
          >
            {item.icon}
            {item.label}
            {item.count !== undefined ? (
              <span
                className={cn(
                  'tnum rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  isActive ? 'bg-blue-50 text-blue-700' : 'bg-silver-200/70 text-silver-600',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
