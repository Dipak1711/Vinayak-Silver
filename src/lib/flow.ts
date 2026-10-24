import type { LucideIcon } from 'lucide-react'
import { Boxes, ClipboardList, Factory, PackageOpen, Scissors, ShieldCheck, Sparkles, Truck, Wrench, Zap } from 'lucide-react'
import type { Database, MfgStage } from '@/types'
import { MFG_STAGES } from '@/types'
import { CORE_STAGES, stagePath, stageQueues, STAGE_INFO } from '@/lib/manufacturing'

export interface FlowStep {
  to: string
  label: string
  icon: LucideIcon
  description: string
  kind: 'inventory' | 'stage' | 'packaging' | 'dispatch'
}

export const STAGE_ICONS: Record<MfgStage, LucideIcon> = {
  'Material Procurement': ClipboardList,
  Cutting: Scissors,
  'Laser Cutting': Zap,
  Assembly: Wrench,
  Cleaning: Sparkles,
  'Quality Check': ShieldCheck,
}

const stageStep = (stage: MfgStage): FlowStep => ({
  to: stagePath(stage),
  label: stage,
  icon: STAGE_ICONS[stage],
  description: STAGE_INFO[stage].blurb,
  kind: 'stage',
})

/** The order-to-delivery chain, in the order work actually flows. */
export const FLOW_STEPS: FlowStep[] = [
  { to: '/inventory', label: 'Raw Inventory', icon: Boxes, description: 'Raw material stock and movements', kind: 'inventory' },
  ...CORE_STAGES.map(stageStep),
  { to: '/packaging', label: 'Packaging', icon: PackageOpen, description: 'Packing progress and readiness', kind: 'packaging' },
  { to: '/dispatch', label: 'Dispatch', icon: Truck, description: 'Shipments and delivery tracking', kind: 'dispatch' },
]

/**
 * Older jobs can still sit at Material Procurement or Cleaning. Those steps are
 * not part of the standard flow, so they only appear while a job is waiting there.
 */
export function flowStepsFor(db: Database): FlowStep[] {
  const counts = flowCounts(db)
  const legacy = MFG_STAGES.filter((stage) => !CORE_STAGES.includes(stage) && (counts[stagePath(stage)] ?? 0) > 0)
  if (legacy.length === 0) return FLOW_STEPS
  const steps = [...FLOW_STEPS]
  legacy.forEach((stage) => {
    const order = MFG_STAGES.indexOf(stage)
    const at = steps.findIndex(
      (step) => step.kind === 'stage' && MFG_STAGES.indexOf(step.label as MfgStage) > order,
    )
    steps.splice(at === -1 ? steps.findIndex((step) => step.kind === 'packaging') : at, 0, stageStep(stage))
  })
  return steps
}

export const MANUFACTURING_OVERVIEW = {
  to: '/manufacturing',
  label: 'Manufacturing',
  icon: Factory,
  description: 'All production jobs and their stage plans',
}

/** What needs attention at each step; shared by the sidebar and the flow strip. */
export function flowCounts(db: Database): Record<string, number> {
  const counts: Record<string, number> = {
    '/inventory': db.rawMaterials.filter((material) => material.quantity <= material.minStock).length,
    '/manufacturing': db.manufacturingJobs.filter((job) => job.status !== 'Completed').length,
    '/packaging': db.packagingJobs.filter((job) => job.status !== 'Packed').length,
    '/dispatch': db.dispatches.filter((dispatch) => dispatch.status !== 'Delivered').length,
  }
  MFG_STAGES.forEach((stage) => {
    counts[stagePath(stage)] = stageQueues(db.manufacturingJobs, stage).ready.length
  })
  return counts
}
