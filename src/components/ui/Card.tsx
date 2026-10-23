import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* Elevation strategy for this project: layered.
   Surfaces carry `shadow-*`, and each shadow token includes its own
   hairline ring. Solid borders are reserved for true separation —
   table dividers, input outlines, hairlines — so a panel never has a
   border and a heavy shadow both shouting. */

export type CardVariant = 'default' | 'raised' | 'flat' | 'dark' | 'sunset' | 'interactive'

const VARIANTS: Record<CardVariant, string> = {
  default: 'bg-surface/75 shadow-card ring-1 ring-white/60 backdrop-blur-xl dark:ring-white/10',
  raised: 'bg-surface shadow-lift',
  flat: 'bg-silver-50/80 shadow-flat',
  // Explicit base colour as well as the gradient, so the surface is dark
  // even if a background-image from elsewhere wins the cascade. The sheen
  // is layered as its own element below.
  dark: 'bg-[#5a2710] bg-linear-to-br from-[#5a2710] via-[#c4531c] to-[#d6581e] text-white shadow-panel',
  // Warm amber-to-orange hero surface.
  sunset: 'bg-[#ed7333] bg-linear-to-br from-[#f58a4e] via-[#ed7333] to-[#c24a16] hero-animated text-white shadow-[0_24px_48px_-20px_rgba(237,115,51,0.6)]',
  interactive: 'bg-surface shadow-card lift pressable cursor-pointer hover:shadow-lift',
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean
  variant?: CardVariant
}

export function Card({ className, padded = true, variant = 'default', children, ...rest }: CardProps) {
  return (
    <div className={cn('relative rounded-2xl', VARIANTS[variant], padded && 'p-5', className)} {...rest}>
      {variant === 'dark' ? (
        <span className="sheen pointer-events-none absolute inset-0 rounded-2xl" aria-hidden="true" />
      ) : null}
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: ReactNode
  className?: string
  /** Adds a top accent rule that signals the card's role. */
  accent?: 'sapphire' | 'gold' | 'emerald' | 'rose' | 'none'
}

const ACCENTS: Record<string, string> = {
  sapphire: 'from-[#f28c4c] to-[#c4531c]',
  gold: 'from-gold-400 to-gold-700',
  emerald: 'from-emerald-500 to-emerald-700',
  rose: 'from-rose-500 to-rose-700',
  none: '',
}

export function CardHeader({ title, subtitle, action, icon, className, accent = 'none' }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-silver-100 text-navy-700 ring-1 ring-silver-200 ring-inset">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.015em] text-navy-900">
            {accent !== 'none' ? (
              <span className={cn('h-4 w-1 rounded-full bg-linear-to-b', ACCENTS[accent])} aria-hidden="true" />
            ) : null}
            {title}
          </h3>
          {subtitle ? <p className="mt-1 text-xs text-silver-600">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  )
}
