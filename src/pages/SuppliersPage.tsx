import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Handshake, Mail, MapPin, Pencil, Phone, Plus, Trash2, Truck, Wallet } from 'lucide-react'
import type { Supplier } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, DataRow } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Textarea } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { createSupplier, createSupplierTransaction, pushActivity } from '@/lib/workflow'
import { buildSupplierLedger, supplierOutstanding, supplierPurchased } from '@/lib/calc'
import { cn, downloadCSV, formatCurrency, formatDate, todayISO } from '@/lib/utils'

type TxMode = 'Purchase' | 'Payment'

export function SuppliersPage() {
  const { db, mutate } = useData()
  const toast = useToast()
  const location = useLocation()

  const [search, setSearch] = useState('')
  const [payableOnly, setPayableOnly] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [txSupplierId, setTxSupplierId] = useState<string | null>(null)
  const [txMode, setTxMode] = useState<TxMode>('Purchase')
  const [txForm, setTxForm] = useState(() => ({
    date: todayISO(),
    reference: '',
    description: '',
    materialName: '',
    quantity: '',
    amount: '',
  }))
  const [txError, setTxError] = useState('')

  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    gstin: '',
    materialsSupplied: '',
    paymentTerms: '30',
    notes: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const focusId = (location.state as { focusId?: string } | null)?.focusId
    if (focusId) setDetailId(focusId)
  }, [location.state])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.suppliers.filter((supplier) => {
      const matchesTerm =
        !term ||
        `${supplier.name} ${supplier.contactPerson} ${supplier.code} ${supplier.email} ${supplier.materialsSupplied.join(' ')}`
          .toLowerCase()
          .includes(term)
      const matchesPayable = !payableOnly || supplierOutstanding(db, supplier.id) > 0
      return matchesTerm && matchesPayable
    })
  }, [db, search, payableOnly])

  const detail = db.suppliers.find((supplier) => supplier.id === detailId) ?? null
  const txSupplier = db.suppliers.find((supplier) => supplier.id === txSupplierId) ?? null

  const stats = useMemo(() => {
    const purchased = db.suppliers.reduce((acc, supplier) => acc + supplierPurchased(db, supplier.id), 0)
    const payable = db.suppliers.reduce((acc, supplier) => acc + supplierOutstanding(db, supplier.id), 0)
    return {
      count: db.suppliers.length,
      purchased,
      payable,
      withPayable: db.suppliers.filter((supplier) => supplierOutstanding(db, supplier.id) > 0).length,
      materials: new Set(db.suppliers.flatMap((supplier) => supplier.materialsSupplied)).size,
    }
  }, [db])

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      gstin: '',
      materialsSupplied: '',
      paymentTerms: '30',
      notes: '',
    })
    setErrors({})
    setFormOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier)
    setForm({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      email: supplier.email,
      phone: supplier.phone,
      address: supplier.address,
      city: supplier.city,
      gstin: supplier.gstin,
      materialsSupplied: supplier.materialsSupplied.join(', '),
      paymentTerms: String(supplier.paymentTerms),
      notes: supplier.notes,
    })
    setErrors({})
    setFormOpen(true)
  }

  const submit = () => {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'Supplier name is required.'
    if (!form.contactPerson.trim()) next.contactPerson = 'Contact person is required.'
    if (!form.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (form.gstin.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(form.gstin.trim())) next.gstin = 'GSTIN must be 15 characters.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const materials = form.materialsSupplied
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (editing) {
      mutate((draft) => {
        const target = draft.suppliers.find((supplier) => supplier.id === editing.id)
        if (!target) return
        Object.assign(target, {
          name: form.name.trim(),
          contactPerson: form.contactPerson.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          gstin: form.gstin.trim().toUpperCase(),
          materialsSupplied: materials,
          paymentTerms: Number(form.paymentTerms) || 0,
          notes: form.notes.trim(),
        })
        pushActivity(draft, 'Supplier', `Supplier ${target.name} updated`)
      })
      toast.success('Supplier updated.')
    } else {
      mutate((draft) => {
        createSupplier(draft, {
          name: form.name.trim(),
          contactPerson: form.contactPerson.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          gstin: form.gstin.trim().toUpperCase(),
          materialsSupplied: materials,
          paymentTerms: Number(form.paymentTerms) || 0,
          notes: form.notes.trim(),
          createdAt: new Date().toISOString(),
        })
      })
      toast.success('Supplier added.')
    }
    setFormOpen(false)
  }

  const openTx = (supplierId: string, mode: TxMode) => {
    setTxSupplierId(supplierId)
    setTxMode(mode)
    setTxForm({
      date: new Date().toISOString().slice(0, 10),
      reference: '',
      description: mode === 'Purchase' ? 'Raw material purchase' : 'Payment to supplier',
      materialName: '',
      quantity: '',
      amount: '',
    })
    setTxError('')
  }

  const submitTx = () => {
    if (!txSupplierId) return
    const amount = Number(txForm.amount)
    if (!amount || amount <= 0) {
      setTxError('Enter an amount greater than zero.')
      return
    }
    if (txMode === 'Payment' && txSupplier) {
      const outstanding = supplierOutstanding(db, txSupplier.id)
      if (amount > outstanding + 0.001) {
        setTxError(`Payment cannot exceed the outstanding payable of ${formatCurrency(outstanding)}.`)
        return
      }
    }
    const result = mutate((draft) =>
      createSupplierTransaction(draft, {
        supplierId: txSupplierId,
        date: txForm.date,
        type: txMode,
        reference: txForm.reference.trim() || (txMode === 'Purchase' ? 'PURCHASE' : 'PAYMENT'),
        description: txForm.description.trim(),
        amount,
        materialName: txForm.materialName.trim() || undefined,
        quantity: txForm.quantity ? Number(txForm.quantity) : undefined,
      }),
    )
    if (!result.ok) {
      setTxError(result.error ?? 'Could not save the transaction.')
      return
    }
    toast.success(txMode === 'Purchase' ? 'Purchase recorded.' : 'Payment recorded.')
    setTxSupplierId(null)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    const linked = db.supplierTransactions.filter((tx) => tx.supplierId === deleteId).length
    if (linked > 0) {
      toast.error(`This supplier has ${linked} transaction(s). Remove those records first to keep payables consistent.`)
      setDeleteId(null)
      return
    }
    mutate((draft) => {
      const supplier = draft.suppliers.find((item) => item.id === deleteId)
      draft.suppliers = draft.suppliers.filter((item) => item.id !== deleteId)
      draft.rawMaterials = draft.rawMaterials.map((material) =>
        material.supplierId === deleteId ? { ...material, supplierId: undefined } : material,
      )
      if (supplier) pushActivity(draft, 'Supplier', `Supplier ${supplier.name} deleted`)
    })
    toast.success('Supplier deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        icon={<Handshake className="h-5 w-5" />}
        title="Supplier"
        description="Supplier master, purchase records and outstanding payables."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                downloadCSV(
                  'suppliers.csv',
                  ['Code', 'Supplier', 'Contact', 'Email', 'City', 'GSTIN', 'Terms', 'Purchased', 'Outstanding'],
                  filtered.map((supplier) => [
                    supplier.code,
                    supplier.name,
                    supplier.contactPerson,
                    supplier.email,
                    supplier.city,
                    supplier.gstin,
                    supplier.paymentTerms,
                    supplierPurchased(db, supplier.id),
                    supplierOutstanding(db, supplier.id),
                  ]),
                )
                toast.success('Supplier list exported as CSV.')
              }}
            >
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add supplier
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Suppliers" value={stats.count} hint={`${stats.materials} materials supplied`} icon={<Handshake className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Total purchases" value={formatCurrency(stats.purchased, true)} hint="From stored purchase records" icon={<Truck className="h-4.5 w-4.5" />} tone="violet" />
        <StatCard label="Outstanding payable" value={formatCurrency(stats.payable, true)} hint={`${stats.withPayable} suppliers due`} icon={<Wallet className="h-4.5 w-4.5" />} tone="rose" />
        <StatCard
          label="Average payment terms"
          value={`${Math.round(db.suppliers.reduce((acc, supplier) => acc + supplier.paymentTerms, 0) / Math.max(db.suppliers.length, 1))} days`}
          hint="Across all suppliers"
          icon={<MapPin className="h-4.5 w-4.5" />}
          tone="navy"
        />
      </div>

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search supplier, contact or material…" className="w-full sm:w-72" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-silver-300 bg-white px-3 py-2 text-xs font-semibold text-navy-800">
              <input type="checkbox" className="h-4 w-4 rounded border-silver-300 text-blue-600" checked={payableOnly} onChange={(event) => setPayableOnly(event.target.checked)} />
              With outstanding only
            </label>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.suppliers.length} suppliers
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table className="min-w-[1020px]">
          <THead>
            <TR>
              <Th>Code</Th>
              <Th>Supplier</Th>
              <Th>Contact</Th>
              <Th>Materials supplied</Th>
              <Th align="right">Terms</Th>
              <Th align="right">Purchased</Th>
              <Th align="right">Payable</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={8}>No suppliers match your filters.</TableEmptyRow>
            ) : (
              filtered.map((supplier) => {
                const payable = supplierOutstanding(db, supplier.id)
                return (
                  <TR key={supplier.id} onClick={() => setDetailId(supplier.id)}>
                    <Td className="font-mono text-xs text-silver-600">{supplier.code}</Td>
                    <Td>
                      <p className="font-medium text-navy-900">{supplier.name}</p>
                      <p className="text-xs text-silver-600">{supplier.city}</p>
                    </Td>
                    <Td>
                      <p className="text-navy-800">{supplier.contactPerson}</p>
                      <p className="text-xs text-silver-600">{supplier.phone}</p>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {supplier.materialsSupplied.slice(0, 2).map((material) => (
                          <Badge key={material} tone="silver">{material}</Badge>
                        ))}
                        {supplier.materialsSupplied.length > 2 ? (
                          <Badge tone="neutral">+{supplier.materialsSupplied.length - 2}</Badge>
                        ) : null}
                      </div>
                    </Td>
                    <Td align="right">{supplier.paymentTerms} d</Td>
                    <Td align="right">{formatCurrency(supplierPurchased(db, supplier.id))}</Td>
                    <Td align="right" className={payable > 0 ? 'font-semibold text-rose-600' : 'text-silver-600'}>
                      {formatCurrency(payable)}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button size="icon" variant="ghost" title="Edit" onClick={() => openEdit(supplier)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteId(supplier.id)}>
                          <Trash2 className="h-4 w-4 text-rose-500" />
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

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : 'Add supplier'}
        subtitle="Supplier details drive purchase records and payable ledgers."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>{editing ? 'Save supplier' : 'Add supplier'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Supplier name" required error={errors.name}>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Contact person" required error={errors.contactPerson}>
            <Input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} invalid={Boolean(errors.contactPerson)} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
          <Field label="City">
            <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </Field>
          <Field label="GSTIN" error={errors.gstin}>
            <Input value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.toUpperCase() })} invalid={Boolean(errors.gstin)} />
          </Field>
          <Field label="Payment terms (days)">
            <Input type="number" min={0} value={form.paymentTerms} onChange={(event) => setForm({ ...form, paymentTerms: event.target.value })} />
          </Field>
          <Field label="Materials supplied" hint="Comma separated list">
            <Input value={form.materialsSupplied} onChange={(event) => setForm({ ...form, materialsSupplied: event.target.value })} placeholder="Silver Grain 999, Silver Sheet 1mm" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Rate agreement, lead time, quality notes…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(txSupplier)}
        onClose={() => setTxSupplierId(null)}
        title={txMode === 'Purchase' ? 'Record purchase / inward' : 'Record payment'}
        subtitle={txSupplier ? `${txSupplier.name} · payable ${formatCurrency(supplierOutstanding(db, txSupplier.id))}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setTxSupplierId(null)}>
              Cancel
            </Button>
            <Button onClick={submitTx}>{txMode === 'Purchase' ? 'Save purchase' : 'Save payment'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex gap-1.5 rounded-xl border border-silver-200 bg-silver-50 p-1.5">
            {(['Purchase', 'Payment'] as TxMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  setTxMode(mode)
                  setTxError('')
                }}
                className={cn(
                  'flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  txMode === mode ? 'bg-white text-navy-900 shadow-sm' : 'text-silver-600 hover:text-navy-800',
                )}
              >
                {mode === 'Purchase' ? 'Purchase / inward' : 'Payment'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input type="date" value={txForm.date} onChange={(event) => setTxForm({ ...txForm, date: event.target.value })} />
            </Field>
            <Field label="Reference">
              <Input value={txForm.reference} onChange={(event) => setTxForm({ ...txForm, reference: event.target.value })} placeholder="PB-2026-031 / NEFT reference" />
            </Field>
          </div>

          {txMode === 'Purchase' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Material">
                <Input value={txForm.materialName} onChange={(event) => setTxForm({ ...txForm, materialName: event.target.value })} placeholder="Silver Sheet 1mm" />
              </Field>
              <Field label="Quantity">
                <Input type="number" min={0} value={txForm.quantity} onChange={(event) => setTxForm({ ...txForm, quantity: event.target.value })} />
              </Field>
            </div>
          ) : null}

          <Field label="Description">
            <Textarea value={txForm.description} onChange={(event) => setTxForm({ ...txForm, description: event.target.value })} />
          </Field>

          <Field label="Amount (₹)" required error={txError}>
            <Input
              type="number"
              min={0}
              value={txForm.amount}
              onChange={(event) => {
                setTxForm({ ...txForm, amount: event.target.value })
                setTxError('')
              }}
              invalid={Boolean(txError)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        size="xl"
        title={detail ? detail.name : ''}
        subtitle={detail ? `${detail.code} · ${detail.city} · ${detail.paymentTerms} day terms` : ''}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" icon={<Pencil className="h-4 w-4" />} onClick={() => { setDetailId(null); openEdit(detail) }}>
                  Edit
                </Button>
                <Button size="sm" variant="outline" icon={<Truck className="h-4 w-4" />} onClick={() => openTx(detail.id, 'Purchase')}>
                  Record purchase
                </Button>
                <Button size="sm" icon={<Wallet className="h-4 w-4" />} onClick={() => openTx(detail.id, 'Payment')}>
                  Record payment
                </Button>
              </div>
            </>
          ) : null
        }
      >
        {detail ? <SupplierDetail supplier={detail} /> : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete supplier"
        message="This supplier will be permanently removed. Suppliers with purchase or payment history cannot be deleted."
        confirmLabel="Delete supplier"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {db.suppliers.length === 0 ? (
        <EmptyState icon={<Handshake className="h-5 w-5" />} title="No suppliers yet" description="Add a supplier to track purchases and payables." />
      ) : null}
    </>
  )
}

function SupplierDetail({ supplier }: { supplier: Supplier }) {
  const { db } = useData()
  const transactions = db.supplierTransactions
    .filter((tx) => tx.supplierId === supplier.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const ledger = buildSupplierLedger(db, supplier.id)
  const payable = supplierOutstanding(db, supplier.id)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Total purchased</p>
          <p className="text-lg font-bold text-navy-900">{formatCurrency(supplierPurchased(db, supplier.id))}</p>
        </div>
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Outstanding payable</p>
          <p className={cn('text-lg font-bold', payable > 0 ? 'text-rose-600' : 'text-emerald-600')}>{formatCurrency(payable)}</p>
        </div>
        <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Transactions</p>
          <p className="text-lg font-bold text-navy-900">{transactions.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="divide-y divide-silver-100">
          <DataRow label="Contact person" value={supplier.contactPerson} />
          <DataRow
            label="Email"
            value={
              <a href={`mailto:${supplier.email}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Mail className="h-3.5 w-3.5" />
                {supplier.email}
              </a>
            }
          />
          <DataRow
            label="Phone"
            value={
              <a href={`tel:${supplier.phone}`} className="inline-flex items-center gap-1.5 text-blue-600 hover:underline">
                <Phone className="h-3.5 w-3.5" />
                {supplier.phone}
              </a>
            }
          />
          <DataRow label="GSTIN" value={supplier.gstin || '—'} />
        </div>
        <div className="rounded-xl border border-silver-200 bg-silver-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Materials supplied</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {supplier.materialsSupplied.length === 0 ? (
              <span className="text-sm text-silver-600">No materials listed</span>
            ) : (
              supplier.materialsSupplied.map((material) => <Badge key={material} tone="silver">{material}</Badge>)
            )}
          </div>
          {supplier.notes ? <p className="mt-3 text-xs italic text-silver-600">{supplier.notes}</p> : null}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-navy-800">Purchase & payment history</p>
        {transactions.length === 0 ? (
          <EmptyState title="No transactions" description="Record a purchase or payment to build this supplier's ledger." />
        ) : (
          <TableShell>
            <Table className="min-w-[720px]">
              <THead>
                <TR>
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Reference</Th>
                  <Th>Description</Th>
                  <Th align="right">Amount</Th>
                </TR>
              </THead>
              <TBody>
                {transactions.map((tx) => (
                  <TR key={tx.id}>
                    <Td className="whitespace-nowrap">{formatDate(tx.date)}</Td>
                    <Td><StatusBadge status={tx.type} /></Td>
                    <Td className="font-mono text-xs text-silver-600">{tx.reference}</Td>
                    <Td className="text-silver-600">{tx.description}</Td>
                    <Td align="right" className={tx.type === 'Payment' ? 'font-semibold text-emerald-600' : 'font-semibold text-navy-900'}>
                      {tx.type === 'Payment' ? '- ' : '+ '}
                      {formatCurrency(tx.amount)}
                    </Td>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableShell>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-navy-800">Supplier ledger</p>
        {ledger.length === 0 ? (
          <EmptyState title="Ledger is empty" description="Ledger entries appear once transactions are recorded." />
        ) : (
          <>
            <TableShell>
              <Table className="min-w-[720px]">
                <THead>
                  <TR>
                    <Th>Date</Th>
                    <Th>Reference</Th>
                    <Th>Description</Th>
                    <Th align="right">Debit</Th>
                    <Th align="right">Credit</Th>
                    <Th align="right">Balance</Th>
                  </TR>
                </THead>
                <TBody>
                  {ledger.map((entry) => (
                    <TR key={entry.id}>
                      <Td className="whitespace-nowrap">{formatDate(entry.date)}</Td>
                      <Td className="font-mono text-xs text-silver-600">{entry.reference}</Td>
                      <Td className="text-silver-600">{entry.description}</Td>
                      <Td align="right" className="text-emerald-600">{entry.debit ? formatCurrency(entry.debit) : '—'}</Td>
                      <Td align="right">{entry.credit ? formatCurrency(entry.credit) : '—'}</Td>
                      <Td align="right" className="font-semibold text-navy-900">{formatCurrency(entry.balance)}</Td>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableShell>
            <div className="flex flex-wrap justify-end gap-4 rounded-xl border border-silver-200 bg-silver-50 px-5 py-3 text-sm">
              <span className="text-silver-600">
                Paid <span className="font-semibold text-emerald-600">{formatCurrency(ledger.reduce((acc, e) => acc + e.debit, 0))}</span>
              </span>
              <span className="text-silver-600">
                Purchased <span className="font-semibold text-navy-900">{formatCurrency(ledger.reduce((acc, e) => acc + e.credit, 0))}</span>
              </span>
              <span className="text-silver-600">
                Closing payable <span className="font-bold text-rose-600">{formatCurrency(payable)}</span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
