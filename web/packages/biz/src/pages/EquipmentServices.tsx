import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Loader2, X, Package } from 'lucide-react'
import {
  listEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
  listServices,
  createService,
  updateService,
  deleteService,
  type Equipment,
  type Service,
  type ServiceCreateBody,
} from '../api/catalogApi'
import { useSpaceStore } from '../stores/spaceStore'

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT =
  'w-full h-9 px-3 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 focus:border-[#1069d1] bg-white'

const BTN_PRIMARY =
  'flex items-center justify-center gap-2 h-9 px-4 bg-[#1069d1] hover:bg-[#0e5bb8] text-white text-sm font-medium rounded-[6px] transition-colors disabled:opacity-60'

const BTN_GHOST =
  'h-9 px-4 border border-[rgba(2,9,5,0.15)] rounded-[6px] text-sm text-[rgba(2,9,5,0.6)] hover:border-[rgba(2,9,5,0.3)] transition-colors'

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-white rounded-xl shadow-xl p-6 mx-4 max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="size-9 bg-[#e7f0fa] rounded-lg flex items-center justify-center">
          <Package className="size-4 text-[#1069d1]" />
        </div>
        <p className="font-heading font-semibold text-[#020905] text-base">{title}</p>
      </div>
      <button
        onClick={onClose}
        className="size-8 flex items-center justify-center rounded-lg hover:bg-[rgba(2,9,5,0.05)] transition-colors"
      >
        <X className="size-4 text-[rgba(2,9,5,0.4)]" />
      </button>
    </div>
  )
}

// ─── Equipment dialogs ────────────────────────────────────────────────────────

