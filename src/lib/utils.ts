export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

let idCounter = 0;

/** Stable-ish unique id generator. */
export function uid(prefix = 'id'): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${rand}`;
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function formatDate(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/* ------------------------------------------------------------------ */
/* Numbers & currency                                                  */
/* ------------------------------------------------------------------ */

export function formatCurrency(value: number, compact = false): string {
  if (Number.isNaN(value) || value === undefined || value === null) return '₹0'
  if (compact && Math.abs(value) >= 1000) {
    if (Math.abs(value) >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`
    if (Math.abs(value) >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`
    return `₹${(value / 1000).toFixed(1)} K`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return '0'
  return new Intl.NumberFormat('en-IN').format(value)
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function downloadCSV(filename: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escape = (value: string | number) => {
    const text = String(value ?? '')
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
    return text
  }
  const csv = [headers.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join(
    '\n',
  )
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function percentage(part: number, total: number): number {
  if (!total) return 0
  return Math.round((part / total) * 100)
}
