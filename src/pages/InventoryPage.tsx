import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Boxes,
  Coins,
  Layers,
  Pencil,
  Plus,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react'
import type { MovementType, RawMaterial } from '@/types'
import { MATERIAL_CATEGORIES } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { SegmentedTabs } from '@/components/ui/SegmentedTabs'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { applyStockMovement, createMaterial, pushActivity } from '@/lib/workflow'
import { downloadCSV, formatCurrency, formatDate, formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'

type Tab = 'materials' | 'movements'

/** Copy for each movement, so the form only ever shows the action chosen. */
const STOCK_META: Record<
  MovementType,
  { title: string; action: string; quantityHint: string; referencePlaceholder: string; notePlaceholder: string }
> = {
  Inward: {
    title: 'Stock inward',
    action: 'Record inward',
    quantityHint: 'Adds the quantity to the current balance.',
    referencePlaceholder: 'Purchase bill / GRN number',
    notePlaceholder: 'Supplier, lot or receipt note',
  },
  Outward: {
    title: 'Stock outward',
    action: 'Record outward',
    quantityHint: 'Stock-out is blocked if it would make the balance negative.',
    referencePlaceholder: 'Job card / invoice reference',
    notePlaceholder: 'Purpose of issue',
  },
  Adjustment: {
    title: 'Stock adjustment',
    action: 'Record adjustment',
    quantityHint: 'Choose whether to add or reduce, then enter how many.',
    referencePlaceholder: 'Stock count reference',
    notePlaceholder: 'Why the count changed',
  },
}

/** Specific reasons per action, so the store keeper picks instead of typing. */
const STOCK_REASONS: Record<MovementType, string[]> = {
  Inward: ['Purchase from supplier', 'Returned from production', 'Customer return', 'Opening stock', 'Other'],
  Outward: ['Issued to production', 'Sent for job work', 'Sold / dispatched', 'Damaged / wastage', 'Other'],
  Adjustment: ['Stock count correction', 'Damaged / wastage', 'Found extra stock', 'Lost / shortage', 'Other'],
}

export function InventoryPage() {
  const { db, mutate } = useData()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('materials')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [movementTypeFilter, setMovementTypeFilter] = useState('all')
  const [lowOnly, setLowOnly] = useState(false)

  const [materialFormOpen, setMaterialFormOpen] = useState(false)
  const [editing, setEditing] = useState<RawMaterial | null>(null)
  const [materialForm, setMaterialForm] = useState({
    sku: '',
    name: '',
    category: 'Silver',
    unit: 'Kg',
    quantity: '',
    cost: '',
    minStock: '',
    location: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [stockTarget, setStockTarget] = useState<RawMaterial | null>(null)
  const [stockType, setStockType] = useState<MovementType>('Inward')
  const [stockForm, setStockForm] = useState({ quantity: '', direction: 'add' as 'add' | 'reduce', reason: '', reference: '', note: '', createdBy: 'Store Keeper' })
  const [stockError, setStockError] = useState('')

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.rawMaterials.filter((material) => {
      const matchesTerm = !term || `${material.name} ${material.sku} ${material.location}`.toLowerCase().includes(term)
      const matchesCategory = categoryFilter === 'all' || material.category === categoryFilter
      const matchesLow = !lowOnly || material.quantity <= material.minStock
      return matchesTerm && matchesCategory && matchesLow
    })
  }, [db.rawMaterials, search, categoryFilter, lowOnly])

  const filteredMovements = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.stockMovements
      .filter((movement) => {
        const matchesTerm = !term || `${movement.materialName} ${movement.reference} ${movement.note}`.toLowerCase().includes(term)
        const matchesType = movementTypeFilter === 'all' || movement.type === movementTypeFilter
        return matchesTerm && matchesType
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1))
  }, [db.stockMovements, search, movementTypeFilter])

  const stats = useMemo(() => {
    const value = db.rawMaterials.reduce((acc, material) => acc + material.quantity * material.cost, 0)
    const low = db.rawMaterials.filter((material) => material.quantity <= material.minStock)
    return {
      count: db.rawMaterials.length,
      value,
      lowCount: low.length,
      lowValue: low.reduce((acc, material) => acc + material.quantity * material.cost, 0),
      movements: db.stockMovements.length,
      categories: new Set(db.rawMaterials.map((material) => material.category)).size,
    }
  }, [db.rawMaterials, db.stockMovements])

  const openCreate = () => {
    setEditing(null)
    setMaterialForm({ sku: '', name: '', category: 'Silver', unit: 'Kg', quantity: '', cost: '', minStock: '', location: '' })
    setFormErrors({})
    setMaterialFormOpen(true)
  }

  const openEdit = (material: RawMaterial) => {
    setEditing(material)
    setMaterialForm({
      sku: material.sku,
      name: material.name,
      category: material.category,
      unit: material.unit,
      quantity: String(material.quantity),
      cost: String(material.cost),
      minStock: String(material.minStock),
      location: material.location,
    })
    setFormErrors({})
    setMaterialFormOpen(true)
  }

  const submitMaterial = () => {
    const next: Record<string, string> = {}
    if (!materialForm.name.trim()) next.name = 'Material name is required.'
    if (!materialForm.unit.trim()) next.unit = 'Unit is required.'
    if (materialForm.cost === '' || Number(materialForm.cost) < 0) next.cost = 'Enter a valid cost.'
    if (materialForm.minStock === '' || Number(materialForm.minStock) < 0) next.minStock = 'Enter a valid minimum level.'
    if (materialForm.quantity !== '' && Number(materialForm.quantity) < 0) next.quantity = 'Quantity cannot be negative.'
    setFormErrors(next)
    if (Object.keys(next).length > 0) return

    if (editing) {
      mutate((draft) => {
        const target = draft.rawMaterials.find((material) => material.id === editing.id)
        if (!target) return
        const previousQty = target.quantity
        Object.assign(target, {
          sku: materialForm.sku.trim() || target.sku,
          name: materialForm.name.trim(),
          category: materialForm.category as RawMaterial['category'],
          unit: materialForm.unit.trim(),
          quantity: Number(materialForm.quantity) || 0,
          cost: Number(materialForm.cost) || 0,
          minStock: Number(materialForm.minStock) || 0,
          location: materialForm.location.trim(),
        })
        if (previousQty !== target.quantity) {
          draft.stockMovements.unshift({
            id: `sm_${Date.now().toString(36)}`,
            materialId: target.id,
            materialName: target.name,
            type: 'Adjustment',
            quantity: Math.abs(target.quantity - previousQty),
            balanceAfter: target.quantity,
            reference: 'MASTER-EDIT',
            note: 'Opening quantity corrected from material master',
            date: new Date().toISOString().slice(0, 10),
            createdBy: 'Store Manager',
          })
        }
        pushActivity(draft, 'Inventory', `Raw material ${target.name} updated`)
      })
      toast.success('Material updated.')
    } else {
      mutate((draft) => {
        createMaterial(draft, {
          sku: materialForm.sku.trim(),
          name: materialForm.name.trim(),
          category: materialForm.category as RawMaterial['category'],
          unit: materialForm.unit.trim(),
          quantity: Number(materialForm.quantity) || 0,
          cost: Number(materialForm.cost) || 0,
          minStock: Number(materialForm.minStock) || 0,
          location: materialForm.location.trim(),
        })
      })
      toast.success('Material added to inventory.')
    }
    setMaterialFormOpen(false)
  }

  const openStock = (material: RawMaterial, type: MovementType) => {
    setStockTarget(material)
    setStockType(type)
    setStockForm({
      quantity: '',
      direction: 'add',
      reason: STOCK_REASONS[type][0],
      reference: '',
      note: '',
      createdBy: 'Store Keeper',
    })
    setStockError('')
  }

  const submitStock = () => {
    if (!stockTarget) return
    const quantity = Number(stockForm.quantity)
    if (stockForm.quantity === '' || Number.isNaN(quantity)) {
      setStockError('Enter a quantity.')
      return
    }
    if (quantity <= 0) {
      setStockError('Enter a quantity greater than zero.')
      return
    }
    if (stockForm.reason === 'Other' && !stockForm.note.trim()) {
      setStockError('Please describe the reason in the note.')
      return
    }
    const signed = stockForm.direction === 'reduce' ? -quantity : quantity
    const noteText = [stockForm.reason === 'Other' ? '' : stockForm.reason, stockForm.note.trim()].filter(Boolean).join(' — ')
    const result = mutate((draft) =>
      applyStockMovement(
        draft,
        stockTarget.id,
        stockType,
        quantity,
        stockForm.reference.trim(),
        noteText,
        stockForm.createdBy,
        stockType === 'Adjustment' ? signed : undefined,
      ),
    )
    if (!result.ok) {
      setStockError(result.error)
      return
    }
    toast.success(
      `${stockType} recorded. New balance for ${stockTarget.name} is ${result.balance} ${stockTarget.unit}.`,
    )
    setStockTarget(null)
  }

  const exportCSV = () => {
    if (tab === 'materials') {
      downloadCSV(
        'raw-inventory.csv',
        ['SKU', 'Material', 'Category', 'Unit', 'Quantity', 'Cost', 'Value', 'Min stock', 'Location', 'Status'],
        filteredMaterials.map((material) => [
          material.sku,
          material.name,
          material.category,
          material.unit,
          material.quantity,
          material.cost,
          material.quantity * material.cost,
          material.minStock,
          material.location,
          material.quantity <= material.minStock ? 'Low stock' : 'OK',
        ]),
      )
    } else {
      downloadCSV(
        'stock-movements.csv',
        ['Date', 'Material', 'Type', 'Quantity', 'Balance after', 'Reference', 'Note', 'By'],
        filteredMovements.map((movement) => [
          movement.date,
          movement.materialName,
          movement.type,
          movement.quantity,
          movement.balanceAfter,
          movement.reference,
          movement.note,
          movement.createdBy,
        ]),
      )
    }
    toast.success('Inventory data exported as CSV.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Stock & materials"
        icon={<Boxes className="h-5 w-5" />}
        title="Raw Inventory"
        actions={
          <>
            <Button variant="outline" onClick={exportCSV}>
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add material
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Raw materials" value={stats.count} hint={`${stats.categories} categories`} icon={<Layers className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Stock value" value={0} numericValue={stats.value} format={(v) => formatCurrency(v, true)} icon={<Wallet className="h-4.5 w-4.5" />} tone="navy" />
        <StatCard
          label="Low stock items"
          value={stats.lowCount}
          hint={stats.lowCount > 0 ? `${formatCurrency(stats.lowValue, true)} at risk` : 'All levels healthy'}
          icon={<AlertTriangle className="h-4.5 w-4.5" />}
          tone={stats.lowCount > 0 ? 'rose' : 'emerald'}
        />
        <StatCard label="Stock movements" value={stats.movements} icon={<Coins className="h-4.5 w-4.5" />} tone="violet" />
      </div>

      <SegmentedTabs
        className="self-start"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'materials', label: 'Materials', count: stats.count },
          { value: 'movements', label: 'Movement history', count: stats.movements },
        ]}
      />

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={tab === 'materials' ? 'Search material, SKU or location…' : 'Search movement, reference or note…'}
              className="w-full sm:w-72"
            />
            {tab === 'materials' ? (
              <>
                <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-full sm:w-44">
                  <option value="all">All categories</option>
                  {MATERIAL_CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </Select>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-silver-300 bg-surface px-3 py-2 text-xs font-semibold text-navy-800">
                  <input type="checkbox" className="h-4 w-4 rounded border-silver-300 text-blue-600" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} />
                  Low stock only
                </label>
              </>
            ) : (
              <Select value={movementTypeFilter} onChange={(event) => setMovementTypeFilter(event.target.value)} className="w-full sm:w-44">
                <option value="all">All movement types</option>
                {['Inward', 'Outward', 'Adjustment'].map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </Select>
            )}
          </div>
        </Toolbar>
      </Card>

      {tab === 'materials' ? (
        <TableShell key="materials" className="tab-swap">
          <Table>
            <THead>
              <TR>
                <Th>SKU</Th>
                <Th>Material</Th>
                <Th>Category</Th>
                <Th align="right">On hand</Th>
                <Th align="right">Unit cost</Th>
                <Th align="right">Value</Th>
                <Th align="right">Min level</Th>
                <Th>Status</Th>
                <Th align="right">Actions</Th>
              </TR>
            </THead>
            <TBody>
              {filteredMaterials.length === 0 ? (
                <TableEmptyRow colSpan={9}>No materials match your filters.</TableEmptyRow>
              ) : (
                filteredMaterials.map((material) => {
                  const low = material.quantity <= material.minStock
                  return (
                    <TR key={material.id}>
                      <Td className="font-mono text-xs text-silver-600">{material.sku}</Td>
                      <Td>
                        <p className="font-medium text-navy-900">{material.name}</p>
                        <p className="text-xs text-silver-600">{material.location}</p>
                      </Td>
                      <Td>
                        <Badge tone="silver">{material.category}</Badge>
                      </Td>
                      <Td align="right" className={cn('font-semibold', low && 'text-rose-600')}>
                        {formatNumber(material.quantity)} {material.unit}
                      </Td>
                      <Td align="right">{formatCurrency(material.cost)}</Td>
                      <Td align="right">{formatCurrency(material.quantity * material.cost)}</Td>
                      <Td align="right" className="text-silver-600">
                        {formatNumber(material.minStock)} {material.unit}
                      </Td>
                      <Td>{low ? <Badge tone="danger" dot>Low stock</Badge> : <Badge tone="success" dot>In stock</Badge>}</Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="icon" variant="ghost" title="Stock inward" onClick={() => openStock(material, 'Inward')}>
                            <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Stock outward" onClick={() => openStock(material, 'Outward')}>
                            <ArrowUpFromLine className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Adjust stock" onClick={() => openStock(material, 'Adjustment')}>
                            <SlidersHorizontal className="h-4 w-4 text-violet-600" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Edit material" onClick={() => openEdit(material)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </Td>
                    </TR>
                  )
                })
              )}
            </TBody>
          </Table>
        </TableShell>
      ) : (
        <TableShell key="movements" className="tab-swap">
          <Table>
            <THead>
              <TR>
                <Th>Date</Th>
                <Th>Material</Th>
                <Th>Type</Th>
                <Th align="right">Quantity</Th>
                <Th align="right">Balance after</Th>
                <Th>Reference</Th>
                <Th>Note</Th>
                <Th>Recorded by</Th>
              </TR>
            </THead>
            <TBody>
              {filteredMovements.length === 0 ? (
                <TableEmptyRow colSpan={8}>No stock movements recorded yet.</TableEmptyRow>
              ) : (
                filteredMovements.map((movement) => (
                  <TR key={movement.id}>
                    <Td className="whitespace-nowrap">{formatDate(movement.date)}</Td>
                    <Td className="font-medium text-navy-900">{movement.materialName}</Td>
                    <Td>
                      <StatusBadge status={movement.type} />
                    </Td>
                    <Td align="right" className={movement.type === 'Outward' ? 'text-rose-600' : movement.type === 'Inward' ? 'text-emerald-600' : 'text-violet-600'}>
                      {movement.type === 'Outward' ? '-' : '+'}
                      {formatNumber(movement.quantity)}
                    </Td>
                    <Td align="right">{formatNumber(movement.balanceAfter)}</Td>
                    <Td className="font-mono text-xs text-silver-600">{movement.reference}</Td>
                    <Td className="max-w-xs truncate text-silver-600" title={movement.note}>
                      {movement.note}
                    </Td>
                    <Td className="text-silver-600">{movement.createdBy}</Td>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableShell>
      )}

      {db.rawMaterials.length === 0 ? (
        <EmptyState icon={<Boxes className="h-5 w-5" />} title="No raw materials" description="Add materials to start tracking stock." />
      ) : null}

      <Modal
        open={materialFormOpen}
        onClose={() => setMaterialFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add raw material'}
        subtitle="Materials feed into production jobs and drive low stock alerts."
        footer={
          <>
            <Button variant="outline" onClick={() => setMaterialFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitMaterial}>{editing ? 'Save material' : 'Add material'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Material name" required error={formErrors.name}>
            <Input value={materialForm.name} onChange={(event) => setMaterialForm({ ...materialForm, name: event.target.value })} invalid={Boolean(formErrors.name)} placeholder="e.g. Silver Sheet 1mm" />
          </Field>
          <Field label="SKU" hint="Leave blank to auto-generate">
            <Input value={materialForm.sku} onChange={(event) => setMaterialForm({ ...materialForm, sku: event.target.value })} placeholder="RM-SIL-010" />
          </Field>
          <Field label="Category">
            <Select value={materialForm.category} onChange={(event) => setMaterialForm({ ...materialForm, category: event.target.value })}>
              {MATERIAL_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </Select>
          </Field>
          <Field label="Unit" required error={formErrors.unit}>
            <Input value={materialForm.unit} onChange={(event) => setMaterialForm({ ...materialForm, unit: event.target.value })} invalid={Boolean(formErrors.unit)} placeholder="Kg / Pcs / Ltr" />
          </Field>
          <Field label="Quantity on hand" error={formErrors.quantity}>
            <Input type="number" min={0} value={materialForm.quantity} onChange={(event) => setMaterialForm({ ...materialForm, quantity: event.target.value })} invalid={Boolean(formErrors.quantity)} placeholder="0" />
          </Field>
          <Field label="Unit cost (₹)" required error={formErrors.cost}>
            <Input type="number" min={0} value={materialForm.cost} onChange={(event) => setMaterialForm({ ...materialForm, cost: event.target.value })} invalid={Boolean(formErrors.cost)} placeholder="0" />
          </Field>
          <Field label="Minimum stock level" required error={formErrors.minStock}>
            <Input type="number" min={0} value={materialForm.minStock} onChange={(event) => setMaterialForm({ ...materialForm, minStock: event.target.value })} invalid={Boolean(formErrors.minStock)} placeholder="0" />
          </Field>
          <Field label="Storage location">
            <Input value={materialForm.location} onChange={(event) => setMaterialForm({ ...materialForm, location: event.target.value })} placeholder="Strong Room A" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(stockTarget)}
        onClose={() => setStockTarget(null)}
        size="sm"
        title={`${STOCK_META[stockType].title} · ${stockTarget?.name ?? ''}`}
        subtitle={stockTarget ? `Current balance ${formatNumber(stockTarget.quantity)} ${stockTarget.unit}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setStockTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitStock}>{STOCK_META[stockType].action}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {stockType === 'Adjustment' ? (
            <Field label="What do you want to do?">
              <Select
                value={stockForm.direction}
                onChange={(event) => setStockForm({ ...stockForm, direction: event.target.value as 'add' | 'reduce' })}
              >
                <option value="add">Add to stock (found extra)</option>
                <option value="reduce">Reduce stock (shortage / damage)</option>
              </Select>
            </Field>
          ) : null}
          <Field
            label={stockType === 'Adjustment' ? 'Quantity to change' : `Quantity${stockTarget ? ` (${stockTarget.unit})` : ''}`}
            required
            error={stockError}
            hint={STOCK_META[stockType].quantityHint}
          >
            <Input
              type="number"
              value={stockForm.quantity}
              onChange={(event) => {
                setStockForm({ ...stockForm, quantity: event.target.value })
                setStockError('')
              }}
              invalid={Boolean(stockError)}
              placeholder="0"
            />
          </Field>
          {stockTarget && Number(stockForm.quantity) > 0 ? (
            <div className="rounded-lg border border-silver-200 bg-silver-50 px-3.5 py-2.5 text-xs text-silver-700">
              New balance will be{' '}
              <strong className="text-navy-800">
                {formatNumber(
                  stockTarget.quantity +
                    (stockType === 'Outward' || (stockType === 'Adjustment' && stockForm.direction === 'reduce') ? -1 : 1) *
                      Number(stockForm.quantity),
                )}{' '}
                {stockTarget.unit}
              </strong>
            </div>
          ) : null}
          <Field label="Reason" required>
            <Select value={stockForm.reason} onChange={(event) => setStockForm({ ...stockForm, reason: event.target.value })}>
              {STOCK_REASONS[stockType].map((reason) => (
                <option key={reason}>{reason}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" hint="Optional">
            <Input
              value={stockForm.reference}
              onChange={(event) => setStockForm({ ...stockForm, reference: event.target.value })}
              placeholder={STOCK_META[stockType].referencePlaceholder}
            />
          </Field>
          <Field label={stockForm.reason === 'Other' ? 'Note' : 'Note (optional)'} required={stockForm.reason === 'Other'}>
            <Textarea
              value={stockForm.note}
              onChange={(event) => setStockForm({ ...stockForm, note: event.target.value })}
              placeholder={STOCK_META[stockType].notePlaceholder}
            />
          </Field>
          <Field label="Recorded by">
            <Input value={stockForm.createdBy} onChange={(event) => setStockForm({ ...stockForm, createdBy: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
