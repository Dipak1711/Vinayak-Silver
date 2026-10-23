import { useMemo, useState } from 'react'
import { Check, PackageCheck, PackageOpen, Plus, Trash2, Truck } from 'lucide-react'
import type { PackagingJob } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, ProgressBar, DataRow } from '@/components/ui/Layout'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { ensurePackagingJob, markReadyForDispatch, pushActivity, updatePackaging } from '@/lib/workflow'
import { customerName, orderRefs } from '@/lib/calc'
import { cn, downloadCSV, formatDate, formatNumber, todayISO } from '@/lib/utils'

export function PackagingPage() {
  const { db, mutate } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [readyOnly, setReadyOnly] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [packId, setPackId] = useState<string | null>(null)
  const [packForm, setPackForm] = useState(() => ({
    packedQuantity: '0',
    assignedTo: '',
    packingDate: todayISO(),
    notes: '',
  }))
  const [packError, setPackError] = useState('')

  const detail = db.packagingJobs.find((job) => job.id === detailId) ?? null
  const packTarget = db.packagingJobs.find((job) => job.id === packId) ?? null

  const awaitingPackaging = useMemo(() => {
    const covered = new Set(db.packagingJobs.map((job) => job.productionJobId).filter(Boolean))
    return db.manufacturingJobs.filter((job) => job.status === 'Completed' && !covered.has(job.id))
  }, [db.packagingJobs, db.manufacturingJobs])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.packagingJobs.filter((job) => {
      const matchesTerm = !term || `${job.jobNumber} ${job.orderRef} ${job.productName} ${job.assignedTo}`.toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter
      const matchesReady = !readyOnly || job.readyForDispatch
      return matchesTerm && matchesStatus && matchesReady
    })
  }, [db.packagingJobs, search, statusFilter, readyOnly])

  const stats = useMemo(() => {
    const totalQty = db.packagingJobs.reduce((acc, job) => acc + job.quantityToPack, 0)
    const packedQty = db.packagingJobs.reduce((acc, job) => acc + job.packedQuantity, 0)
    return {
      total: db.packagingJobs.length,
      pending: db.packagingJobs.filter((job) => job.status === 'Pending').length,
      inProgress: db.packagingJobs.filter((job) => job.status === 'In Progress').length,
      ready: db.packagingJobs.filter((job) => job.readyForDispatch).length,
      units: totalQty,
      packedUnits: packedQty,
      completion: totalQty ? Math.round((packedQty / totalQty) * 100) : 0,
    }
  }, [db.packagingJobs])

  const openPack = (job: PackagingJob) => {
    setPackId(job.id)
    setPackForm({
      packedQuantity: String(job.packedQuantity),
      assignedTo: job.assignedTo,
      packingDate: job.packingDate || todayISO(),
      notes: job.notes,
    })
    setPackError('')
  }

  const submitPack = () => {
    if (!packTarget) return
    const packed = Number(packForm.packedQuantity)
    if (Number.isNaN(packed) || packed < 0) {
      setPackError('Enter a valid packed quantity.')
      return
    }
    if (packed > packTarget.quantityToPack) {
      setPackError(`Packed quantity cannot exceed ${packTarget.quantityToPack}.`)
      return
    }
    const result = mutate((draft) =>
      updatePackaging(draft, packTarget.id, {
        packedQuantity: packed,
        assignedTo: packForm.assignedTo.trim(),
        packingDate: packForm.packingDate,
        notes: packForm.notes.trim(),
        status: packTarget.status,
      }),
    )
    if (!result.ok) {
      setPackError(result.error ?? 'Could not update packing.')
      return
    }
    toast.success(
      packed >= packTarget.quantityToPack
        ? 'Packing complete. You can now mark this job ready for dispatch.'
        : 'Packing progress updated.',
    )
    setPackId(null)
  }

  const handleReady = (job: PackagingJob) => {
    const result = mutate((draft) => markReadyForDispatch(draft, job.id))
    if (!result.ok) {
      toast.error(result.error ?? 'Could not mark ready for dispatch.')
      return
    }
    toast.success(`${job.jobNumber} is ready for dispatch.`)
  }

  const createPackagingFor = (productionJobId: string) => {
    mutate((draft) => {
      const job = draft.manufacturingJobs.find((item) => item.id === productionJobId)
      if (!job) return
      ensurePackagingJob(draft, {
        orderRef: job.orderRef,
        invoiceId: job.invoiceId,
        customerId: job.customerId,
        productName: job.productName,
        quantity: job.quantity,
        productionJobId: job.id,
      })
    })
    toast.success('Packaging job created from the completed production job.')
  }

  const confirmDelete = () => {
    if (!deleteId) return
    mutate((draft) => {
      const job = draft.packagingJobs.find((item) => item.id === deleteId)
      draft.packagingJobs = draft.packagingJobs.filter((item) => item.id !== deleteId)
      if (job) pushActivity(draft, 'Packaging', `Packaging job ${job.jobNumber} deleted`)
    })
    toast.success('Packaging job deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Fulfilment"
        icon={<PackageOpen className="h-5 w-5" />}
        title="Packaging"
        actions={
          <Button
            variant="outline"
            onClick={() => {
              downloadCSV(
                'packaging.csv',
                ['Job', 'Order ref', 'Product', 'To pack', 'Packed', 'Status', 'Assigned', 'Packing date', 'Ready for dispatch'],
                filtered.map((job) => [
                  job.jobNumber,
                  job.orderRef,
                  job.productName,
                  job.quantityToPack,
                  job.packedQuantity,
                  job.status,
                  job.assignedTo,
                  job.packingDate,
                  job.readyForDispatch ? 'Yes' : 'No',
                ]),
              )
              toast.success('Packaging list exported as CSV.')
            }}
          >
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Packaging jobs" value={stats.total} hint={`${stats.units} units to pack`} icon={<PackageOpen className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Pending" value={stats.pending} hint={`${stats.inProgress} in progress`} icon={<Plus className="h-4.5 w-4.5" />} tone="amber" />
        <StatCard label="Ready for dispatch" value={stats.ready} icon={<PackageCheck className="h-4.5 w-4.5" />} tone="emerald" />
        <StatCard
          label="Packing completion"
          value={`${stats.completion}%`}
          hint={`${formatNumber(stats.packedUnits)} of ${formatNumber(stats.units)} units packed`}
          icon={<Check className="h-4.5 w-4.5" />}
          tone="violet"
        />
      </div>

      {awaitingPackaging.length > 0 ? (
        <Card>
          <CardHeader
            title="Completed production awaiting packaging"
            subtitle="These jobs finished production and need a packing record."
          />
          <ul className="mt-3 divide-y divide-silver-200">
            {awaitingPackaging.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-navy-900">
                    {job.jobNumber} · {job.productName}
                  </p>
                  <p className="text-xs text-silver-600">
                    Order {job.orderRef} · {formatNumber(job.quantity)} units · completed {formatDate(job.completedAt)}
                  </p>
                </div>
                <Button size="sm" variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => createPackagingFor(job.id)}>
                  Create packaging job
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search job, order ref or product…" className="w-full sm:w-72" />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-40">
              <option value="all">All statuses</option>
              {['Pending', 'In Progress', 'Packed'].map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-silver-300 bg-surface px-3 py-2 text-xs font-semibold text-navy-800">
              <input type="checkbox" className="h-4 w-4 rounded border-silver-300 text-blue-600" checked={readyOnly} onChange={(event) => setReadyOnly(event.target.checked)} />
              Ready for dispatch only
            </label>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.packagingJobs.length} jobs
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table className="min-w-[980px]">
          <THead>
            <TR>
              <Th>Job / order</Th>
              <Th>Product</Th>
              <Th className="w-44">Packing progress</Th>
              <Th>Assigned</Th>
              <Th>Packing date</Th>
              <Th>Status</Th>
              <Th>Dispatch</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={8}>No packaging jobs match your filters.</TableEmptyRow>
            ) : (
              filtered.map((job) => {
                const fullyPacked = job.packedQuantity >= job.quantityToPack
                return (
                  <TR key={job.id} onClick={() => setDetailId(job.id)}>
                    <Td>
                      <p className="font-semibold text-navy-900">{job.jobNumber}</p>
                      <p className="text-xs text-silver-600">{job.orderRef}</p>
                    </Td>
                    <Td>
                      <p className="font-medium text-navy-900">{job.productName}</p>
                      <p className="text-xs text-silver-600">
                        {job.productionJobId ? 'From production' : 'Ready stock item'}
                      </p>
                    </Td>
                    <Td>
                      <ProgressBar value={job.quantityToPack ? (job.packedQuantity / job.quantityToPack) * 100 : 0} tone={fullyPacked ? 'emerald' : 'blue'} />
                      <p className="mt-1 text-[11px] text-silver-600">
                        {job.packedQuantity} / {job.quantityToPack} packed
                      </p>
                    </Td>
                    <Td className="text-silver-600">{job.assignedTo || '—'}</Td>
                    <Td className="whitespace-nowrap">{job.packingDate ? formatDate(job.packingDate) : '—'}</Td>
                    <Td>
                      <StatusBadge status={job.status} />
                    </Td>
                    <Td>
                      {job.readyForDispatch ? <Badge tone="success">Ready</Badge> : <Badge tone="neutral">Not ready</Badge>}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => openPack(job)}>
                          Update packing
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Mark ready for dispatch"
                          onClick={() => handleReady(job)}
                          disabled={!fullyPacked || job.readyForDispatch}
                        >
                          <PackageCheck className="h-4 w-4 text-emerald-600" />
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
        open={Boolean(packTarget)}
        onClose={() => setPackId(null)}
        title={packTarget ? `Update packing · ${packTarget.jobNumber}` : ''}
        subtitle={packTarget ? `${packTarget.productName} · ${packTarget.quantityToPack} units to pack` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setPackId(null)}>
              Cancel
            </Button>
            <Button onClick={submitPack}>Save packing update</Button>
          </>
        }
      >
        {packTarget ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={`Packed quantity (of ${packTarget.quantityToPack})`} required error={packError}>
                <Input
                  type="number"
                  min={0}
                  max={packTarget.quantityToPack}
                  value={packForm.packedQuantity}
                  onChange={(event) => {
                    setPackForm({ ...packForm, packedQuantity: event.target.value })
                    setPackError('')
                  }}
                  invalid={Boolean(packError)}
                />
              </Field>
              <Field label="Packing date">
                <Input type="date" value={packForm.packingDate} onChange={(event) => setPackForm({ ...packForm, packingDate: event.target.value })} />
              </Field>
            </div>
            <Field label="Assigned to">
              <Input value={packForm.assignedTo} onChange={(event) => setPackForm({ ...packForm, assignedTo: event.target.value })} placeholder="Packing team member" />
            </Field>
            <Field label="Notes">
              <Textarea value={packForm.notes} onChange={(event) => setPackForm({ ...packForm, notes: event.target.value })} placeholder="Box type, inserts, branding instructions…" />
            </Field>
            {packTarget.productionJobId ? (
              <p className="rounded-lg bg-silver-50 px-3 py-2 text-xs text-silver-600">
                Linked to production job{' '}
                {db.manufacturingJobs.find((job) => job.id === packTarget.productionJobId)?.jobNumber ?? '—'}. Updates are
                blocked until that job is completed.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.jobNumber} · ${detail.productName}` : ''}
        subtitle={detail ? `Order ${detail.orderRef}` : ''}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDetailId(null); openPack(detail) }}>
                  Update packing
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleReady(detail)}
                  disabled={detail.packedQuantity < detail.quantityToPack || detail.readyForDispatch}
                >
                  Mark ready for dispatch
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
              {detail.readyForDispatch ? <Badge tone="success">Ready for dispatch</Badge> : <Badge tone="warning">Not ready</Badge>}
              {detail.productionJobId ? <Badge tone="purple">From production</Badge> : <Badge tone="silver">Ready stock</Badge>}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-navy-800">
                  {detail.packedQuantity} of {detail.quantityToPack} units packed
                </span>
                <span className="text-silver-600">
                  {detail.quantityToPack ? Math.round((detail.packedQuantity / detail.quantityToPack) * 100) : 0}%
                </span>
              </div>
              <ProgressBar value={detail.quantityToPack ? (detail.packedQuantity / detail.quantityToPack) * 100 : 0} tone={detail.packedQuantity >= detail.quantityToPack ? 'emerald' : 'blue'} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="divide-y divide-silver-200">
                <DataRow label="Customer" value={detail.customerId ? customerName(db, detail.customerId) : '—'} />
                <DataRow label="Order number" value={orderRefs(db, detail.invoiceId, detail.orderRef).orderNumber} />
                <DataRow label="Quotation" value={orderRefs(db, detail.invoiceId, detail.orderRef).quotationNumber} />
                <DataRow label="Order reference" value={detail.orderRef} />
                <DataRow label="Quantity to pack" value={formatNumber(detail.quantityToPack)} />
                <DataRow label="Packed quantity" value={formatNumber(detail.packedQuantity)} />
              </div>
              <div className="divide-y divide-silver-200">
                <DataRow label="Assigned to" value={detail.assignedTo || '—'} />
                <DataRow label="Packing date" value={detail.packingDate ? formatDate(detail.packingDate) : '—'} />
                <DataRow label="Created" value={formatDate(detail.createdAt)} />
                <DataRow label="Remaining" value={formatNumber(Math.max(detail.quantityToPack - detail.packedQuantity, 0))} />
              </div>
            </div>

            {detail.notes ? (
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-800">{detail.notes}</p>
              </div>
            ) : null}

            <div className={cn(
              'flex items-start gap-2 rounded-lg border px-4 py-3 text-xs',
              detail.readyForDispatch ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800',
            )}>
              <Truck className="mt-0.5 h-3.5 w-3.5" />
              {detail.readyForDispatch
                ? 'This job is released. Create the dispatch record from the Dispatch module.'
                : 'A job can only be marked ready for dispatch once the full quantity is packed.'}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete packaging job"
        message="This packaging record will be removed. Production jobs are not affected."
        confirmLabel="Delete job"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {db.packagingJobs.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="h-5 w-5" />}
          title="Nothing to pack yet"
          description="Packaging jobs are created when a production job completes or when an order is fulfilled from finished stock."
        />
      ) : null}
    </>
  )
}
