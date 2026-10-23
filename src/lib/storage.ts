import type { Database } from '@/types'
import { createSeedDatabase, DB_VERSION } from '@/lib/seed'

export const STORAGE_KEY = 'vinayak_silver_erp_db'

/** Collection keys that must always exist as arrays. */
const COLLECTION_KEYS: Array<keyof Database> = [
  'leads',
  'customers',
  'suppliers',
  'products',
  'rawMaterials',
  'stockMovements',
  'quotations',
  'invoices',
  'manufacturingJobs',
  'packagingJobs',
  'dispatches',
  'supplierTransactions',
  'advances',
  'activities',
]

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function saveDatabase(db: Database): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch (error) {
    console.error('[vinayak-silver] Failed to persist demo data', error)
  }
}

/**
 * Merge a parsed payload with the current defaults so that missing or
 * partially corrupt data never crashes the app.
 */
function mergeWithDefaults(parsed: Partial<Database>): Database {
  const seed = createSeedDatabase()
  const merged: Database = { ...seed }

  COLLECTION_KEYS.forEach((key) => {
    const value = parsed[key]
    if (Array.isArray(value)) {
      // Each collection entry must at least look like an object with an id.
      const cleaned = (value as unknown[]).filter(
        (entry) => Boolean(entry) && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string',
      )
      Object.assign(merged, { [key]: cleaned })
    }
  })

  if (parsed.settings && typeof parsed.settings === 'object') {
    merged.settings = { ...seed.settings, ...parsed.settings }
  }
  if (parsed.counters && typeof parsed.counters === 'object') {
    merged.counters = { ...seed.counters, ...parsed.counters }
  }
  merged.version = DB_VERSION
  merged.seededAt = parsed.seededAt ?? seed.seededAt
  return merged
}

export function loadDatabase(): Database {
  const store = storage()
  if (!store) return createSeedDatabase()

  let raw: string | null = null
  try {
    raw = store.getItem(STORAGE_KEY)
  } catch {
    raw = null
  }

  if (!raw) {
    const seed = createSeedDatabase()
    saveDatabase(seed)
    return seed
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Database>
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid payload')
    if (parsed.version !== DB_VERSION) {
      // Schema changed — rebuild the demo dataset.
      const seed = createSeedDatabase()
      saveDatabase(seed)
      return seed
    }
    const merged = mergeWithDefaults(parsed)
    return merged
  } catch (error) {
    console.warn('[vinayak-silver] Corrupt demo data detected, recreating sample data.', error)
    const seed = createSeedDatabase()
    saveDatabase(seed)
    return seed
  }
}

/** Wipe stored data and recreate the original demo dataset. */
export function resetDatabase(): Database {
  const seed = createSeedDatabase()
  saveDatabase(seed)
  return seed
}

export function cloneDatabase(db: Database): Database {
  if (typeof structuredClone === 'function') return structuredClone(db)
  return JSON.parse(JSON.stringify(db)) as Database
}
