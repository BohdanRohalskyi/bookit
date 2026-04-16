import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Check, Plus, Trash2, X } from 'lucide-react'
import { api } from '@bookit/shared/api'

// ─── Local types ──────────────────────────────────────────────────────────────

interface EquipmentItem { id: string; name: string }
interface StaffRoleItem { id: string; job_title: string }

interface ServiceItem {
  id: string
  business_id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number
  currency: string
  equipment_requirements: Array<{ equipment_id: string; equipment_name: string; quantity_needed: number }>
  staff_requirements: Array<{ staff_role_id: string; job_title: string; quantity_needed: number }>
}

interface LocationServiceItem {
  id: string
  location_id: string
  service_id: string
  is_active: boolean
  service: ServiceItem
}

// ─── Requirements columns ─────────────────────────────────────────────────────

interface RequirementRow {
  id: string
  name: string
  quantity: number
}

interface RequirementsColumnProps {
  title: string
  options: Array<{ id: string; name: string }>
  rows: RequirementRow[]
  onAdd: (id: string, name: string, qty: number) => void
  onRemove: (id: string) => void
}

function RequirementsColumn({ title, options, rows, onAdd, onRemove }: RequirementsColumnProps) {
  const [selectedId, setSelectedId] = useState('')
  const [qty, setQty] = useState(1)
  const usedIds = new Set(rows.map((r) => r.id))
  const available = options.filter((o) => !usedIds.has(o.id))

  const handleAdd = () => {
    const opt = options.find((o) => o.id === selectedId)
    if (!opt) return
    onAdd(opt.id, opt.name, qty)
    setSelectedId('')
    setQty(1)
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-[rgba(2,9,5,0.6)] uppercase tracking-wider">{title}</p>

      {rows.map((row) => (
        <div key={row.id} className="flex items-center justify-between px-3 py-2 bg-[#f8f9fa] rounded-[6px]">
          <span className="text-sm text-[#020905]">{row.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[rgba(2,9,5,0.5)] bg-white border border-[rgba(2,9,5,0.1)] rounded px-2 py-0.5">
              ×{row.quantity}
            </span>
            <button
              onClick={() => onRemove(row.id)}
              className="text-[rgba(2,9,5,0.3)] hover:text-red-600 transition-colors"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ))}

      {available.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] bg-white"
          >
            <option value="">Select…</option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            className="w-14 px-2 py-1.5 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
          />
          <button
            onClick={handleAdd}
            disabled={!selectedId}
            className="p-1.5 text-[#1069d1] hover:bg-[#e7f0fa] rounded-[4px] disabled:opacity-40 transition-colors"
          >
            <Plus className="size-4" />
          </button>
        </div>
      )}
      {available.length === 0 && rows.length === 0 && (
        <p className="text-xs text-[rgba(2,9,5,0.35)] italic">
          Add equipment / staff roles in Step 3 first
        </p>
      )}
    </div>
  )
}

// ─── Add service form ─────────────────────────────────────────────────────────

interface AddServiceFormProps {
  businessId: string
  locationId: string
  equipment: EquipmentItem[]
  staffRoles: StaffRoleItem[]
  onCreated: () => void
  onCancel: () => void
}

