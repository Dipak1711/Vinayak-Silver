import { Plus, Trash2 } from 'lucide-react'
import type { Product } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Form'
import { buildLineItem, type LineItemInput } from '@/lib/calc'
import { formatCurrency, uid } from '@/lib/utils'

export function newLineItem(defaultTaxRate = 18): LineItemInput {
  return { id: uid('li'), productId: undefined, description: '', quantity: 1, rate: 0, discount: 0, taxRate: defaultTaxRate }
}

export function LineItemEditor({
  items,
  onChange,
  products,
  defaultTaxRate,
}: {
  items: LineItemInput[]
  onChange: (items: LineItemInput[]) => void
  products: Product[]
  defaultTaxRate: number
}) {
  const update = (id: string, patch: Partial<LineItemInput>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const selectProduct = (id: string, productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) {
      update(id, { productId: undefined })
      return
    }
    update(id, {
      productId: product.id,
      description: product.name,
      rate: product.rate,
      taxRate: product.category === 'Silver Articles' || product.category === 'Pooja Items' ? 3 : defaultTaxRate,
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-silver-200">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-silver-50 text-left">
            <tr>
              <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-silver-600">Product / description</th>
              <th className="w-24 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-silver-600">Qty</th>
              <th className="w-32 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-silver-600">Rate (₹)</th>
              <th className="w-24 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-silver-600">Disc %</th>
              <th className="w-24 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-silver-600">GST %</th>
              <th className="w-32 px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-silver-600">Amount</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-silver-200">
            {items.map((item) => {
              const computed = buildLineItem(item)
              return (
                <tr key={item.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <Select
                      value={item.productId ?? ''}
                      onChange={(event) => selectProduct(item.id, event.target.value)}
                      className="mb-1.5 text-xs"
                    >
                      <option value="">Custom line item…</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} · {product.name} ({product.type})
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={item.description}
                      onChange={(event) => update(item.id, { description: event.target.value })}
                      placeholder="Item description"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity}
                      onChange={(event) => update(item.id, { quantity: Number(event.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      value={item.rate}
                      onChange={(event) => update(item.id, { rate: Number(event.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discount}
                      onChange={(event) => update(item.id, { discount: Number(event.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min={0}
                      value={item.taxRate}
                      onChange={(event) => update(item.id, { taxRate: Number(event.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <p className="pt-2 font-semibold text-navy-900">{formatCurrency(computed.total)}</p>
                    <p className="text-[11px] text-silver-600">net {formatCurrency(computed.net)}</p>
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => onChange(items.filter((row) => row.id !== item.id))}
                      disabled={items.length === 1}
                      className="rounded-lg p-1.5 text-silver-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div>
        <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...items, newLineItem(defaultTaxRate)])}>
          Add line item
        </Button>
      </div>
    </div>
  )
}
