import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Database,
  Download,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  Upload,
} from 'lucide-react'
import { PageHeader, DataRow } from '@/components/ui/Layout'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Field, Input, Select, Textarea } from '@/components/ui/Form'
import { ConfirmDialog } from '@/components/ui/Modal'
import { StatCard } from '@/components/ui/StatCard'
import { useData, STORAGE_KEY } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { pushActivity } from '@/lib/workflow'
import { formatDateTime } from '@/lib/utils'

export function SettingsPage() {
  const { db, mutate, reset, exportJSON, importJSON } = useData()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [settings, setSettings] = useState(db.settings)
  const [resetOpen, setResetOpen] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Keep the form in sync when the dataset is replaced by a reset.
  useEffect(() => {
    setSettings(db.settings)
  }, [db.seededAt])

  const storageSize = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return '0 KB'
      return `${(new Blob([raw]).size / 1024).toFixed(1)} KB`
    } catch {
      return 'unavailable'
    }
  }, [db])

  const records = [
    { label: 'Leads', value: db.leads.length },
    { label: 'Customers', value: db.customers.length },
    { label: 'Suppliers', value: db.suppliers.length },
    { label: 'Products', value: db.products.length },
    { label: 'Raw materials', value: db.rawMaterials.length },
    { label: 'Stock movements', value: db.stockMovements.length },
    { label: 'Quotations', value: db.quotations.length },
    { label: 'Invoices', value: db.invoices.length },
    { label: 'Production jobs', value: db.manufacturingJobs.length },
    { label: 'Packaging jobs', value: db.packagingJobs.length },
    { label: 'Dispatches', value: db.dispatches.length },
    { label: 'Supplier transactions', value: db.supplierTransactions.length },
  ]

  const totalRecords = records.reduce((acc, record) => acc + record.value, 0)

  const saveSettings = () => {
    const next: Record<string, string> = {}
    if (!settings.name.trim()) next.name = 'Company name is required.'
    if (!settings.email.trim()) next.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) next.email = 'Enter a valid email address.'
    if (settings.gstin.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/i.test(settings.gstin.trim())) next.gstin = 'GSTIN must be 15 characters.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    mutate((draft) => {
      draft.settings = { ...draft.settings, ...settings }
      pushActivity(draft, 'System', 'Company profile settings updated')
    })
    toast.success('Company profile saved.')
  }

  const handleImport = async (file: File) => {
    const result = await importJSON(file)
    if (!result.ok) {
      toast.error(result.error ?? 'Import failed.')
      return
    }
    if (result.settings) setSettings(result.settings)
    toast.success('Backup restored successfully.')
  }

  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        icon={<SettingsIcon className="h-5 w-5" />}
        title="Settings"
        description="Company profile, demo data controls and local storage information."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total records" value={totalRecords} hint="Across all modules" icon={<Database className="h-4.5 w-4.5" />} tone="blue" />
        <StatCard label="Storage used" value={storageSize} hint={`Key: ${STORAGE_KEY}`} icon={<Save className="h-4.5 w-4.5" />} tone="navy" />
        <StatCard label="Demo seeded" value={formatDateTime(db.seededAt)} hint={`Schema version ${db.version}`} icon={<RotateCcw className="h-4.5 w-4.5" />} tone="violet" />
      </div>

      <Card>
        <CardHeader
          title="Company profile"
          subtitle="Used on printed quotations and invoices."
          action={<Badge tone="info">Demo values</Badge>}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name" required error={errors.name}>
            <Input value={settings.name} onChange={(event) => setSettings({ ...settings, name: event.target.value })} invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Tagline">
            <Input value={settings.tagline} onChange={(event) => setSettings({ ...settings, tagline: event.target.value })} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <Input value={settings.email} onChange={(event) => setSettings({ ...settings, email: event.target.value })} invalid={Boolean(errors.email)} />
          </Field>
          <Field label="Phone">
            <Input value={settings.phone} onChange={(event) => setSettings({ ...settings, phone: event.target.value })} />
          </Field>
          <Field label="GSTIN" error={errors.gstin}>
            <Input value={settings.gstin} onChange={(event) => setSettings({ ...settings, gstin: event.target.value.toUpperCase() })} invalid={Boolean(errors.gstin)} />
          </Field>
          <Field label="Website">
            <Input value={settings.website} onChange={(event) => setSettings({ ...settings, website: event.target.value })} />
          </Field>
          <Field label="City">
            <Input value={settings.city} onChange={(event) => setSettings({ ...settings, city: event.target.value })} />
          </Field>
          <Field label="State">
            <Input value={settings.state} onChange={(event) => setSettings({ ...settings, state: event.target.value })} />
          </Field>
          <Field label="Pincode">
            <Input value={settings.pincode} onChange={(event) => setSettings({ ...settings, pincode: event.target.value })} />
          </Field>
          <Field label="Financial year">
            <Input value={settings.financialYear} onChange={(event) => setSettings({ ...settings, financialYear: event.target.value })} />
          </Field>
          <Field label="Bank name">
            <Input value={settings.bankName} onChange={(event) => setSettings({ ...settings, bankName: event.target.value })} />
          </Field>
          <Field label="Account number">
            <Input value={settings.bankAccount} onChange={(event) => setSettings({ ...settings, bankAccount: event.target.value })} />
          </Field>
          <Field label="IFSC">
            <Input value={settings.ifsc} onChange={(event) => setSettings({ ...settings, ifsc: event.target.value })} />
          </Field>
          <Field label="Default GST rate (%)">
            <Select value={String(settings.defaultTaxRate)} onChange={(event) => setSettings({ ...settings, defaultTaxRate: Number(event.target.value) })}>
              {[0, 3, 5, 12, 18, 28].map((rate) => (
                <option key={rate} value={rate}>
                  {rate}%
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Registered address" className="sm:col-span-2">
            <Textarea value={settings.address} onChange={(event) => setSettings({ ...settings, address: event.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button icon={<Save className="h-4 w-4" />} onClick={saveSettings}>
            Save profile
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Demo data controls"
            subtitle="This application stores everything in your browser only."
            action={<Badge tone="warning">LocalStorage only</Badge>}
          />
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-600" />
              <div className="text-xs text-amber-900">
                <p className="font-semibold">Reset demo data</p>
                <p className="mt-1 leading-relaxed">
                  Restores the original fictional sample data and discards every change you have made. This action
                  cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setResetOpen(true)}>
                Reset demo data
              </Button>
              <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportJSON}>
                Export backup (JSON)
              </Button>
              <Button variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
                Import backup
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleImport(file)
                  event.target.value = ''
                }}
              />
            </div>
            <p className="text-xs leading-relaxed text-silver-600">
              No database, backend or external service is connected. Data survives page refreshes through localStorage
              and can be exported as a JSON backup at any time.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Stored dataset" subtitle="Record counts currently persisted in this browser." />
          <div className="mt-2 divide-y divide-silver-100">
            {records.map((record) => (
              <DataRow key={record.label} label={record.label} value={record.value} />
            ))}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="Reset demo data?"
        message="All leads, customers, quotations, invoices, stock movements and production records will be replaced with the original fictional sample data. Anything you added will be lost."
        confirmLabel="Yes, reset everything"
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          reset()
          setResetOpen(false)
          toast.success('Demo data has been reset to the original sample dataset.')
        }}
      />
    </>
  )
}
