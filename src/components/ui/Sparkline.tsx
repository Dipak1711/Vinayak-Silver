import { useId } from 'react'
import { cn } from '@/lib/utils'

export type SparkTone = 'sapphire' | 'emerald' | 'gold' | 'rose' | 'violet' | 'slate'

const STROKE: Record<SparkTone, string> = {
  sapphire: '#df6527',
  emerald: '#059669',
  gold: '#d97706',
  rose: '#dc2626',
  violet: '#7c3aed',
  slate: '#6f665c',
}

/**
 * A trend shape that supports the figure beside it. Deliberately quiet:
 * no axes, no labels, no interaction. It answers "which way is this
 * going", nothing more.
 */
export function Sparkline({
  data,
  tone = 'sapphire',
  className,
  height = 30,
  filled = true,
}: {
  data: number[]
  tone?: SparkTone
  className?: string
  height?: number
  filled?: boolean
}) {
  const gradientId = useId()
  if (!data || data.length < 2) return null

  const width = 100
  const pad = 3
  const max = Math.max(...data)
  const min = Math.min(...data)
  const span = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = pad + (1 - (value - min) / span) * (height - pad * 2)
    return [x, y] as const
  })

  const line = points
    .map(([x, y], index) => {
      if (index === 0) return `M${x.toFixed(2)},${y.toFixed(2)}`
      const [px, py] = points[index - 1]
      const cx = (px + x) / 2
      return `C${cx.toFixed(2)},${py.toFixed(2)} ${cx.toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      height={height}
      className={cn('w-full overflow-visible', className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={STROKE[tone]} stopOpacity="0.20" />
          <stop offset="100%" stopColor={STROKE[tone]} stopOpacity="0" />
        </linearGradient>
      </defs>
      {filled ? <path d={area} fill={`url(#${gradientId})`} /> : null}
      <path
        d={line}
        fill="none"
        stroke={STROKE[tone]}
        strokeWidth="1.75"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
