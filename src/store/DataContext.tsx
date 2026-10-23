import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { CompanySettings, Database } from '@/types'
import { cloneDatabase, loadDatabase, resetDatabase, saveDatabase, STORAGE_KEY } from '@/lib/storage'

interface DataContextValue {
  db: Database
  /**
   * Apply a change to a cloned draft of the database and persist it.
   * The recipe runs synchronously and its return value is passed back to the
   * caller, so forms can react to validation results immediately.
   */
  mutate: <T>(recipe: (draft: Database) => T) => T
  reset: () => void
  exportJSON: () => void
  importJSON: (file: File) => Promise<{ ok: boolean; error?: string; settings?: CompanySettings }>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(() => loadDatabase())
  const dbRef = useRef(db)

  const apply = useCallback((next: Database) => {
    dbRef.current = next
    setDb(next)
  }, [])

  useEffect(() => {
    saveDatabase(db)
  }, [db])

  const mutate = useCallback(
    <T,>(recipe: (draft: Database) => T): T => {
      const draft = cloneDatabase(dbRef.current)
      const result = recipe(draft)
      apply(draft)
      return result
    },
    [apply],
  )

  const reset = useCallback(() => {
    apply(resetDatabase())
  }, [apply])

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(dbRef.current, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vinayak-silver-erp-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  const importJSON = useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const parsed = JSON.parse(text) as Database
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.customers)) {
          return { ok: false, error: 'That file does not look like a Vinayak Silver ERP backup.' }
        }
        apply(parsed)
        return { ok: true, settings: parsed.settings }
      } catch {
        return { ok: false, error: 'Could not read that file. Please choose a valid JSON backup.' }
      }
    },
    [apply],
  )

  const value = useMemo<DataContextValue>(
    () => ({ db, mutate, reset, exportJSON, importJSON }),
    [db, mutate, reset, exportJSON, importJSON],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside a DataProvider')
  return context
}

export { STORAGE_KEY }