function EquipmentDialog({
  initial,
  onSave,
  onClose,
  isPending,
}: {
  initial?: Equipment
  onSave: (name: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim()) onSave(name.trim())
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={initial ? `Edit ${initial.name}` : 'Add equipment'} onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
            Equipment name
          </label>
          <input
            autoFocus
            type="text"
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Equipment name"
            className={INPUT}
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="submit" disabled={isPending || !name.trim()} className={`flex-1 ${BTN_PRIMARY}`}>
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteConfirmDialog({
  label,
  error,
  isPending,
  onConfirm,
  onClose,
}: {
  label: string
  error?: string
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose}>
      <p className="font-heading font-semibold text-[#020905] text-base mb-2">Are you sure?</p>
      <p className="text-sm text-[rgba(2,9,5,0.6)] mb-4">
        <span className="font-medium text-[#020905]">{label}</span> will be permanently deleted.
      </p>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button onClick={onClose} className={`flex-1 ${BTN_GHOST}`}>Cancel</button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="flex-1 h-9 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-[6px] transition-colors disabled:opacity-60"
        >
          {isPending && <Loader2 className="size-3.5 animate-spin" />}
          Delete
        </button>
      </div>
    </Modal>
  )
}

// ─── Equipment tab ────────────────────────────────────────────────────────────

function EquipmentTab({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<'add' | { edit: Equipment } | { delete: Equipment } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment', businessId],
    queryFn: () => listEquipment(businessId),
    enabled: !!businessId,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['equipment', businessId] })

  const addMutation = useMutation({
    mutationFn: (name: string) => createEquipment(businessId, name),
    onSuccess: () => { invalidate(); setDialog(null) },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateEquipment(id, name),
    onSuccess: () => { invalidate(); setDialog(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEquipment(id),
    onSuccess: () => { invalidate(); setDialog(null); setDeleteError(null) },
    onError: (err: unknown) => {
      const e = err as { status?: number }
      if (e?.status === 409) {
        setDeleteError('This equipment is used by one or more services and cannot be deleted.')
      } else {
        setDeleteError('Failed to delete. Please try again.')
      }
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[rgba(2,9,5,0.5)]">Manage your business equipment catalog</p>
        <button onClick={() => setDialog('add')} className={BTN_PRIMARY}>
          <Plus className="size-4" />
          Add equipment
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-[rgba(2,9,5,0.4)]">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {!isLoading && equipment.length === 0 && (
        <div className="text-center py-16">
          <Package className="size-10 mx-auto mb-3 text-[rgba(2,9,5,0.15)]" />
          <p className="text-[rgba(2,9,5,0.5)] text-sm">No equipment yet.</p>
        </div>
      )}

      {equipment.length > 0 && (
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg divide-y divide-[rgba(2,9,5,0.06)]">
          {equipment.map((eq) => (
            <div key={eq.id} className="flex items-center gap-3 px-4 py-3">
              <p className="flex-1 text-sm text-[#020905] font-medium">{eq.name}</p>
              <button
                title={`Edit ${eq.name}`}
                onClick={() => setDialog({ edit: eq })}
                className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:text-[#1069d1] hover:bg-[#e7f0fa] transition-colors"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                title={`Delete ${eq.name}`}
                onClick={() => { setDeleteError(null); setDialog({ delete: eq }) }}
                className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      {dialog === 'add' && (
        <EquipmentDialog
          onSave={(name) => addMutation.mutate(name)}
          onClose={() => setDialog(null)}
          isPending={addMutation.isPending}
        />
      )}

      {/* Edit dialog */}
      {dialog !== null && typeof dialog === 'object' && 'edit' in dialog && (
        <EquipmentDialog
          initial={dialog.edit}
          onSave={(name) => editMutation.mutate({ id: dialog.edit.id, name })}
          onClose={() => setDialog(null)}
          isPending={editMutation.isPending}
        />
      )}

      {/* Delete dialog */}
      {dialog !== null && typeof dialog === 'object' && 'delete' in dialog && (
        <DeleteConfirmDialog
          label={dialog.delete.name}
          error={deleteError ?? undefined}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(dialog.delete.id)}
          onClose={() => { setDialog(null); setDeleteError(null) }}
        />
      )}
    </div>
  )
}

// ─── Service form ─────────────────────────────────────────────────────────────

type EquipmentReqRow = { equipment_id: string; quantity_needed: number }

interface ServiceFormState {
  name: string
  description: string
  duration_minutes: number
  price: number
  currency: string
  equipment_requirements: EquipmentReqRow[]
}

function defaultForm(): ServiceFormState {
  return { name: '', description: '', duration_minutes: 30, price: 0, currency: 'EUR', equipment_requirements: [] }
}

function serviceToForm(s: Service): ServiceFormState {
  return {
    name: s.name,
    description: s.description ?? '',
    duration_minutes: s.duration_minutes,
    price: s.price,
    currency: s.currency,
    equipment_requirements: (s.equipment_requirements ?? []).map((r) => ({
      equipment_id: r.equipment_id,
      quantity_needed: r.quantity_needed,
    })),
  }
}

function ServiceDialog({
  initial,
  availableEquipment,
  onSave,
  onClose,
  isPending,
}: {
  initial?: Service
  availableEquipment: Equipment[]
  onSave: (body: ServiceCreateBody) => void
  onClose: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState<ServiceFormState>(initial ? serviceToForm(initial) : defaultForm)

  function setField<K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addEquipmentRow() {
    setField('equipment_requirements', [
      ...form.equipment_requirements,
      { equipment_id: availableEquipment[0]?.id ?? '', quantity_needed: 1 },
    ])
  }

  function updateEqRow(index: number, patch: Partial<EquipmentReqRow>) {
    const updated = form.equipment_requirements.map((r, i) => i === index ? { ...r, ...patch } : r)
    setField('equipment_requirements', updated)
  }

  function removeEqRow(index: number) {
    setField('equipment_requirements', form.equipment_requirements.filter((_, i) => i !== index))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      duration_minutes: form.duration_minutes,
      price: form.price,
      currency: form.currency.trim() || 'EUR',
      equipment_requirements: form.equipment_requirements.filter((r) => r.equipment_id),
    })
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader title={initial ? `Edit ${initial.name}` : 'Add service'} onClose={onClose} />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="svc-name" className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
            Service name <span className="text-red-400">*</span>
          </label>
          <input
            id="svc-name"
            aria-label="Service name"
            type="text"
            required
            maxLength={120}
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="e.g. Haircut"
            className={INPUT}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
            Description <span className="text-[rgba(2,9,5,0.35)] font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            maxLength={1000}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
            placeholder="Short description of the service"
            className="w-full px-3 py-2 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#1069d1]/30 focus:border-[#1069d1] bg-white resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
              Duration (minutes) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={form.duration_minutes}
              onChange={(e) => setField('duration_minutes', Number(e.target.value))}
              className={INPUT}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">
              Price <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) => setField('price', Number(e.target.value))}
              className={INPUT}
            />
          </div>
        </div>

        <div className="w-32">
          <label className="text-xs font-medium text-[rgba(2,9,5,0.6)] block mb-1.5">Currency</label>
          <input
            type="text"
            maxLength={3}
            value={form.currency}
            onChange={(e) => setField('currency', e.target.value.toUpperCase())}
            className={INPUT}
          />
        </div>

        {/* Equipment requirements */}
        {availableEquipment.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[rgba(2,9,5,0.6)] mb-2">Equipment requirements</p>
            <div className="flex flex-col gap-2">
              {form.equipment_requirements.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={row.equipment_id}
                    onChange={(e) => updateEqRow(i, { equipment_id: e.target.value })}
                    className="flex-1 h-9 px-3 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none bg-white"
                  >
                    {availableEquipment.map((eq) => (
                      <option key={eq.id} value={eq.id}>{eq.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={row.quantity_needed}
                    onChange={(e) => updateEqRow(i, { quantity_needed: Number(e.target.value) })}
                    className="w-16 h-9 px-2 text-sm border border-[rgba(2,9,5,0.15)] rounded-[6px] focus:outline-none text-center"
                  />
                  <button
                    type="button"
                    onClick={() => removeEqRow(i)}
                    className="size-7 flex items-center justify-center text-[rgba(2,9,5,0.3)] hover:text-red-500 transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addEquipmentRow}
                className="self-start text-xs text-[#1069d1] hover:underline mt-1"
              >
                + Add equipment requirement
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button type="submit" disabled={isPending} className={`flex-1 ${BTN_PRIMARY}`}>
            {isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Services tab ─────────────────────────────────────────────────────────────

function ServicesTab({ businessId }: { businessId: string }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<'add' | { edit: Service } | { delete: Service } | null>(null)

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services', businessId],
    queryFn: () => listServices(businessId),
    enabled: !!businessId,
  })

  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment', businessId],
    queryFn: () => listEquipment(businessId),
    enabled: !!businessId,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['services', businessId] })

  const addMutation = useMutation({
    mutationFn: (body: ServiceCreateBody) => createService(businessId, body),
    onSuccess: () => { invalidate(); setDialog(null) },
  })

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ServiceCreateBody }) => updateService(id, body),
    onSuccess: () => { invalidate(); setDialog(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: () => { invalidate(); setDialog(null) },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[rgba(2,9,5,0.5)]">Manage your business service catalog</p>
        <button onClick={() => setDialog('add')} className={BTN_PRIMARY}>
          <Plus className="size-4" />
          Add service
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16 text-[rgba(2,9,5,0.4)]">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {!isLoading && services.length === 0 && (
        <div className="text-center py-16">
          <Package className="size-10 mx-auto mb-3 text-[rgba(2,9,5,0.15)]" />
          <p className="text-[rgba(2,9,5,0.5)] text-sm">No services yet.</p>
        </div>
      )}

      {services.length > 0 && (
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg divide-y divide-[rgba(2,9,5,0.06)]">
          {services.map((svc) => (
            <div key={svc.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#020905]">{svc.name}</p>
                <p className="text-xs text-[rgba(2,9,5,0.45)] mt-0.5">
                  {svc.duration_minutes} min · {svc.price} {svc.currency}
                  {(svc.equipment_requirements?.length ?? 0) > 0 &&
                    ` · ${svc.equipment_requirements!.length} equipment req.`}
                </p>
              </div>
              <button
                title={`Edit ${svc.name}`}
                onClick={() => setDialog({ edit: svc })}
                className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:text-[#1069d1] hover:bg-[#e7f0fa] transition-colors"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                title={`Delete ${svc.name}`}
                onClick={() => setDialog({ delete: svc })}
                className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add dialog */}
      {dialog === 'add' && (
        <ServiceDialog
          availableEquipment={equipment}
          onSave={(body) => addMutation.mutate(body)}
          onClose={() => setDialog(null)}
          isPending={addMutation.isPending}
        />
      )}

      {/* Edit dialog */}
      {dialog !== null && typeof dialog === 'object' && 'edit' in dialog && (
        <ServiceDialog
          initial={dialog.edit}
          availableEquipment={equipment}
          onSave={(body) => editMutation.mutate({ id: dialog.edit.id, body })}
          onClose={() => setDialog(null)}
          isPending={editMutation.isPending}
        />
      )}

      {/* Delete dialog */}
      {dialog !== null && typeof dialog === 'object' && 'delete' in dialog && (
        <DeleteConfirmDialog
          label={dialog.delete.name}
          isPending={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(dialog.delete.id)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function EquipmentServices() {
  const businessId = useSpaceStore((s) => s.businessId)
  const [tab, setTab] = useState<'equipment' | 'services'>('equipment')

  const tabBase =
    'h-9 px-4 text-sm font-medium rounded-[6px] transition-colors'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-heading font-semibold text-xl text-[#020905]">Equipment & Services</p>
          <p className="text-sm text-[rgba(2,9,5,0.5)] mt-0.5">
            Manage your business catalog
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[rgba(2,9,5,0.04)] rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('equipment')}
          className={`${tabBase} ${
            tab === 'equipment'
              ? 'bg-white text-[#020905] shadow-sm'
              : 'text-[rgba(2,9,5,0.5)] hover:text-[#020905]'
          }`}
        >
          Equipment
        </button>
        <button
          onClick={() => setTab('services')}
          className={`${tabBase} ${
            tab === 'services'
              ? 'bg-white text-[#020905] shadow-sm'
              : 'text-[rgba(2,9,5,0.5)] hover:text-[#020905]'
          }`}
        >
          Services
        </button>
      </div>

      {/* Tab content */}
      {businessId ? (
        tab === 'equipment' ? (
          <EquipmentTab businessId={businessId} />
        ) : (
          <ServicesTab businessId={businessId} />
        )
      ) : (
        <p className="text-sm text-[rgba(2,9,5,0.5)]">Select a business to manage its catalog.</p>
      )}
    </div>
  )
}
