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
export const DEFAULT_JOB_STAGES: MfgStage[] = [
  'Material Procurement',
  'Cutting',
  'Laser Cutting',
  'Quality Check',
]

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