function AddServiceForm({ businessId, locationId, equipment, staffRoles, onCreated, onCancel }: AddServiceFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState(60)
  const [price, setPrice] = useState(0)
  const [currency, setCurrency] = useState('EUR')
  const [equipReqs, setEquipReqs] = useState<RequirementRow[]>([])
  const [staffReqs, setStaffReqs] = useState<RequirementRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const { data: svcData, error: svcErr } = await api.POST('/api/v1/services', {
        body: {
          business_id: businessId,
          name: name.trim(),
          description: description.trim() || undefined,
          duration_minutes: duration,
          price,
          currency,
          equipment_requirements: equipReqs.map((r) => ({
            equipment_id: r.id,
            quantity_needed: r.quantity,
          })),
          staff_requirements: staffReqs.map((r) => ({
            staff_role_id: r.id,
            quantity_needed: r.quantity,
          })),
        },
      })
      if (svcErr) throw svcErr
      const svcId = (svcData as ServiceItem).id

      const { error: linkErr } = await api.POST('/api/v1/locations/{id}/services', {
        params: { path: { id: locationId } },
        body: { service_id: svcId },
      })
      if (linkErr) throw linkErr
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services-catalog', businessId] })
      queryClient.invalidateQueries({ queryKey: ['location-services', locationId] })
      onCreated()
    },
    onError: () => setError('Failed to create service. Please try again.'),
  })

  const inputCls =
    'w-full px-3 py-2 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors'

  return (
    <div className="p-6 bg-[#f8f9fa] border border-[rgba(2,9,5,0.08)] rounded-lg flex flex-col gap-5">
      <p className="font-heading font-semibold text-base text-[#020905]">New Service</p>

      {error && (
        <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#020905]">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Haircut" className={inputCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#020905]">Description</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#020905]">Duration (min) *</label>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#020905]">Price *</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[#020905]">Currency</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls + ' bg-white'}>
            <option>EUR</option>
            <option>USD</option>
            <option>GBP</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-white border border-[rgba(2,9,5,0.08)] rounded-lg">
        <RequirementsColumn
          title="Equipment needed"
          options={equipment.map((e) => ({ id: e.id, name: e.name }))}
          rows={equipReqs}
          onAdd={(id, name, qty) => setEquipReqs((prev) => [...prev, { id, name, quantity: qty }])}
          onRemove={(id) => setEquipReqs((prev) => prev.filter((r) => r.id !== id))}
        />
        <RequirementsColumn
          title="Staff needed"
          options={staffRoles.map((s) => ({ id: s.id, name: s.job_title }))}
          rows={staffReqs}
          onAdd={(id, name, qty) => setStaffReqs((prev) => [...prev, { id, name, quantity: qty }])}
          onRemove={(id) => setStaffReqs((prev) => prev.filter((r) => r.id !== id))}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => mutate()}
          disabled={isPending || !name.trim() || duration < 1}
          className="px-5 py-2.5 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 transition-colors"
        >
          {isPending ? 'Creating…' : 'Create Service'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 text-sm font-medium text-[rgba(2,9,5,0.6)] hover:text-[#020905] transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Step ─────────────────────────────────────────────────────────────────────

interface Props {
  businessId: string
  locationId: string
  onFinish: () => void
  onBack: () => void
}

export function StepServices({ businessId, locationId, onFinish, onBack }: Props) {
  const queryClient = useQueryClient()
  const [showAddForm, setShowAddForm] = useState(false)

  const { data: equipmentCatalog } = useQuery({
    queryKey: ['equipment-catalog', businessId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/equipment', {
        params: { query: { business_id: businessId } },
      })
      return (data as { data: EquipmentItem[] } | null)?.data ?? []
    },
  })

  const { data: staffRolesCatalog } = useQuery({
    queryKey: ['staff-roles-catalog', businessId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/staff-roles', {
        params: { query: { business_id: businessId } },
      })
      return (data as { data: StaffRoleItem[] } | null)?.data ?? []
    },
  })

  const { data: locationServices, isLoading } = useQuery({
    queryKey: ['location-services', locationId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/locations/{id}/services', {
        params: { path: { id: locationId } },
      })
      return (data as { data: LocationServiceItem[] } | null)?.data ?? []
    },
  })

  const { mutate: removeService } = useMutation({
    mutationFn: async (itemId: string) => {
      await api.DELETE('/api/v1/locations/{id}/services/{item_id}', {
        params: { path: { id: locationId, item_id: itemId } },
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['location-services', locationId] }),
  })

  const services = locationServices ?? []
  const equipment = equipmentCatalog ?? []
  const staffRoles = staffRolesCatalog ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading font-semibold text-lg text-[#020905]">Services</p>
            <p className="text-sm text-[rgba(2,9,5,0.45)] mt-0.5">
              {services.length === 0 ? 'No services yet' : `${services.length} service${services.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />
        ) : services.length > 0 ? (
          <div className="flex flex-col gap-2">
            {services.map((ls) => (
              <div key={ls.id} className="flex items-start justify-between px-4 py-3 bg-[#f8f9fa] rounded-lg">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-[#020905]">{ls.service.name}</p>
                  <div className="flex items-center gap-3 text-xs text-[rgba(2,9,5,0.5)]">
                    <span>{ls.service.duration_minutes} min</span>
                    <span>{ls.service.price} {ls.service.currency}</span>
                    {ls.service.equipment_requirements.length > 0 && (
                      <span>{ls.service.equipment_requirements.map((e) => e.equipment_name).join(', ')}</span>
                    )}
                    {ls.service.staff_requirements.length > 0 && (
                      <span>{ls.service.staff_requirements.map((s) => s.job_title).join(', ')}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeService(ls.id)}
                  className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {showAddForm ? (
          <AddServiceForm
            businessId={businessId}
            locationId={locationId}
            equipment={equipment}
            staffRoles={staffRoles}
            onCreated={() => setShowAddForm(false)}
            onCancel={() => setShowAddForm(false)}
          />
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[rgba(2,9,5,0.5)] border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-lg hover:border-[#1069d1] hover:text-[#1069d1] transition-colors w-fit"
          >
            <Plus className="size-4" />
            Add service
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[rgba(2,9,5,0.6)] hover:text-[#020905] transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>
        <button
          onClick={onFinish}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
        >
          <Check className="size-4" />
          Finish
        </button>
      </div>
    </div>
  )
}
