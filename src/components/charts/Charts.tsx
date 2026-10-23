import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/utils'

/* Seven steps of distinct lightness, so a pie still reads when every hue
   collapses to grey (deuteranopia, bad projectors, printed handouts). */
export const CHART_PALETTE = [
  '#ed7333', // orange
  '#0f766e', // teal
  '#7c3aed', // violet
  '#0ea5e9', // sky
  '#059669', // emerald
  '#dc2626', // rose
  '#8f857a', // warm grey
]

const AXIS = { fontSize: 11, fill: '#8f857a', fontWeight: 500 }
const GRID = '#ebe6df'

interface TooltipEntry {
  name?: string
  value?: number | string
  color?: string
  dataKey?: string | number
}

function ChartTooltip({
  active,
  payload,
  label,
  currency = true,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  currency?: boolean
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="animate-pop-in rounded-xl border border-silver-200 bg-surface/95 px-3 py-2 shadow-panel backdrop-blur">
      {label !== undefined && label !== '' ? (
        <p className="mb-1.5 text-[11px] font-bold tracking-[0.06em] text-silver-600 uppercase">{label}</p>
      ) : null}
      <div className="flex flex-col gap-1">
        {payload.map((entry, index) => (
          <div key={`${entry.dataKey}-${index}`} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} aria-hidden="true" />
            <span className="capitalize text-silver-600">{entry.name}</span>
            <span className="tnum ml-auto font-bold text-navy-900">
              {currency ? formatCurrency(Number(entry.value ?? 0)) : formatNumber(Number(entry.value ?? 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SalesTrendChart({
  data,
  height = 268,
}: {
  data: Array<{ name: string; invoiced: number; collected: number }>
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="invoicedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#df6527" stopOpacity={0.30} />
            <stop offset="100%" stopColor="#df6527" stopOpacity={0.01} />
          </linearGradient>
          <linearGradient id="collectedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} dy={6} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          width={62}
          tickFormatter={(value: number) => (value >= 100000 ? `${(value / 100000).toFixed(0)}L` : `${value / 1000}K`)}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#d9d2c8', strokeWidth: 1 }} />
        <Area
          type="monotone"
          dataKey="invoiced"
          name="Invoiced"
          stroke="#df6527"
          strokeWidth={2.5}
          fill="url(#invoicedFill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          animationDuration={700}
          animationEasing="ease-out"
        />
        <Area
          type="monotone"
          dataKey="collected"
          name="Collected"
          stroke="#059669"
          strokeWidth={2.5}
          fill="url(#collectedFill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function CategoryBarChart({
  data,
  color = '#df6527',
  height = 240,
  currency = false,
  horizontal = false,
}: {
  data: Array<{ name: string; value: number }>
  color?: string
  height?: number
  currency?: boolean
  horizontal?: boolean
}) {
  const gradientId = horizontal ? 'barFillH' : 'barFillV'
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, left: horizontal ? 8 : -18, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
            <stop offset="0%" stopColor={color} stopOpacity={0.95} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        {horizontal ? (
          <>
            <CartesianGrid stroke={GRID} strokeDasharray="3 6" horizontal={false} />
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={AXIS} axisLine={false} tickLine={false} width={132} />
          </>
        ) : (
          <>
            <CartesianGrid stroke={GRID} strokeDasharray="3 6" vertical={false} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} interval={0} dy={4} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={40} />
          </>
        )}
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ fill: '#f7f4f0' }} />
        <Bar
          dataKey="value"
          name="Value"
          fill={`url(#${gradientId})`}
          radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
          maxBarSize={44}
          animationDuration={650}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function DonutChart({
  data,
  height = 240,
  colors = CHART_PALETTE,
  currency = false,
  innerRadius = 58,
  centerLabel,
}: {
  data: Array<{ name: string; value: number }>
  height?: number
  colors?: string[]
  currency?: boolean
  innerRadius?: number
  centerLabel?: string
}) {
  const total = data.reduce((acc, entry) => acc + entry.value, 0)

  if (total === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-silver-600" style={{ height }}>
        No data to display yet
      </div>
    )
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={84}
            paddingAngle={2}
            strokeWidth={2}
            stroke="#fff"
            animationDuration={700}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Legend
            verticalAlign="bottom"
            height={38}
            iconType="circle"
            iconSize={7}
            formatter={(value: string) => (
              <span className="text-[11px] font-medium text-silver-600">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      <div
        className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
        style={{ top: `calc(50% - 20px)`, transform: 'translateY(-50%)' }}
      >
        {centerLabel ? (
          <span className="text-[10px] font-bold tracking-[0.08em] text-silver-500 uppercase">{centerLabel}</span>
        ) : null}
        <span className="tnum text-[22px] leading-none font-bold text-navy-900">
          {currency ? formatCurrency(total, true) : formatNumber(total)}
        </span>
      </div>
    </div>
  )
}
