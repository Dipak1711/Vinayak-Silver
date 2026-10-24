import { useEffect, useState, type ReactNode } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  icon,
  eyebrow,
}: {
  title: string
  description?: string
  actions?: ReactNode
  icon?: ReactNode
  eyebrow?: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-start gap-3.5">
        {icon ? (
          <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-linear-to-br from-[#334155] to-[#0f172a] text-white shadow-[0_12px_24px_-10px_rgba(15,23,42,0.55),inset_0_1px_0_0_rgba(255,255,255,0.18)]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="flex items-center gap-3 text-[11.5px] font-semibold tracking-[0.22em] text-silver-500 uppercase">
              <span className="h-[3px] w-8 shrink-0 rounded-full bg-linear-to-r from-[#ed7333] to-gold-400" aria-hidden="true" />
              {eyebrow}
            </p>
          ) : null}
          <h1 className="title-gradient mt-2.5 text-[28px] leading-[1.1] font-extrabold tracking-[-0.03em] sm:text-[32px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-silver-600">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  ariaLabel?: string
}) {
  return (
    <div className={cn('group relative', className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-silver-500 transition-colors group-focus-within:text-blue-600"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-silver-300 bg-surface pr-9 pl-9 text-[16px] text-navy-900 shadow-[inset_0_1px_2px_0_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] duration-150 placeholder:text-silver-600 hover:border-silver-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none sm:text-sm"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="pressable absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-silver-500 transition-colors hover:bg-silver-100 hover:text-navy-700"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      {icon ? (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-silver-100 to-silver-200 text-silver-600 shadow-flat">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        {description ? <p className="mx-auto mt-1 max-w-sm text-xs text-silver-600">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/* Scale rather than width: the fill stays on the compositor and never
   triggers layout while it animates. `track` is a class so the bar can
   sit on a dark surface without fighting the default background. */
export function ProgressBar({
  value,
  tone = 'blue',
  className,
  track = 'bg-silver-200 shadow-[inset_0_1px_1px_0_rgba(15,23,42,0.08)]',
}: {
  value: number
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'navy' | 'gold'
  className?: string
  track?: string
}) {
  const tones: Record<string, string> = {
    blue: 'from-[#f28c4c] to-[#c4531c]',
    emerald: 'from-emerald-400 to-emerald-600',
    amber: 'from-amber-400 to-amber-600',
    rose: 'from-rose-400 to-rose-600',
    navy: 'from-navy-600 to-navy-900',
    gold: 'from-gold-400 to-gold-600',
  }
  const clamped = Math.max(0, Math.min(100, value))
  // Mount at zero, then fill: the bar visibly grows to its value on first paint.
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(clamped))
    return () => cancelAnimationFrame(frame)
  }, [clamped])
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full', track, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full w-full origin-left rounded-full bg-linear-to-r transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]', tones[tone])}
        style={{ transform: `scaleX(${shown / 100})` }}
      />
    </div>
  )
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs font-medium text-silver-600">{label}</span>
      <span className="text-right text-[13px] font-medium text-navy-900">{value}</span>
    </div>
  )
}
