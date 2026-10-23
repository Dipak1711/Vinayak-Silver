import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple'
  | 'silver'
  | 'navy'
  | 'gold'
  | 'cyan'

/* Each tone is a soft two-stop tint plus a matching ring, so a table full
   of badges reads as a coloured legend rather than grey pills. The dot
   takes the tone's solid colour and carries a faint glow. */
const TONES: Record<BadgeTone, { chip: string; dot: string }> = {
  neutral: {
    chip: 'bg-linear-to-b from-silver-50 to-silver-100 text-silver-700 ring-silver-300',
    dot: 'bg-silver-500',
  },
  info: {
    chip: 'bg-linear-to-b from-cyan-50 to-cyan-100/70 text-cyan-800 ring-cyan-200',
    dot: 'bg-cyan-500 shadow-[0_0_6px_1px_rgba(14,165,233,0.55)]',
  },
  success: {
    chip: 'bg-linear-to-b from-emerald-50 to-emerald-100/70 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.55)]',
  },
  warning: {
    chip: 'bg-linear-to-b from-amber-50 to-amber-100/70 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500 shadow-[0_0_6px_1px_rgba(245,158,11,0.55)]',
  },
  danger: {
    chip: 'bg-linear-to-b from-rose-50 to-rose-100/70 text-rose-800 ring-rose-200',
    dot: 'bg-rose-500 shadow-[0_0_6px_1px_rgba(239,68,68,0.55)]',
  },
  purple: {
    chip: 'bg-linear-to-b from-violet-50 to-violet-100/70 text-violet-800 ring-violet-200',
    dot: 'bg-violet-500 shadow-[0_0_6px_1px_rgba(139,92,246,0.55)]',
  },
  cyan: {
    chip: 'bg-linear-to-b from-[#e6f7f5] to-[#cdeee9]/70 text-[#0f5f58] ring-[#a7ded6]',
    dot: 'bg-[#14b8a6] shadow-[0_0_6px_1px_rgba(20,184,166,0.55)]',
  },
  gold: {
    chip: 'bg-linear-to-b from-gold-50 to-gold-100/70 text-gold-800 ring-gold-300',
    dot: 'bg-gold-500 shadow-[0_0_6px_1px_rgba(245,158,11,0.55)]',
  },
  silver: {
    chip: 'bg-linear-to-b from-silver-50 to-silver-200/70 text-navy-700 ring-silver-300',
    dot: 'bg-navy-400',
  },
  navy: { chip: 'bg-ink text-white ring-ink', dot: 'bg-white' },
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot = false,
  live = false,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  dot?: boolean
  /** Pulses the dot, for states that are happening right now. */
  live?: boolean
}) {
  const spec = TONES[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset',
        spec.chip,
        className,
      )}
    >
      {dot ? (
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
          {live ? <span className="badge-ping absolute inset-0 rounded-full bg-current opacity-60" /> : null}
          <span className={cn('relative h-1.5 w-1.5 rounded-full', spec.dot)} />
        </span>
      ) : null}
      {children}
    </span>
  )
}

/* Status vocabulary: every state is learnable because the same word
   always renders the same tone, and colour is never the only signal —
   StatusBadge always shows its dot and its label. */
const STATUS_TONES: Record<string, BadgeTone> = {
  // Leads
  'New Lead': 'cyan',
  Contacted: 'purple',
  'Follow-up': 'warning',
  Negotiation: 'gold',
  Won: 'success',
  Lost: 'danger',
  // Quotations
  Draft: 'neutral',
  Sent: 'cyan',
  Approved: 'success',
  Rejected: 'danger',
  Superseded: 'neutral',
  // Invoices / payments
  Unpaid: 'danger',
  Advance: 'cyan',
  Partial: 'warning',
  Paid: 'success',
  // Manufacturing
  Pending: 'neutral',
  'Low stock': 'danger',
  'In stock': 'success',
  Open: 'info',
  Overdue: 'danger',
  'In Progress': 'info',
  Completed: 'success',
  Delayed: 'danger',
  // Packaging
  Packed: 'success',
  // Dispatch
  'Ready to Dispatch': 'silver',
  Dispatched: 'cyan',
  'In Transit': 'purple',
  Delivered: 'success',
  // Stock movements
  Inward: 'success',
  Outward: 'warning',
  Adjustment: 'purple',
  // Products
  Finished: 'success',
  'Made to Order': 'warning',
  // Suppliers
  Purchase: 'warning',
  Payment: 'success',
}

/* States that mean "something is happening right now" pulse gently. */
const LIVE_STATUSES = new Set(['In Progress', 'In Transit', 'Delayed', 'Dispatched'])

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? 'neutral'
  // A real status change (not first render) pops the badge once, so the
  // motion always reflects a state change that actually happened.
  const previous = useRef(status)
  const [changed, setChanged] = useState(false)
  useEffect(() => {
    if (previous.current === status) return
    previous.current = status
    setChanged(true)
    const timer = window.setTimeout(() => setChanged(false), 900)
    return () => window.clearTimeout(timer)
  }, [status])
  return (
    <Badge tone={tone} className={cn(changed && 'badge-changed', className)} dot live={LIVE_STATUSES.has(status)}>
      {status}
    </Badge>
  )
}
