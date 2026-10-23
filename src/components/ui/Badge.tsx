import type { ReactNode } from 'react'
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

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-silver-100 text-silver-700 ring-silver-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-200',
  success: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-rose-50 text-rose-800 ring-rose-200',
  purple: 'bg-violet-50 text-violet-800 ring-violet-200',
  silver: 'bg-silver-100 text-navy-700 ring-silver-300',
  navy: 'bg-ink text-white ring-ink',
  gold: 'bg-gold-50 text-gold-800 ring-gold-300',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  )
}

/* Status vocabulary: every state is learnable because the same word
   always renders the same tone, and colour is never the only signal —
   StatusBadge always shows its dot and its label. */
const STATUS_TONES: Record<string, BadgeTone> = {
  // Leads
  'New Lead': 'info',
  Contacted: 'purple',
  'Follow-up': 'warning',
  Negotiation: 'warning',
  Won: 'success',
  Lost: 'danger',
  // Quotations
  Draft: 'neutral',
  Sent: 'info',
  Approved: 'success',
  Rejected: 'danger',
  Superseded: 'neutral',
  // Invoices / payments
  Unpaid: 'danger',
  Advance: 'info',
  Partial: 'warning',
  Paid: 'success',
  // Manufacturing
  Pending: 'neutral',
  'In Progress': 'info',
  Completed: 'success',
  Delayed: 'danger',
  // Packaging
  Packed: 'success',
  // Dispatch
  'Ready to Dispatch': 'silver',
  Dispatched: 'info',
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

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = STATUS_TONES[status] ?? 'neutral'
  return (
    <Badge tone={tone} className={className} dot>
      {status}
    </Badge>
  )
}
