import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Sparkline, type SparkTone } from '@/components/ui/Sparkline'
import { cn } from '@/lib/utils'

export type StatTone = 'sapphire' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'navy' | 'cyan' | 'gold'

interface ToneSpec {
  tile: string
  glow: string
  spark: SparkTone
}

/* Icon tiles carry a two-stop gradient plus a matching top-light, so the
   row of tiles reads as one material rather than eight pastels. */
const TONES: Record<StatTone, ToneSpec> = {
  sapphire: { tile: 'from-blue-500 to-blue-700', glow: '#4f46e5', spark: 'sapphire' },
  // `blue` is the same system as `sapphire`; both names are accepted.
  blue: { tile: 'from-blue-500 to-blue-700', glow: '#4f46e5', spark: 'sapphire' },
  emerald: { tile: 'from-emerald-500 to-emerald-700', glow: '#059669', spark: 'emerald' },
  amber: { tile: 'from-amber-500 to-amber-700', glow: '#f59e0b', spark: 'gold' },
  rose: { tile: 'from-rose-500 to-rose-700', glow: '#dc2626', spark: 'rose' },
  violet: { tile: 'from-violet-500 to-violet-700', glow: '#7c3aed', spark: 'violet' },
  navy: { tile: 'from-[#2b3445] to-[#0f172a]', glow: '#1c2537', spark: 'slate' },
  cyan: { tile: 'from-cyan-500 to-cyan-700', glow: '#0d9488', spark: 'sapphire' },
  gold: { tile: 'from-gold-400 to-gold-700', glow: '#d97706', spark: 'gold' },
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

  const body = (
    <>
      {/* A tone-tinted wash from the top-left corner, so each card carries
          its own colour rather than every card reading as flat white. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${spec.glow}2b 0%, ${spec.glow}0d 40%, transparent 64%)`,
        }}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -top-14 -right-12 h-32 w-32 rounded-full opacity-[0.16] blur-2xl"
        style={{ background: spec.glow }}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] leading-tight font-semibold tracking-[0.08em] text-silver-600 uppercase">
            {label}
          </p>
          <p className="mt-2.5 text-[26px] leading-none font-extrabold tracking-[-0.035em] text-navy-900">
            {animated !== undefined ? <AnimatedNumber value={animated} format={format} /> : value}
          </p>
        </div>
        {icon ? (
          <span
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-linear-to-br text-white shadow-[0_2px_6px_-1px_rgba(15,23,42,0.25),inset_0_1px_0_0_rgba(255,255,255,0.25)]',
              spec.tile,
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      {hasFooter ? (
        <div className="relative mt-auto flex flex-col gap-2.5 pt-3">
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
              {hint ? <span className="min-w-0 truncate text-xs text-silver-600">{hint}</span> : null}
            </div>
          ) : null}

          {spark && spark.length > 1 ? <Sparkline data={spark} tone={spec.spark} height={30} /> : null}

          {footer}
        </div>
      ) : null}
    </>
  )

  const shell = cn(
    'relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-surface p-5 text-left shadow-card',
    onClick && 'lift pressable cursor-pointer',
    className,
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {body}
      </button>
    )
  }

  return <div className={shell}>{body}</div>
}
