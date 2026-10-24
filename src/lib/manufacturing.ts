import type { JobStage, ManufacturingJob, MfgStage, MfgStatus } from '@/types'
import { uid } from '@/lib/utils'

/**
 * Order-based manufacturing planning.
 *
 * A job carries its own ordered list of required stages (`job.stages`), so a
 * laser-cut gifting item can run Cutting → Laser Cutting → Quality Check while
 * a silver dinner set runs the full route. Nothing forces every order through
 * every process, and no global stage order is assumed.
 *
 * The default route below is **proposed default design**, not a client rule.
 */

/** A lean default route (laser-cut corporate gifting). Editable per job. */
/** The stages offered when planning a job. Older jobs may also carry Material Procurement or Cleaning. */
export const CORE_STAGES: MfgStage[] = ['Cutting', 'Laser Cutting', 'Assembly', 'Quality Check']

export const DEFAULT_JOB_STAGES: MfgStage[] = [...CORE_STAGES]

export function makeJobStage(stage: MfgStage, plannedDate?: string): JobStage {
  return { id: uid('stg'), stage, status: 'Pending', assignedTo: '', plannedDate, completedQuantity: 0 }
}

/**
 * The job's stage plan. Records created before per-job plans existed derive one
 * from their stage history, so no existing job breaks.
 */
export function jobStages(job: ManufacturingJob): JobStage[] {
  if (Array.isArray(job.stages) && job.stages.length > 0) return job.stages

  const seen: MfgStage[] = []
  job.history.forEach((entry) => {
    if (!seen.includes(entry.stage)) seen.push(entry.stage)
  })
  if (!seen.includes(job.stage)) seen.push(job.stage)

  const currentIndex = seen.indexOf(job.stage)
  return seen.map((stage, index) => {
    const isCurrent = index === currentIndex
    const isDone = index < currentIndex || (isCurrent && job.status === 'Completed')
    return {
      id: `${job.id}-stg-${index}`,
      stage,
      status: isDone ? 'Completed' : isCurrent && job.status !== 'Pending' ? job.status : 'Pending',
      assignedTo: isCurrent ? job.assignedTo : '',
      vendor: isCurrent && job.outsourced ? job.vendor : undefined,
      completedQuantity: isDone ? job.quantity : 0,
      completedAt: isDone ? job.completedAt : undefined,
      delayReason: isCurrent ? job.delayReason : undefined,
    }
  })
}

/** Overall status derived from the stage plan. */
export function deriveJobStatus(job: ManufacturingJob): MfgStatus {
  const stages = jobStages(job)
  if (stages.length === 0) return job.status
  if (stages.every((stage) => stage.status === 'Completed')) return 'Completed'
  if (stages.some((stage) => stage.status === 'Delayed')) return 'Delayed'
  if (stages.some((stage) => stage.status === 'In Progress' || stage.status === 'Completed')) return 'In Progress'
  return 'Pending'
}

/** Percentage of the job's stages completed. */
export function jobProgress(job: ManufacturingJob): number {
  const stages = jobStages(job)
  if (stages.length === 0) return job.progress
  const done = stages.filter((stage) => stage.status === 'Completed').length
  return Math.round((done / stages.length) * 100)
}

/** Quantity reported complete on the final stage of the plan. */
export function jobCompletedQuantity(job: ManufacturingJob): number {
  const stages = jobStages(job)
  const last = stages[stages.length - 1]
  if (last?.completedQuantity) return last.completedQuantity
  return job.completedQuantity ?? 0
}

/** The live delay reason: the first delayed stage's reason, else the job's. */
export function jobDelayReason(job: ManufacturingJob): string | undefined {
  const delayed = jobStages(job).find((stage) => stage.status === 'Delayed')
  return delayed?.delayReason ?? job.delayReason
}

/** Which stage a job is delayed at, when it is. */
export function jobDelayedAt(job: ManufacturingJob): MfgStage | undefined {
  const delayed = jobStages(job).find((stage) => stage.status === 'Delayed')
  return delayed?.stage ?? job.delayedAtStage
}

