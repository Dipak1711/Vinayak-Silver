import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Boxes, CheckCircle2, Clock, Plus, RefreshCw, Users } from 'lucide-react'
import type { MfgStage, MfgStatus } from '@/types'
import { MFG_STAGES } from '@/types'
import { PageHeader, EmptyState, ProgressBar, SearchInput, Toolbar } from '@/components/ui/Layout'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Checkbox, Field, Input, Select } from '@/components/ui/Form'
import { Modal } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { TBody, THead, Td, Th, TR, Table, TableEmptyRow, TableShell } from '@/components/ui/Table'
import { FlowStrip } from '@/components/FlowStrip'
import { NewJobModal } from '@/components/NewJobModal'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { updateJobStage } from '@/lib/workflow'
import { customerName } from '@/lib/calc'
import {
  CORE_STAGES,
  DELAY_REASONS,
  LOSS_REASONS,
  STAGE_INFO,
  jobStages,
  reasonFromValue,
  receivedQuantity,
  stageFromSlug,
  stagePath,
  stageQueues,
  type StageEntry,
} from '@/lib/manufacturing'
import { STAGE_ICONS } from '@/lib/flow'
import { cn, formatDate, formatNumber, todayISO } from '@/lib/utils'

const STATUSES: MfgStatus[] = ['Pending', 'In Progress', 'Completed', 'Delayed']

export function StageWorkPage() {
  const { slug } = useParams()
  const stage = stageFromSlug(slug)
  if (!stage) return <Navigate to="/manufacturing" replace />
  return <StageWork key={stage} stage={stage} />
}

