import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, MapPin, PackageCheck, Plus, Trash2, Truck } from 'lucide-react'
import type { DispatchRecord, DispatchStatus } from '@/types'
import { DISPATCH_STATUSES } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, DataRow } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { createDispatch, pushActivity, updateDispatchStatus } from '@/lib/workflow'
import { customerName } from '@/lib/calc'
import { addDaysISO, cn, downloadCSV, formatDate, formatDateTime, formatNumber, todayISO } from '@/lib/utils'

export function DispatchPage() {
  const { db, mutate } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [trackId, setTrackId] = useState<string | null>(null)
  const [createFrom, setCreateFrom] = useState<string | null>(null)

  const [trackForm, setTrackForm] = useState<{ status: DispatchStatus; note: string }>({ status: 'Dispatched', note: '' })
  const [createForm, setCreateForm] = useState(() => ({
    courierName: '',
    trackingNumber: '',
    dispatchDate: todayISO(),
    expectedDelivery: addDaysISO(todayISO(), 5),
    quantity: '',
    deliveryAddress: '',
    notes: '',
  }))
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})

  const detail = db.dispatches.find((record) => record.id === detailId) ?? null
  const trackTarget = db.dispatches.find((record) => record.id === trackId) ?? null

  const readyToDispatch = useMemo(() => {
    const dispatchedOrders = new Set(db.dispatches.map((record) => record.orderRef))
    return db.packagingJobs.filter((job) => job.readyForDispatch && !dispatchedOrders.has(job.orderRef))
  }, [db.packagingJobs, db.dispatches])

  // One order can span several packed products; group them so the queue
  // reads as one shippable order rather than repeated order references.
  const readyGroups = useMemo(() => {
    const map = new Map<string, { orderRef: string; customerId?: string; jobs: typeof readyToDispatch }>()
    readyToDispatch.forEach((job) => {
      const existing = map.get(job.orderRef)
      if (existing) {
        existing.jobs.push(job)
        return
      }
      map.set(job.orderRef, { orderRef: job.orderRef, customerId: job.customerId, jobs: [job] })
    })
    return [...map.values()]
  }, [readyToDispatch])

  const createSource = db.packagingJobs.find((job) => job.id === createFrom) ?? null

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.dispatches
      .filter((record) => {
        const matchesTerm =
          !term ||
          `${record.number} ${record.orderRef} ${record.courierName} ${record.trackingNumber} ${customerName(db, record.customerId)}`
            .toLowerCase()
            .includes(term)
        const matchesStatus = statusFilter === 'all' || record.status === statusFilter
        return matchesTerm && matchesStatus
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [db, search, statusFilter])

  const stats = useMemo(() => ({
    total: db.dispatches.length,
    ready: db.dispatches.filter((record) => record.status === 'Ready to Dispatch').length + readyToDispatch.length,
    inTransit: db.dispatches.filter((record) => record.status === 'In Transit' || record.status === 'Dispatched').length,
    delivered: db.dispatches.filter((record) => record.status === 'Delivered').length,
    delayed: db.dispatches.filter((record) => record.status === 'Delayed').length,
  }), [db.dispatches, readyToDispatch.length])

  const openCreate = (packagingJobId: string) => {
    const job = db.packagingJobs.find((item) => item.id === packagingJobId)
    if (!job) return
    const customer = db.customers.find((item) => item.id === job.customerId)
    setCreateFrom(packagingJobId)
    setCreateForm({
      courierName: '',
      trackingNumber: '',
      dispatchDate: todayISO(),
      expectedDelivery: addDaysISO(todayISO(), 5),
      quantity: String(job.packedQuantity || job.quantityToPack),
      deliveryAddress: customer
        ? `${customer.address}, ${customer.city}${customer.state ? `, ${customer.state}` : ''}`
        : '',
      notes: '',
    })
    setCreateErrors({})
  }

  const submitCreate = () => {
    if (!createSource) return
    const next: Record<string, string> = {}
    if (!createForm.courierName.trim()) next.courierName = 'Courier name is required.'
    if (Number(createForm.quantity) <= 0) next.quantity = 'Quantity must be greater than zero.'
    if (!createForm.deliveryAddress.trim()) next.deliveryAddress = 'Delivery address is required.'
    setCreateErrors(next)
    if (Object.keys(next).length > 0) return

    mutate((draft) => {
      createDispatch(draft, {
        orderRef: createSource.orderRef,
        invoiceId: createSource.invoiceId,
        customerId: createSource.customerId ?? '',
        courierName: createForm.courierName.trim(),
        trackingNumber: createForm.trackingNumber.trim(),
        dispatchDate: createForm.dispatchDate,
        expectedDelivery: createForm.expectedDelivery,
        quantity: Number(createForm.quantity),
        deliveryAddress: createForm.deliveryAddress.trim(),
        notes: createForm.notes.trim(),
      })
    })
    toast.success('Dispatch record created. Update tracking as the shipment moves.')
    setCreateFrom(null)
  }

  const openTrack = (record: DispatchRecord) => {
    setTrackId(record.id)
    const nextStatus = record.status === 'Ready to Dispatch' ? 'Dispatched' : record.status
    setTrackForm({ status: nextStatus, note: '' })
  }

  const submitTrack = () => {
    if (!trackId) return
    const result = mutate((draft) => updateDispatchStatus(draft, trackId, trackForm.status, trackForm.note.trim()))
    if (!result.ok) {
      toast.error(result.error ?? 'Could not update the shipment.')
      return
    }
    toast.success(`Shipment marked ${trackForm.status}.`)
    setTrackId(null)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    mutate((draft) => {
      const record = draft.dispatches.find((item) => item.id === deleteId)
      draft.dispatches = draft.dispatches.filter((item) => item.id !== deleteId)
      if (record) pushActivity(draft, 'Dispatch', `Dispatch ${record.number} deleted`)
    })
    toast.success('Dispatch record deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Logistics"
        icon={<Truck className="h-5 w-5" />}
        title="Dispatch"
        description="Move packed orders out of the warehouse and track courier movement manually."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              downloadCSV(
                'dispatch.csv',
                ['Dispatch no', 'Order ref', 'Customer', 'Courier', 'Tracking', 'Qty', 'Dispatch date', 'ETA', 'Status'],
                filtered.map((record) => [
                  record.number,
                  record.orderRef,
                  customerName(db, record.customerId),
                  record.courierName,
                  record.trackingNumber,
                  record.quantity,
                  record.dispatchDate,
                  record.expectedDelivery,
                  record.status,
                ]),
              )
              toast.success('Dispatch register exported as CSV.')
            }}
          >
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready to dispatch" value={stats.ready} hint="Packed and waiting for pickup" icon={<PackageCheck className="h-4.5 w-4.5" />} tone="amber" />
        <StatCard label="In transit" value={stats.inTransit} hint="Dispatched but not delivered" icon={<Truck className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Delivered" value={stats.delivered} hint={`${stats.total} dispatch records in total`} icon={<CheckCircle2 className="h-4.5 w-4.5" />} tone="emerald" />
        <StatCard label="Delayed" value={stats.delayed} hint="Flagged with courier issues" icon={<AlertTriangle className="h-4.5 w-4.5" />} tone={stats.delayed > 0 ? 'rose' : 'navy'} />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Tracking is updated manually in this demo. No live courier API is connected, so courier and tracking details are
        stored exactly as entered.
      </div>

      {readyGroups.length > 0 ? (
        <Card padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-silver-200 bg-linear-to-r from-silver-50 to-surface px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-[13px] font-bold text-navy-900">
                <span className="h-3.5 w-1 rounded-full bg-linear-to-b from-amber-400 to-amber-600" aria-hidden="true" />
                Orders ready for dispatch
              </h3>
              <p className="mt-0.5 text-xs text-silver-600">
                Fully packed orders waiting for a dispatch record. One shipment is created per order.
              </p>
            </div>
            <Badge tone="warning">{readyGroups.length} waiting</Badge>
          </div>
          <ul className="divide-y divide-silver-200">
            {readyGroups.map((group) => {
              const units = group.jobs.reduce((acc, job) => acc + job.packedQuantity, 0)
              return (
                <li key={group.orderRef} className="flex flex-wrap items-start justify-between gap-4 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-bold text-navy-900">{group.orderRef}</p>
                      <Badge tone="silver">{formatNumber(units)} units</Badge>
                      {group.jobs.length > 1 ? (
                        <Badge tone="neutral">{group.jobs.length} products</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-silver-600">
                      {group.customerId ? customerName(db, group.customerId) : '—'}
                      {group.jobs[0]?.packingDate ? ` · packed ${formatDate(group.jobs[0].packingDate)}` : ''}
                    </p>
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                      {group.jobs.map((job) => (
                        <li key={job.id} className="text-xs text-navy-700">
                          <span className="text-silver-500">·</span> {job.productName}
                          <span className="text-silver-600"> — {formatNumber(job.packedQuantity)} units</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openCreate(group.jobs[0].id)}>
                    Create dispatch
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search dispatch or courier…" className="w-full sm:w-80" />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-48">
              <option value="all">All statuses</option>
              {DISPATCH_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.dispatches.length} dispatches
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table className="min-w-[1040px]">
          <THead>
            <TR>
              <Th>Dispatch</Th>
              <Th>Customer</Th>
              <Th>Courier</Th>
              <Th align="right">Qty</Th>
              <Th>Dispatch date</Th>
              <Th>Expected</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={8}>No dispatch records match your filters.</TableEmptyRow>
            ) : (
              filtered.map((record) => {
                const late = record.status !== 'Delivered' && record.expectedDelivery < todayISO()
                return (
                  <TR key={record.id} onClick={() => setDetailId(record.id)}>
                    <Td>
                      <p className="font-semibold text-navy-900">{record.number}</p>
                      <p className="text-xs text-silver-600">{record.orderRef}</p>
                    </Td>
                    <Td>{customerName(db, record.customerId)}</Td>
                    <Td>
                      <p className="text-navy-800">{record.courierName}</p>
                      <p className="font-mono text-xs text-silver-600">{record.trackingNumber || 'No tracking no.'}</p>
                    </Td>
                    <Td align="right">{formatNumber(record.quantity)}</Td>
                    <Td className="whitespace-nowrap">{record.dispatchDate ? formatDate(record.dispatchDate) : '—'}</Td>
                    <Td className="whitespace-nowrap">
                      <span className={cn(late && 'font-semibold text-rose-600')}>{formatDate(record.expectedDelivery)}</span>
                    </Td>
                    <Td>
                      <StatusBadge status={record.status} />
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => openTrack(record)} disabled={record.status === 'Delivered'}>
                          Update tracking
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
        open={Boolean(createSource)}
        onClose={() => setCreateFrom(null)}
        title="Create dispatch record"
        subtitle={createSource ? `Order ${createSource.orderRef} · ${createSource.productName}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateFrom(null)}>
              Cancel
            </Button>
            <Button onClick={submitCreate}>Create dispatch</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Courier name" required error={createErrors.courierName}>
            <Input value={createForm.courierName} onChange={(event) => setCreateForm({ ...createForm, courierName: event.target.value })} invalid={Boolean(createErrors.courierName)} placeholder="BlueDart / Delhivery / VRL" />
          </Field>
          <Field label="Tracking number">
            <Input value={createForm.trackingNumber} onChange={(event) => setCreateForm({ ...createForm, trackingNumber: event.target.value })} placeholder="AWB / Docket number" />
          </Field>
          <Field label="Dispatch date">
            <Input type="date" value={createForm.dispatchDate} onChange={(event) => setCreateForm({ ...createForm, dispatchDate: event.target.value })} />
          </Field>
          <Field label="Expected delivery">
            <Input type="date" value={createForm.expectedDelivery} onChange={(event) => setCreateForm({ ...createForm, expectedDelivery: event.target.value })} />
          </Field>
          <Field label="Quantity" required error={createErrors.quantity}>
            <Input type="number" min={1} value={createForm.quantity} onChange={(event) => setCreateForm({ ...createForm, quantity: event.target.value })} invalid={Boolean(createErrors.quantity)} />
          </Field>
          <Field label="Delivery address" required error={createErrors.deliveryAddress} className="sm:col-span-2">
            <Textarea value={createForm.deliveryAddress} onChange={(event) => setCreateForm({ ...createForm, deliveryAddress: event.target.value })} invalid={Boolean(createErrors.deliveryAddress)} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} placeholder="Carton count, packaging reference, special instructions…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(trackTarget)}
        onClose={() => setTrackId(null)}
        size="sm"
        title={trackTarget ? `Update tracking · ${trackTarget.number}` : ''}
        subtitle={trackTarget ? `${trackTarget.courierName} · ${trackTarget.trackingNumber || 'no tracking number'}` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setTrackId(null)}>
              Cancel
            </Button>
            <Button onClick={submitTrack}>Save update</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Shipment status">
            <Select value={trackForm.status} onChange={(event) => setTrackForm({ ...trackForm, status: event.target.value as DispatchStatus })}>
              {DISPATCH_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tracking note" hint="Shown on the dispatch timeline">
            <Textarea value={trackForm.note} onChange={(event) => setTrackForm({ ...trackForm, note: event.target.value })} placeholder="e.g. Reached Bengaluru hub, out for delivery tomorrow" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        size="lg"
        title={detail ? `${detail.number} · ${customerName(db, detail.customerId)}` : ''}
        subtitle={detail ? `Order ${detail.orderRef}` : ''}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto">
                <Button size="sm" onClick={() => { setDetailId(null); openTrack(detail) }} disabled={detail.status === 'Delivered'}>
                  Update tracking
                </Button>
              </div>
            </>
          ) : null
        }
      >
        {detail ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.status} />
              <Badge tone="silver">{formatNumber(detail.quantity)} units</Badge>
              {detail.status !== 'Delivered' && detail.expectedDelivery < todayISO() ? <Badge tone="danger">Past expected date</Badge> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="divide-y divide-silver-200">
                <DataRow label="Courier" value={detail.courierName || '—'} />
                <DataRow label="Tracking number" value={detail.trackingNumber || '—'} />
                <DataRow label="Dispatch date" value={detail.dispatchDate ? formatDate(detail.dispatchDate) : '—'} />
                <DataRow label="Expected delivery" value={formatDate(detail.expectedDelivery)} />
              </div>
              <div className="rounded-xl border border-silver-200 bg-silver-50 p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-silver-600">
                  <MapPin className="h-3.5 w-3.5" /> Delivery address
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-navy-800">{detail.deliveryAddress}</p>
              </div>
            </div>

            {detail.notes ? (
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-800">{detail.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-semibold text-navy-800">Tracking timeline</p>
              <ol className="relative flex flex-col gap-3 border-l border-silver-200 pl-5">
                {[...detail.events].reverse().map((event) => (
                  <li key={event.id} className="relative">
                    <span
                      className={cn(
                        'absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white',
                        event.status === 'Delivered'
                          ? 'bg-emerald-500'
                          : event.status === 'Delayed'
                            ? 'bg-rose-500'
                            : 'bg-blue-500',
                      )}
                    />
                    <p className="text-sm font-medium text-navy-900">{event.status}</p>
                    <p className="text-xs text-silver-600">{event.note}</p>
                    <p className="text-[11px] text-silver-500">{formatDateTime(event.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete dispatch record"
        message="The shipment record and its tracking timeline will be removed."
        confirmLabel="Delete dispatch"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {db.dispatches.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          title="No dispatches yet"
          description="Once packaging marks an order ready, create a dispatch record here."
        />
      ) : null}
    </>
  )
}
