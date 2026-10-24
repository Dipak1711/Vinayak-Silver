import type { MouseEvent, ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Sparkline, type SparkTone } from '@/components/ui/Sparkline'
import { cn } from '@/lib/utils'

export type StatTone = 'sapphire' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'navy' | 'cyan' | 'gold'

interface ToneSpec {
  /** Soft icon tile: tinted fill, coloured glyph, hairline ring. */
  tile: string
  /** Solid colour behind the card's top-down wash. */
  glow: string
  spark: SparkTone
}

/* Cards are white panels with a tone-coloured wash that fades down from
   the top edge; the icon sits in a soft tinted tile rather than a solid
   gradient, so a row of cards reads as calm colour, not loud swatches. */
const soft = (bg: string, fg: string, ring: string) => `${bg} ${fg} ring-1 ring-inset ${ring}`
const TONES: Record<StatTone, ToneSpec> = {
  sapphire: { tile: 'bg-[#dbeafe] text-[#1d4ed8] ring-1 ring-inset ring-[#bfdbfe] dark:bg-[#1e3a8a]/40 dark:text-[#93c5fd] dark:ring-[#1e3a8a]', glow: '#3b82f6', spark: 'sapphire' },
  // `blue` is the same system as `sapphire`; both names are accepted.
  blue: { tile: 'bg-[#dbeafe] text-[#1d4ed8] ring-1 ring-inset ring-[#bfdbfe] dark:bg-[#1e3a8a]/40 dark:text-[#93c5fd] dark:ring-[#1e3a8a]', glow: '#3b82f6', spark: 'sapphire' },
  emerald: { tile: soft('bg-emerald-100/70', 'text-emerald-700', 'ring-emerald-200'), glow: '#10b981', spark: 'emerald' },
  amber: { tile: soft('bg-amber-100/70', 'text-amber-700', 'ring-amber-200'), glow: '#f59e0b', spark: 'gold' },
  rose: { tile: soft('bg-rose-100/70', 'text-rose-700', 'ring-rose-200'), glow: '#ef4444', spark: 'rose' },
  violet: { tile: soft('bg-violet-100/70', 'text-violet-700', 'ring-violet-200'), glow: '#8b5cf6', spark: 'violet' },
  navy: { tile: soft('bg-silver-100', 'text-silver-700', 'ring-silver-300'), glow: '#64748b', spark: 'slate' },
  cyan: { tile: soft('bg-cyan-100/70', 'text-cyan-700', 'ring-cyan-200'), glow: '#0ea5e9', spark: 'sapphire' },
  gold: { tile: soft('bg-gold-100/70', 'text-gold-700', 'ring-gold-200'), glow: '#f59e0b', spark: 'gold' },
}

export interface StatCardProps {
  label: string
  /** A number animates on reveal; a rendered node is placed as-is. */
  value: ReactNode | number
  numericValue?: number
  format?: (value: number) => string
  icon?: ReactNode
  tone?: StatTone
  hint?: ReactNode
  /** Signed change, e.g. 12.4 for +12.4%. */
  trend?: { value: number; label?: string }
  trendGoodWhenUp?: boolean
  spark?: number[]
  footer?: ReactNode
  onClick?: () => void
  className?: string
}

export function StatCard({
  label,
  value,
  numericValue,
  format,
  icon,
  tone = 'sapphire',
  hint,
  trend,
  trendGoodWhenUp = true,
  spark,
  footer,
  onClick,
  className,
}: StatCardProps) {
  const spec = TONES[tone]
  const animated = numericValue ?? (typeof value === 'number' ? value : undefined)
  const up = (trend?.value ?? 0) >= 0
  const good = up === trendGoodWhenUp

  const hasFooter = Boolean(trend || hint || (spark && spark.length > 1) || footer)

  // Cursor position drives the hover spotlight through CSS variables, so
  // moving the mouse never re-renders the card.
  const track = (event: MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    event.currentTarget.style.setProperty('--mx', `${event.clientX - box.left}px`)
    event.currentTarget.style.setProperty('--my', `${event.clientY - box.top}px`)
  }

  const body = (
    <>
      {/* Tone-coloured light drifting behind the glass. */}
      <span
        className="orb-drift pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full opacity-25 blur-2xl dark:opacity-45"
        style={{ background: spec.glow }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(160deg, ${spec.glow}1f 0%, ${spec.glow}0a 55%, transparent 100%)`,
        }}
        aria-hidden="true"
      />
      {/* Soft spotlight that follows the pointer. */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ backgroundImage: `radial-gradient(180px circle at var(--mx, 50%) var(--my, 50%), ${spec.glow}30, transparent 70%)` }}
        aria-hidden="true"
      />
      <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-white/90 to-transparent" aria-hidden="true" />
      <div className="relative flex items-center gap-3.5">
        {icon ? (
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', spec.tile)}>
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-[24px] leading-none font-extrabold tracking-[-0.03em] text-navy-900">
            {animated !== undefined ? <AnimatedNumber value={animated} format={format} /> : value}
          </p>
          <p className="mt-1 truncate text-[13px] leading-tight font-semibold text-silver-700">{label}</p>
        </div>
      </div>

      {hasFooter ? (
        <div className="relative mt-auto flex flex-col gap-2 pt-2.5">
          {trend || hint ? (
            <div className="flex items-center gap-2">
              {trend ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ring-1 ring-inset',
                    good
                      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                      : 'bg-rose-50 text-rose-700 ring-rose-200',
                  )}
                >
                  {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {up ? '+' : ''}
                  {trend.value.toFixed(1)}%
                </span>
              ) : null}
              {hint ? <span className="min-w-0 truncate text-[12.5px] text-silver-600">{hint}</span> : null}
            </div>
          ) : null}

          {spark && spark.length > 1 ? <Sparkline data={spark} tone={spec.spark} height={22} /> : null}

          {footer}
        </div>
      ) : null}
    </>
  )

  const shell = cn(
    'group relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-surface/60 p-4 text-left shadow-card ring-1 ring-white/70 backdrop-blur-xl dark:ring-white/10',
    'lift',
    onClick && 'pressable cursor-pointer',
    className,
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} onMouseMove={track} className={shell}>
        {body}
      </button>
    )
  }

  return (
    <div onMouseMove={track} className={shell}>
      {body}
    </div>
  )
}