function StageWork({ stage }: { stage: MfgStage }) {
  const { db, mutate } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const Icon = STAGE_ICONS[stage]
  const core = CORE_STAGES.includes(stage)
  const step = (core ? CORE_STAGES : MFG_STAGES).indexOf(stage) + 1

  const [search, setSearch] = useState('')
  const [newJobOpen, setNewJobOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    status: 'Pending' as MfgStatus,
    done: '0',
    rejected: '0',
    lossReason: '',
    handledBy: '',
    remarks: '',
    delayReason: '',
    delayReasonOther: '',
    notRequired: false,
  })

  const { ready, upcoming, done } = useMemo(() => stageQueues(db.manufacturingJobs, stage), [db.manufacturingJobs, stage])

  const matches = (entry: StageEntry) => {
    const term = search.trim().toLowerCase()
    if (!term) return true
    const { job } = entry
    return `${job.jobNumber} ${job.orderRef} ${job.productName} ${customerName(db, job.customerId)} ${entry.stage.assignedTo}`
      .toLowerCase()
      .includes(term)
  }
  const queue = ready.filter(matches).sort((a, b) => (a.job.plannedEnd < b.job.plannedEnd ? -1 : 1))
  const waiting = upcoming.filter(matches)
  const recentDone = done
    .filter(matches)
    .sort((a, b) => ((b.stage.completedAt ?? '') < (a.stage.completedAt ?? '') ? -1 : 1))
    .slice(0, 6)

  const inProgress = ready.filter((entry) => entry.stage.status === 'In Progress').length
  const delayed = ready.filter((entry) => entry.stage.status === 'Delayed').length
  const unitsInQueue = ready.reduce((acc, entry) => acc + receivedQuantity(entry.job, entry.index), 0)
  const rejectedTotal = done.reduce((acc, entry) => acc + (entry.stage.rejectedQuantity ?? 0), 0)

  // The job being edited, read from live data.
  const editJob = editId ? db.manufacturingJobs.find((job) => job.id === editId) ?? null : null
  const editStages = editJob ? jobStages(editJob) : []
  const editIndex = editStages.findIndex((item) => item.stage === stage)
  const editStage = editIndex > -1 ? editStages[editIndex] : null
  const nextStage = editIndex > -1 ? editStages[editIndex + 1]?.stage ?? 'Packaging' : 'Packaging'
  const received = editJob && editIndex > -1 ? receivedQuantity(editJob, editIndex) : 0
  const doneQty = form.notRequired ? received : Math.max(0, Math.round(Number(form.done) || 0))
  const rejectedQty = form.notRequired ? 0 : Math.max(0, Math.round(Number(form.rejected) || 0))
  const remaining = Math.max(received - doneQty - rejectedQty, 0)

  const openEdit = (entry: StageEntry) => {
    const { reason, other } = reasonFromValue(entry.stage.delayReason)
    setEditId(entry.job.id)
    setForm({
      status: entry.stage.status,
      done: String(entry.stage.completedQuantity ?? 0),
      rejected: String(entry.stage.rejectedQuantity ?? 0),
      lossReason: entry.stage.lossReason ?? '',
      handledBy: entry.stage.assignedTo || entry.job.assignedTo,
      remarks: entry.stage.remarks ?? '',
      delayReason: reason,
      delayReasonOther: other,
      notRequired: false,
    })
    setError('')
  }

  /** Quantities drive the status: some done = In Progress, everything accounted for = Completed. */
  const setQuantity = (field: 'done' | 'rejected', value: string) => {
    setError('')
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (current.status === 'Delayed') return next
      const total = Math.round(Number(next.done) || 0) + Math.round(Number(next.rejected) || 0)
      if (total >= received && Number(next.done) >= 1) next.status = 'Completed'
      else if (total > 0) next.status = 'In Progress'
      else if (current.status === 'Completed') next.status = 'In Progress'
      return next
    })
  }

  const submit = () => {
    if (!editJob || !editStage) return
    const status: MfgStatus = form.notRequired ? 'Completed' : form.status
    const delayReason = form.delayReason === 'Other' ? form.delayReasonOther.trim() : form.delayReason.trim()
    if (status === 'Delayed' && !delayReason) {
      setError('Select a delay reason before saving.')
      return
    }
    const result = mutate((draft) =>
      updateJobStage(draft, editJob.id, editStage.id, {
        status,
        completedQuantity: doneQty,
        rejectedQuantity: rejectedQty,
        lossReason: form.lossReason,
        assignedTo: form.handledBy,
        vendor: editStage.vendor,
        plannedDate: editStage.plannedDate,
        remarks: form.notRequired ? 'Not required for this job' : form.remarks,
        delayReason,
      }),
    )
    if (!result.ok) {
      setError(result.error ?? 'Could not save.')
      return
    }
    toast.success(
      status === 'Completed'
        ? `${editJob.jobNumber} finished ${stage}: ${doneQty} pieces moved to ${nextStage}.`
        : `${editJob.jobNumber} saved: ${doneQty} of ${received} done.`,
    )
    setEditId(null)
  }

  const saveLabel = form.notRequired || form.status === 'Completed' ? `Complete and move to ${nextStage}` : 'Save'

  return (
    <>
      <PageHeader
        eyebrow={core ? `Production stage · ${step} of ${CORE_STAGES.length}` : 'Production stage · earlier job'}
        icon={<Icon className="h-5 w-5" />}
        title={stage}
        actions={
          <>
            {stage === 'Material Procurement' || stage === 'Cutting' ? (
              <Button variant="outline" icon={<Boxes className="h-4 w-4" />} onClick={() => navigate('/inventory')}>
                Issue raw material
              </Button>
            ) : null}
            {stage === 'Cutting' ? (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setNewJobOpen(true)}>
                New production job
              </Button>
            ) : null}
          </>
        }
      />

      <FlowStrip current={stagePath(stage)} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready to work" value={ready.length} icon={<Clock className="h-4.5 w-4.5" />} tone="amber" hint={`${formatNumber(unitsInQueue)} units in queue`} />
        <StatCard label="In progress" value={inProgress} icon={<RefreshCw className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Delayed" value={delayed} icon={<Clock className="h-4.5 w-4.5" />} tone={delayed > 0 ? 'rose' : 'navy'} />
        <StatCard
          label={`Completed at ${stage}`}
          value={done.length}
          icon={<CheckCircle2 className="h-4.5 w-4.5" />}
          tone="emerald"
          hint={rejectedTotal > 0 ? `${formatNumber(rejectedTotal)} pieces rejected here` : undefined}
        />
      </div>

      <Card>
        <Toolbar className="justify-between">
          <p className="max-w-xl text-[13px] text-silver-600">{STAGE_INFO[stage].blurb}</p>
          <SearchInput value={search} onChange={setSearch} placeholder="Search job, order, product…" className="w-full sm:w-72" />
        </Toolbar>
      </Card>

      <TableShell>
        <div className="border-b border-silver-200 px-4 py-3">
          <CardHeader title="Work queue" subtitle="Click a job to update how many pieces are done." accent="sapphire" />
        </div>
        <Table className="min-w-[760px]">
          <THead>
            <TR>
              <Th>Job / order</Th>
              <Th>Product</Th>
              <Th>Progress</Th>
              <Th>Handled by</Th>
              <Th>Planned</Th>
              <Th>Status</Th>
            </TR>
          </THead>
          <TBody>
            {queue.length === 0 ? (
              <TableEmptyRow colSpan={6}>
                {ready.length === 0 ? `Nothing is waiting at ${stage} right now.` : 'No jobs match the search.'}
              </TableEmptyRow>
            ) : (
              queue.map((entry) => {
                const { job } = entry
                const total = receivedQuantity(job, entry.index)
                const finished = entry.stage.completedQuantity ?? 0
                const overdue = (entry.stage.plannedDate ?? job.plannedEnd) < todayISO()
                return (
                  <TR key={job.id} onClick={() => openEdit(entry)}>
                    <Td>
                      <p className="font-semibold text-navy-900">{job.jobNumber}</p>
                      <p className="text-xs text-silver-600">{job.orderRef}</p>
                    </Td>
                    <Td>
                      <p className="font-medium text-navy-900">{job.productName}</p>
                      <p className="text-xs text-silver-600">{customerName(db, job.customerId)}</p>
                    </Td>
                    <Td className="w-48">
                      <p className="tnum text-[13px] font-semibold text-navy-900">
                        {formatNumber(finished)} <span className="font-normal text-silver-600">of {formatNumber(total)}</span>
                      </p>
                      <ProgressBar value={total ? (finished / total) * 100 : 0} tone="blue" className="mt-1.5" />
                    </Td>
                    <Td>
                      <p className="text-[13px]">{entry.stage.assignedTo || job.assignedTo || '—'}</p>
                      {entry.stage.vendor ? <Badge tone="gold">Job work · {entry.stage.vendor}</Badge> : null}
                    </Td>
                    <Td className={cn('whitespace-nowrap', overdue && 'font-semibold text-rose-600')}>
                      {formatDate(entry.stage.plannedDate ?? job.plannedEnd)}
                    </Td>
                    <Td>
                      <StatusBadge status={entry.stage.status} />
                      {entry.stage.status === 'Delayed' && entry.stage.delayReason ? (
                        <p className="mt-1 max-w-[160px] text-[11px] text-rose-600">{entry.stage.delayReason}</p>
                      ) : null}
                    </Td>
                  </TR>
                )
              })
            )}
          </TBody>
        </Table>
      </TableShell>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Coming up" subtitle="Jobs that will reach this stage once an earlier stage is finished" icon={<Users className="h-4 w-4" />} />
          {waiting.length === 0 ? (
            <EmptyState title="Nothing queued behind this stage" description="Jobs will appear here while an earlier stage is still in progress." />
          ) : (
            <ul className="mt-3 divide-y divide-silver-200">
              {waiting.map((entry) => (
                <li key={entry.job.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-navy-900">
                      {entry.job.jobNumber} · {entry.job.productName}
                    </p>
                    <p className="text-xs text-silver-600">{formatNumber(entry.job.quantity)} units · {entry.job.orderRef}</p>
                  </div>
                  {entry.waitingOn ? (
                    <Link
                      to={stagePath(entry.waitingOn.stage)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-[#b4501d] transition-colors hover:bg-[#fff4ec] dark:text-[#f8aa77] dark:hover:bg-white/[0.06]"
                    >
                      At {entry.waitingOn.stage}
                      <StatusBadge status={entry.waitingOn.status} />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recently completed here" subtitle="Finished at this stage and moved on" icon={<CheckCircle2 className="h-4 w-4" />} />
          {recentDone.length === 0 ? (
            <EmptyState title="Nothing completed yet" description="Finished work at this stage will be listed here." />
          ) : (
            <ul className="mt-3 divide-y divide-silver-200">
              {recentDone.map((entry) => (
                <li key={entry.job.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-navy-900">
                      {entry.job.jobNumber} · {entry.job.productName}
                    </p>
                    <p className="text-xs text-silver-600">
                      {formatNumber(entry.stage.completedQuantity ?? 0)} passed on
                      {(entry.stage.rejectedQuantity ?? 0) > 0 ? ` · ${formatNumber(entry.stage.rejectedQuantity ?? 0)} rejected` : ''}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-silver-600">
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    {entry.next?.stage ?? 'Packaging'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal
        open={Boolean(editJob && editStage)}
        onClose={() => setEditId(null)}
        title={editJob ? `${stage} · ${editJob.jobNumber}` : ''}
        subtitle={editJob ? `${editJob.productName} · ${customerName(db, editJob.customerId)}` : ''}
        footer={<Button onClick={submit}>{saveLabel}</Button>}
      >
        {editJob && editStage ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Received', value: received, tone: 'text-navy-900' },
                { label: 'Done', value: doneQty, tone: 'text-emerald-600' },
                { label: 'Remaining', value: remaining, tone: remaining > 0 ? 'text-amber-600' : 'text-emerald-600' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-silver-50 px-2 py-3 ring-1 ring-silver-200 ring-inset">
                  <p className={cn('tnum text-[22px] leading-none font-extrabold', item.tone)}>{formatNumber(item.value)}</p>
                  <p className="mt-1.5 text-[10.5px] font-bold tracking-[0.08em] text-silver-600 uppercase">{item.label}</p>
                </div>
              ))}
            </div>

            {!form.notRequired ? (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Pieces done" error={error}>
                    <Input type="number" min={0} max={received} value={form.done} onChange={(event) => setQuantity('done', event.target.value)} />
                  </Field>
                  <Field label="Status">
                    <Select
                      value={form.status}
                      onChange={(event) => {
                        setForm({ ...form, status: event.target.value as MfgStatus })
                        setError('')
                      }}
                    >
                      {STATUSES.map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Pieces rejected">
                    <Input type="number" min={0} max={received} value={form.rejected} onChange={(event) => setQuantity('rejected', event.target.value)} />
                  </Field>
                  {rejectedQty > 0 ? (
                    <Field label="Reason for rejection" required>
                      <Select
                        value={form.lossReason}
                        onChange={(event) => {
                          setForm({ ...form, lossReason: event.target.value })
                          setError('')
                        }}
                      >
                        <option value="">Select a reason…</option>
                        {LOSS_REASONS.map((reason) => (
                          <option key={reason}>{reason}</option>
                        ))}
                      </Select>
                    </Field>
                  ) : (
                    <Field label="Handled by">
                      <Input value={form.handledBy} onChange={(event) => setForm({ ...form, handledBy: event.target.value })} placeholder="Operator name" />
                    </Field>
                  )}
                  {rejectedQty > 0 ? (
                    <Field label="Handled by">
                      <Input value={form.handledBy} onChange={(event) => setForm({ ...form, handledBy: event.target.value })} placeholder="Operator name" />
                    </Field>
                  ) : null}
                  <Field label="Note" className={rejectedQty > 0 ? '' : 'sm:col-span-2'}>
                    <Input value={form.remarks} onChange={(event) => setForm({ ...form, remarks: event.target.value })} placeholder="Optional" />
                  </Field>
                </div>

                {form.status === 'Delayed' ? (
                  <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5">
                    <Field label="Delay reason" required>
                      <Select
                        value={form.delayReason}
                        onChange={(event) => {
                          setForm({ ...form, delayReason: event.target.value })
                          setError('')
                        }}
                      >
                        <option value="">Select a reason…</option>
                        {DELAY_REASONS.map((reason) => (
                          <option key={reason}>{reason}</option>
                        ))}
                      </Select>
                    </Field>
                    {form.delayReason === 'Other' ? (
                      <Field label="Specify reason">
                        <Input value={form.delayReasonOther} onChange={(event) => setForm({ ...form, delayReasonOther: event.target.value })} placeholder="e.g. Power outage" />
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : error ? (
              <p className="text-xs font-medium text-rose-600">{error}</p>
            ) : null}

            <Checkbox
              checked={form.notRequired}
              onChange={(event) => {
                setForm({ ...form, notRequired: event.target.checked })
                setError('')
              }}
              label={`${stage} is not needed for this job (pass all pieces on)`}
            />
          </div>
        ) : null}
      </Modal>

      <NewJobModal open={newJobOpen} onClose={() => setNewJobOpen(false)} />
    </>
  )
}
