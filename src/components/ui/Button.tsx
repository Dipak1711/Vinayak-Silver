import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'gold'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
  iconRight?: ReactNode
  loading?: boolean
}

/* One confident solid fill per intent, each carrying its own soft glow so
   it reads as a physical control rather than a flat swatch. Exactly one
   variant is allowed to be loud; outline and ghost stay quiet. */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white shadow-[0_10px_24px_-8px_rgba(79,70,229,0.55)] hover:bg-blue-700',
  secondary: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  outline: 'bg-white text-navy-800 shadow-flat hover:bg-silver-50 hover:text-navy-900 hover:shadow-card',
  ghost: 'text-navy-700 hover:bg-silver-100 hover:text-navy-900',
  danger: 'bg-rose-600 text-white shadow-[0_10px_24px_-8px_rgba(220,38,38,0.5)] hover:bg-rose-700',
  success: 'bg-emerald-600 text-white shadow-[0_10px_24px_-8px_rgba(5,150,105,0.5)] hover:bg-emerald-700',
  gold: 'bg-gold-500 text-white shadow-[0_10px_24px_-8px_rgba(245,158,11,0.5)] hover:bg-gold-600',
}

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 gap-1.5 px-2 text-[11px] font-semibold',
  sm: 'h-8 gap-1.5 px-3 text-[12.5px]',
  md: 'h-10 gap-2 px-4 text-[13.5px]',
  lg: 'h-11 gap-2 px-5 text-[14.5px]',
  icon: 'h-9 w-9 justify-center',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  className,
  children,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'pressable relative inline-flex select-none items-center justify-center rounded-lg font-semibold tracking-[-0.01em]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:saturate-50',
        size === 'icon' && 'hit',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
}
