import type { DispatchStatus } from '@/types'

/**
 * A deterministic stand-in for a courier tracking API.
 *
 * Nothing here touches the network. `fetchMockTracking` simply advances a
 * shipment along a fixed, realistic milestone list based on what is already
 * recorded, so repeated "Fetch tracking" clicks behave like polling a real
 * carrier. Courier name, tracking number and delivery ETA are never changed —
 * only new events and the status are added.
 */

/** Shown on the UI so it is unmistakable that this is not a live feed. */
export const MOCK_COURIER_LABEL = 'SIMULATED'

const HUBS = ['Mumbai', 'Pune', 'Nashik', 'Surat', 'Delhi', 'Bengaluru', 'Hyderabad', 'Kolkata']

const MILESTONES: Array<{ status: DispatchStatus; note: string }> = [
  { status: 'Dispatched', note: 'Shipment picked up from the warehouse' },
  { status: 'In Transit', note: 'Departed the origin facility' },
  { status: 'In Transit', note: 'Arrived at the {hub} sorting centre' },
  { status: 'In Transit', note: 'Out for delivery to the consignee' },
  { status: 'Delivered', note: 'Delivered and signed by the consignee' },
]

/** Stable pseudo-hub chosen from the tracking number, so results repeat. */
function hubFrom(seed: string): string {
  let hash = 0
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000
  }
  return HUBS[hash % HUBS.length]
}

export interface MockTrackingStep {
  status: DispatchStatus
  note: string
  at: string
}

/**
 * Returns the next simulated tracking event for a dispatch record, or `null`
 * when the shipment is already delivered.
 */
export function fetchMockTracking(record: {
  id: string
  trackingNumber: string
  courierName: string
  status: DispatchStatus
  events: Array<{ status: DispatchStatus }>
}): MockTrackingStep | null {
  if (record.status === 'Delivered') return null
  const index = Math.min(Math.max(record.events.length - 1, 0), MILESTONES.length - 1)
  const milestone = MILESTONES[index]
  const note = milestone.note.replace('{hub}', hubFrom(record.trackingNumber || record.id))
  return {
    status: milestone.status,
    note: `${note} · ${record.courierName || 'Courier'} (${MOCK_COURIER_LABEL})`,
    at: new Date().toISOString(),
  }
}
