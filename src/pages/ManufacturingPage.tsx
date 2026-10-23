import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Factory,
  History,
  Plus,
  RefreshCw,
  Trash2,
  Truck,
} from 'lucide-react'
import type { ManufacturingJob, MfgStage, MfgStatus } from '@/types'
import { MFG_STAGES } from '@/types'
import { PageHeader, EmptyState, SearchInput, Toolbar, ProgressBar, DataRow } from '@/components/ui/Layout'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/Form'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { advanceManufacturing, createManufacturingJob, pushActivity } from '@/lib/workflow'
import { customerName } from '@/lib/calc'
import { addDaysISO, cn, downloadCSV, formatDate, formatDateTime, formatNumber, todayISO } from '@/lib/utils'

const STATUSES: MfgStatus[] = ['Pending', 'In Progress', 'Completed', 'Delayed']

/** Structured reasons offered when a job is marked Delayed. */
const DELAY_REASONS = [
  'Material shortage',
  'Machine breakdown',
  'Outsourced job delay',
  'Labour shortage',
  'Quality hold',
  'Customer approval pending',
  'Other',
]

function reasonFromValue(value?: string): { reason: string; other: string } {
  if (!value) return { reason: '', other: '' }
  if (DELAY_REASONS.includes(value)) return { reason: value, other: '' }
  return { reason: 'Other', other: value }
}

