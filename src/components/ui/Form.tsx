import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/* 16px on small screens: anything below that makes iOS Safari zoom the
   viewport on focus, which breaks the layout mid-task. */
const CONTROL =
  'w-full rounded-[11px] border border-silver-300 bg-surface px-3 text-[16px] text-navy-900 shadow-[inset_0_1px_2px_0_rgba(15,23,42,0.045)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-silver-600 hover:border-silver-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:cursor-not-allowed disabled:bg-silver-50 disabled:text-silver-600 sm:text-sm'

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label?: ReactNode
  htmlFor?: string
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
}) {
  const message = error ? (
    <p className="field-error flex items-center gap-1.5 text-xs font-medium text-rose-700">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
      {error}
    </p>
  ) : hint ? (
    <p className="text-xs text-silver-600">{hint}</p>
  ) : null

  // Wrapping the control inside its label associates them implicitly, so
  // every field is announced correctly without hand-wiring ids.
  if (label) {
    return (
      <label htmlFor={htmlFor} className={cn('flex flex-col gap-1.5', className)}>
        <span className="text-[13px] font-semibold text-silver-700">
          {label}
          {required ? (
            <span className="ml-0.5 text-rose-500" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        {children}
        {message}
      </label>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {children}
      {message}
    </div>
  )
}

export function Input({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        'h-[42px]',
        invalid && 'field-shake border-rose-400 focus:border-rose-500 focus:ring-rose-100',
        className,
      )}
      {...rest}
    />
  )
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        'min-h-[84px] py-2 leading-relaxed',
        invalid && 'field-shake border-rose-400 focus:border-rose-500 focus:ring-rose-100',
        className,
      )}
      {...rest}
    />
  )
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        'h-[42px] cursor-pointer appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9',
        invalid && 'field-shake border-rose-400',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  )
}

export function Checkbox({
  label,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2 text-sm text-navy-800 select-none', className)}>
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 rounded border-silver-300 text-blue-600 transition-colors focus:ring-2 focus:ring-blue-200"
        {...rest}
      />
      {label}
    </label>
  )
}
