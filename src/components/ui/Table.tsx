import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl bg-surface shadow-lift', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn('w-full min-w-[720px] border-collapse text-sm', className)}>{children}</table>
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-silver-200 bg-silver-50 text-left">
      {children}
    </thead>
  )
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-silver-200">{children}</tbody>
}

export function TR({
  children,
  className,
  onClick,
  selected = false,
}: {
  children: ReactNode
  className?: string
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <tr
      onClick={onClick}
      aria-selected={selected || undefined}
      className={cn(
        'row-hover transition-colors',
        selected ? 'bg-silver-100' : 'hover:bg-silver-50 hover:shadow-[inset_3px_0_0_0_#ed7333]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function Th({
  children,
  className,
  align = 'left',
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'px-4 py-3 text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-silver-600 uppercase',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className,
  align = 'left',
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 align-middle leading-snug text-navy-800',
        align === 'right' && 'text-right tnum',
        align === 'center' && 'text-center',
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}

export function TableEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-14">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-silver-100 text-silver-500 ring-1 ring-silver-200 ring-inset">
            <Inbox className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-navy-800">{children}</p>
          <p className="max-w-sm text-xs text-silver-600">
            Adjust the search or filters above, or add a new record to fill this list.
          </p>
        </div>
      </td>
    </tr>
  )
}