export function ManufacturingPage() {
  const { db, mutate } = useData()
  const toast = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [updateId, setUpdateId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const [updateForm, setUpdateForm] = useState<{
    stage: MfgStage
    progress: number
    status: MfgStatus
    note: string
    assignedTo: string
    delayReason: string
    delayReasonOther: string
  }>({
    stage: 'Material Procurement',
    progress: 0,
    status: 'Pending',
    note: '',
    assignedTo: '',
    delayReason: '',
    delayReasonOther: '',
  })

  const [createForm, setCreateForm] = useState(() => ({
    orderRef: '',
    productName: '',
    quantity: '1',
    assignedTo: '',
    plannedStart: todayISO(),
    plannedEnd: addDaysISO(todayISO(), 14),
    outsourced: false,
    vendor: '',
    notes: '',
  }))
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({})

  const detail = db.manufacturingJobs.find((job) => job.id === detailId) ?? null
  const updateTarget = db.manufacturingJobs.find((job) => job.id === updateId) ?? null

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return db.manufacturingJobs
      .filter((job) => {
        const matchesTerm = !term || `${job.jobNumber} ${job.orderRef} ${job.productName} ${job.assignedTo} ${job.vendor}`.toLowerCase().includes(term)
        const matchesStatus = statusFilter === 'all' || job.status === statusFilter
        const matchesStage = stageFilter === 'all' || job.stage === stageFilter
        return matchesTerm && matchesStatus && matchesStage
      })
      .sort((a, b) => (a.plannedEnd < b.plannedEnd ? -1 : 1))
  }, [db.manufacturingJobs, search, statusFilter, stageFilter])

  const stats = useMemo(() => {
    const overdue = db.manufacturingJobs.filter((job) => job.status !== 'Completed' && job.plannedEnd < todayISO())
    return {
      total: db.manufacturingJobs.length,
      active: db.manufacturingJobs.filter((job) => job.status === 'In Progress').length,
      pending: db.manufacturingJobs.filter((job) => job.status === 'Pending').length,
      delayed: db.manufacturingJobs.filter((job) => job.status === 'Delayed').length,
      completed: db.manufacturingJobs.filter((job) => job.status === 'Completed').length,
      outsourced: db.manufacturingJobs.filter((job) => job.outsourced).length,
      overdue: overdue.length,
      avgProgress: db.manufacturingJobs.length
        ? Math.round(db.manufacturingJobs.reduce((acc, job) => acc + job.progress, 0) / db.manufacturingJobs.length)
        : 0,
    }
  }, [db.manufacturingJobs])

  const openUpdate = (job: ManufacturingJob) => {
    const { reason, other } = reasonFromValue(job.delayReason)
    setUpdateId(job.id)
    setUpdateForm({
      stage: job.stage,
      progress: job.progress,
      status: job.status,
      note: '',
      assignedTo: job.assignedTo,
      delayReason: reason,
      delayReasonOther: other,
    })
  }

  const submitUpdate = () => {
    if (!updateId) return
    const delayReason =
      updateForm.delayReason === 'Other' ? updateForm.delayReasonOther.trim() : updateForm.delayReason.trim()
    if (updateForm.status === 'Delayed' && !delayReason) {
      toast.error('Select a delay reason (or enter one) before saving.')
      return
    }
    const result = mutate((draft) =>
      advanceManufacturing(draft, updateId, {
        stage: updateForm.stage,
        progress: updateForm.progress,
        status: updateForm.status,
        note: updateForm.note,
        assignedTo: updateForm.assignedTo,
        delayReason,
      }),
    )
    if (!result.ok) {
      toast.error(result.error ?? 'Could not update the job.')
      return
    }
    toast.success(
      updateForm.status === 'Completed'
        ? 'Production job completed. A packaging job was created automatically.'
        : 'Production job updated.',
    )
    setUpdateId(null)
  }

  const submitCreate = () => {
    const next: Record<string, string> = {}
    if (!createForm.orderRef.trim()) next.orderRef = 'Enter or select an order reference.'
    if (!createForm.productName.trim()) next.productName = 'Product name is required.'
    if (Number(createForm.quantity) <= 0) next.quantity = 'Quantity must be greater than zero.'
    if (createForm.plannedEnd < createForm.plannedStart) next.plannedEnd = 'Planned end cannot be before the start date.'
    if (createForm.outsourced && !createForm.vendor.trim()) next.vendor = 'Enter the job-work vendor name.'
    setCreateErrors(next)
    if (Object.keys(next).length > 0) return

    mutate((draft) => {
      createManufacturingJob(draft, {
        orderRef: createForm.orderRef.trim(),
        productName: createForm.productName.trim(),
        quantity: Number(createForm.quantity),
        assignedTo: createForm.assignedTo.trim(),
        plannedStart: createForm.plannedStart,
        plannedEnd: createForm.plannedEnd,
        outsourced: createForm.outsourced,
        vendor: createForm.vendor.trim(),
        notes: createForm.notes.trim(),
      })
    })
    toast.success('Production job created.')
    setCreateOpen(false)
  }

  const confirmDelete = () => {
    if (!deleteId) return
    mutate((draft) => {
      const job = draft.manufacturingJobs.find((item) => item.id === deleteId)
      draft.manufacturingJobs = draft.manufacturingJobs.filter((item) => item.id !== deleteId)
      draft.packagingJobs = draft.packagingJobs.filter((item) => item.productionJobId !== deleteId)
      if (job) pushActivity(draft, 'Manufacturing', `Production job ${job.jobNumber} deleted`)
    })
    toast.success('Production job deleted.')
    setDeleteId(null)
    setDetailId(null)
  }

  const orderRefs = useMemo(
    () => [...new Set([...db.invoices.map((invoice) => invoice.orderRef), ...db.quotations.map((quotation) => quotation.number)])],
    [db.invoices, db.quotations],
  )

  return (
    <>
      <PageHeader
        eyebrow="Production floor"
        icon={<Factory className="h-5 w-5" />}
        title="Manufacturing"
        description="Track production jobs through procurement, fabrication, finishing and quality check."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                downloadCSV(
                  'production-jobs.csv',
                  ['Job', 'Order ref', 'Product', 'Qty', 'Stage', 'Progress', 'Status', 'Delay reason', 'Assigned', 'Planned start', 'Planned end', 'Outsourced'],
                  filtered.map((job) => [
                    job.jobNumber,
                    job.orderRef,
                    job.productName,
                    job.quantity,
                    job.stage,
                    `${job.progress}%`,
                    job.status,
                    job.delayReason ?? '',
                    job.assignedTo,
                    job.plannedStart,
                    job.plannedEnd,
                    job.outsourced ? job.vendor || 'Yes' : 'No',
                  ]),
                )
                toast.success('Production jobs exported as CSV.')
              }}
            >
              Export CSV
            </Button>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => { setCreateErrors({}); setCreateOpen(true) }}>
              New production job
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total jobs" value={stats.total} hint={`${stats.outsourced} outsourced to job work`} icon={<Factory className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="In progress" value={stats.active} hint={`${stats.pending} pending · avg ${stats.avgProgress}% complete`} icon={<RefreshCw className="h-4.5 w-4.5" />} tone="violet" />
        <StatCard label="Delayed / overdue" value={stats.delayed + stats.overdue} hint={`${stats.overdue} past planned end date`} icon={<AlertTriangle className="h-4.5 w-4.5" />} tone={stats.delayed + stats.overdue > 0 ? 'rose' : 'emerald'} />
        <StatCard label="Completed" value={stats.completed} hint="Moved to packaging" icon={<CheckCircle2 className="h-4.5 w-4.5" />} tone="emerald" />
      </div>

      <Card>
        <Toolbar className="justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search job, order ref or product…" className="w-full sm:w-72" />
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full sm:w-40">
              <option value="all">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
            <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="w-full sm:w-48">
              <option value="all">All stages</option>
              {MFG_STAGES.map((stage) => (
                <option key={stage}>{stage}</option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-silver-600">
            {filtered.length} of {db.manufacturingJobs.length} jobs
          </p>
        </Toolbar>
      </Card>

      <TableShell>
        <Table className="min-w-[1000px]">
          <THead>
            <TR>
              <Th>Job / order</Th>
              <Th>Product</Th>
              <Th align="right">Qty</Th>
              <Th>Stage</Th>
              <Th className="w-40">Progress</Th>
              <Th>Assigned</Th>
              <Th>Planned end</Th>
              <Th>Status</Th>
              <Th align="right">Actions</Th>
            </TR>
          </THead>
          <TBody>
            {filtered.length === 0 ? (
              <TableEmptyRow colSpan={9}>No production jobs match your filters.</TableEmptyRow>
            ) : (
              filtered.map((job) => {
                const overdue = job.status !== 'Completed' && job.plannedEnd < todayISO()
                return (
                  <TR key={job.id} onClick={() => setDetailId(job.id)}>
                    <Td>
                      <p className="font-semibold text-navy-900">{job.jobNumber}</p>
                      <p className="text-xs text-silver-600">{job.orderRef}</p>
                    </Td>
                    <Td>
                      <p className="font-medium text-navy-900">{job.productName}</p>
                      {job.outsourced ? <Badge tone="purple">Outsourced · {job.vendor || 'vendor'}</Badge> : null}
                    </Td>
                    <Td align="right">{formatNumber(job.quantity)}</Td>
                    <Td>
                      <Badge tone="silver">{job.stage}</Badge>
                    </Td>
                    <Td>
                      <ProgressBar value={job.progress} tone={job.progress >= 100 ? 'emerald' : overdue ? 'rose' : 'blue'} />
                      <p className="mt-1 text-[11px] text-silver-600">{job.progress}%</p>
                    </Td>
                    <Td className="text-silver-600">{job.assignedTo || '—'}</Td>
                    <Td className="whitespace-nowrap">
                      <span className={cn(overdue && 'font-semibold text-rose-600')}>{formatDate(job.plannedEnd)}</span>
                      {overdue ? <p className="text-[11px] text-rose-500">Overdue</p> : null}
                    </Td>
                    <Td>
                      <StatusBadge status={job.status} />
                      {job.delayReason ? (
                        <p className="mt-1 max-w-[180px] text-[11px] leading-snug text-rose-600">
                          {job.delayReason}
                          {job.delayedAtStage ? ` · ${job.delayedAtStage}` : ''}
                        </p>
                      ) : null}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => openUpdate(job)} disabled={job.status === 'Completed'}>
                          Update
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
        open={Boolean(updateTarget)}
        onClose={() => setUpdateId(null)}
        title={updateTarget ? `Update ${updateTarget.jobNumber}` : ''}
        subtitle={updateTarget ? `${updateTarget.productName} · ${formatNumber(updateTarget.quantity)} units` : ''}
        footer={
          <>
            <Button variant="outline" onClick={() => setUpdateId(null)}>
              Cancel
            </Button>
            <Button onClick={submitUpdate} icon={<RefreshCw className="h-4 w-4" />}>
              Save stage update
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-silver-200 bg-silver-50 p-2">
            {MFG_STAGES.map((stage, index) => {
              const activeIndex = MFG_STAGES.indexOf(updateForm.stage)
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setUpdateForm({ ...updateForm, stage, progress: Math.max(updateForm.progress, Math.round(((index + 1) / MFG_STAGES.length) * 100) - 12) })}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
                    index < activeIndex
                      ? 'bg-emerald-100 text-emerald-700'
                      : index === activeIndex
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-surface text-silver-600 hover:text-navy-800',
                  )}
                >
                  {stage}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Current stage">
              <Select value={updateForm.stage} onChange={(event) => setUpdateForm({ ...updateForm, stage: event.target.value as MfgStage })}>
                {MFG_STAGES.map((stage) => (
                  <option key={stage}>{stage}</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={updateForm.status} onChange={(event) => setUpdateForm({ ...updateForm, status: event.target.value as MfgStatus })}>
                {STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </Select>
            </Field>
          </div>

          {updateForm.status === 'Delayed' ? (
            <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
              <Field label="Delay reason" required hint="Recorded in the stage history and shown on the order">
                <Select
                  value={updateForm.delayReason}
                  onChange={(event) => setUpdateForm({ ...updateForm, delayReason: event.target.value })}
                >
                  <option value="">Select a reason…</option>
                  {DELAY_REASONS.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                </Select>
              </Field>
              {updateForm.delayReason === 'Other' ? (
                <Field label="Specify reason">
                  <Input
                    value={updateForm.delayReasonOther}
                    onChange={(event) => setUpdateForm({ ...updateForm, delayReasonOther: event.target.value })}
                    placeholder="e.g. Power outage at the vendor"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}

          <Field label={`Progress · ${updateForm.progress}%`}>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={updateForm.progress}
              onChange={(event) => setUpdateForm({ ...updateForm, progress: Number(event.target.value) })}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-silver-200 accent-blue-600"
            />
          </Field>

          <Field label="Assigned to">
            <Input value={updateForm.assignedTo} onChange={(event) => setUpdateForm({ ...updateForm, assignedTo: event.target.value })} placeholder="Artisan / supervisor name" />
          </Field>

          <Field label="Note" hint="Added to the job history timeline">
            <Textarea value={updateForm.note} onChange={(event) => setUpdateForm({ ...updateForm, note: event.target.value })} placeholder="What changed in this update?" />
          </Field>

          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            <Truck className="mt-0.5 h-3.5 w-3.5" />
            Marking the job as Completed automatically creates a packaging job for the same order reference.
          </div>
        </div>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New production job"
        subtitle="Link the job to an order reference so it can be tracked end to end."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate}>Create job</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Order reference" required error={createErrors.orderRef}>
            <Input
              list="order-refs"
              value={createForm.orderRef}
              onChange={(event) => setCreateForm({ ...createForm, orderRef: event.target.value })}
              invalid={Boolean(createErrors.orderRef)}
              placeholder="QT-2026-0003"
            />
            <datalist id="order-refs">
              {orderRefs.map((ref) => (
                <option key={ref} value={ref} />
              ))}
            </datalist>
          </Field>
          <Field label="Product" required error={createErrors.productName}>
            <Input value={createForm.productName} onChange={(event) => setCreateForm({ ...createForm, productName: event.target.value })} invalid={Boolean(createErrors.productName)} placeholder="Silver Idol · Lakshmi 4 inch" />
          </Field>
          <Field label="Quantity" required error={createErrors.quantity}>
            <Input type="number" min={1} value={createForm.quantity} onChange={(event) => setCreateForm({ ...createForm, quantity: event.target.value })} invalid={Boolean(createErrors.quantity)} />
          </Field>
          <Field label="Assigned to">
            <Input value={createForm.assignedTo} onChange={(event) => setCreateForm({ ...createForm, assignedTo: event.target.value })} placeholder="Artisan / supervisor" />
          </Field>
          <Field label="Planned start">
            <Input type="date" value={createForm.plannedStart} onChange={(event) => setCreateForm({ ...createForm, plannedStart: event.target.value })} />
          </Field>
          <Field label="Planned end" error={createErrors.plannedEnd}>
            <Input type="date" value={createForm.plannedEnd} onChange={(event) => setCreateForm({ ...createForm, plannedEnd: event.target.value })} invalid={Boolean(createErrors.plannedEnd)} />
          </Field>
          <div className="sm:col-span-2 flex flex-col gap-3">
            <Checkbox
              label="This job is outsourced (job work)"
              checked={createForm.outsourced}
              onChange={(event) => setCreateForm({ ...createForm, outsourced: event.target.checked })}
            />
            {createForm.outsourced ? (
              <Field label="Job work vendor" error={createErrors.vendor}>
                <Input value={createForm.vendor} onChange={(event) => setCreateForm({ ...createForm, vendor: event.target.value })} invalid={Boolean(createErrors.vendor)} placeholder="e.g. Deccan Craft Works" />
              </Field>
            ) : null}
          </div>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={createForm.notes} onChange={(event) => setCreateForm({ ...createForm, notes: event.target.value })} placeholder="Design reference, finishing instructions…" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        size="lg"
        title={detail ? `${detail.jobNumber} · ${detail.productName}` : ''}
        subtitle={detail ? `Order ${detail.orderRef} · ${formatNumber(detail.quantity)} units` : ''}
        footer={
          detail ? (
            <>
              <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteId(detail.id)}>
                Delete
              </Button>
              <div className="ml-auto">
                <Button size="sm" onClick={() => { setDetailId(null); openUpdate(detail) }} disabled={detail.status === 'Completed'}>
                  Update stage
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
              <Badge tone="silver">{detail.stage}</Badge>
              {detail.outsourced ? <Badge tone="purple">Outsourced · {detail.vendor || 'vendor'}</Badge> : <Badge tone="info">In-house</Badge>}
            </div>

            {detail.delayReason ? (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold">
                    Delayed{detail.delayedAtStage ? ` at ${detail.delayedAtStage}` : ''}
                  </p>
                  <p className="mt-0.5 text-[13px]">Reason: {detail.delayReason}</p>
                </div>
              </div>
            ) : null}

            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-navy-800">Overall progress</span>
                <span className="text-silver-600">{detail.progress}%</span>
              </div>
              <ProgressBar value={detail.progress} tone={detail.progress >= 100 ? 'emerald' : 'blue'} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="divide-y divide-silver-200">
                <DataRow label="Customer" value={detail.customerId ? customerName(db, detail.customerId) : '—'} />
                <DataRow label="Order reference" value={detail.orderRef} />
                <DataRow label="Quantity" value={formatNumber(detail.quantity)} />
                <DataRow label="Assigned to" value={detail.assignedTo || '—'} />
              </div>
              <div className="divide-y divide-silver-200">
                <DataRow label="Planned start" value={formatDate(detail.plannedStart)} />
                <DataRow label="Planned end" value={formatDate(detail.plannedEnd)} />
                <DataRow label="Completed on" value={detail.completedAt ? formatDate(detail.completedAt) : '—'} />
                <DataRow label="Created" value={formatDate(detail.createdAt)} />
              </div>
            </div>

            {detail.notes ? (
              <div className="rounded-xl border border-silver-200 bg-silver-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-silver-600">Notes</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-800">{detail.notes}</p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-navy-800">
                <History className="h-3.5 w-3.5" /> Stage history
              </p>
              <ol className="relative flex flex-col gap-3 border-l border-silver-200 pl-5">
                {[...detail.history].reverse().map((entry) => (
                  <li key={entry.id} className="relative">
                    <span className="absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white bg-blue-500" />
                    <p className="text-sm font-medium text-navy-900">{entry.stage}</p>
                    <p className="text-xs text-silver-600">{entry.note}</p>
                    <p className="text-[11px] text-silver-500">{formatDateTime(entry.at)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete production job"
        message="The production job and any packaging job created from it will be removed."
        confirmLabel="Delete job"
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />

      {db.manufacturingJobs.length === 0 ? (
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="No production jobs"
          description="Confirm an order from the Invoice module to auto-generate production jobs, or create one manually."
        />
      ) : null}
    </>
  )
}