/* ------------------------------------------------------------------ */
/* Stage work pages                                                    */
/* ------------------------------------------------------------------ */

/** Each production stage has its own work page; this is its identity. */
export const STAGE_INFO: Record<MfgStage, { slug: string; blurb: string }> = {
  'Material Procurement': { slug: 'material', blurb: 'Issue and confirm the raw material each job needs before work starts.' },
  Cutting: { slug: 'cutting', blurb: 'Cut sheets, wire and blanks to the job specification.' },
  'Laser Cutting': { slug: 'laser-cutting', blurb: 'Fine detailing, engraving and precision laser work.' },
  Assembly: { slug: 'assembly', blurb: 'Join, solder and assemble the cut parts into the finished piece.' },
  Cleaning: { slug: 'cleaning', blurb: 'Polish, clean and finish the assembled pieces.' },
  'Quality Check': { slug: 'quality-check', blurb: 'Inspect every piece against the approved sample before packing.' },
}

export function stagePath(stage: MfgStage): string {
  return `/production/${STAGE_INFO[stage].slug}`
}

export function stageFromSlug(slug?: string): MfgStage | undefined {
  return (Object.keys(STAGE_INFO) as MfgStage[]).find((stage) => STAGE_INFO[stage].slug === slug)
}

export interface StageEntry {
  job: ManufacturingJob
  stage: JobStage
  /** Position of this stage inside the job's own plan. */
  index: number
  /** The stage that follows in this job's plan, if any. */
  next?: JobStage
  /** For queued work: the earlier stage still holding the job back. */
  waitingOn?: JobStage
}

/**
 * Where every job stands at one stage. A job is "ready" here once every
 * earlier stage in its own plan is completed, so finishing a stage is what
 * moves the job into the next stage's queue.
 */
export function stageQueues(jobs: ManufacturingJob[], stage: MfgStage) {
  const ready: StageEntry[] = []
  const upcoming: StageEntry[] = []
  const done: StageEntry[] = []

  jobs.forEach((job) => {
    const stages = jobStages(job)
    const index = stages.findIndex((item) => item.stage === stage)
    if (index === -1) return
    const entry: StageEntry = { job, stage: stages[index], index, next: stages[index + 1] }
    if (entry.stage.status === 'Completed') {
      done.push(entry)
      return
    }
    const blocker = stages.slice(0, index).find((item) => item.status !== 'Completed')
    if (blocker) upcoming.push({ ...entry, waitingOn: blocker })
    else ready.push(entry)
  })

  return { ready, upcoming, done }
}

/** Structured reasons offered when a stage is marked Delayed. */
export const DELAY_REASONS = [
  'Material shortage',
  'Machine breakdown',
  'Outsourced job delay',
  'Labour shortage',
  'Quality hold',
  'Customer approval pending',
  'Other',
]

export function reasonFromValue(value?: string): { reason: string; other: string } {
  if (!value) return { reason: '', other: '' }
  if (DELAY_REASONS.includes(value)) return { reason: value, other: '' }
  return { reason: 'Other', other: value }
}

/** Reasons a piece can be lost or rejected at a stage. */
export const LOSS_REASONS = [
  'Cutting error',
  'Material defect',
  'Machine fault',
  'Handling damage',
  'Design mismatch',
  'Failed inspection',
  'Other',
]

/**
 * Pieces a stage receives: the first stage gets the whole job quantity, every
 * later stage gets exactly what the previous stage passed on (output = input
 * minus loss), so a rejected piece can never reappear downstream.
 */
export function receivedQuantity(job: ManufacturingJob, index: number): number {
  if (index <= 0) return job.quantity
  const previous = jobStages(job)[index - 1]
  return previous?.completedQuantity && previous.completedQuantity > 0 ? previous.completedQuantity : job.quantity
}
