import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { api } from '@bookit/shared/api'

// ─── Local types (matching API response shapes) ────────────────────────────────

interface EquipmentItem {
  id: string
  business_id: string
  name: string
  created_at: string
}

interface StaffRoleItem {
  id: string
  business_id: string
  job_title: string
  created_at: string
}

interface BranchEquipmentItem {
  id: string
  branch_id: string
  equipment_id: string
  equipment_name: string
  quantity: number
}

interface BranchStaffRoleItem {
  id: string
  branch_id: string
  staff_role_id: string
  job_title: string
  quantity: number
}

// ─── Equipment section ────────────────────────────────────────────────────────

function EquipmentSection({ businessId, branchId }: { businessId: string; branchId: string }) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [selectedId, setSelectedId] = useState('')
  const [newName, setNewName] = useState('')
  const [quantity, setQuantity] = useState(1)

  const { data: catalog } = useQuery({
    queryKey: ['equipment-catalog', businessId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/equipment', {
        params: { query: { business_id: businessId } },
      })
      return (data as { data: EquipmentItem[] } | null)?.data ?? []
    },
  })

  const { data: branchItems } = useQuery({
    queryKey: ['branch-equipment', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/equipment', {
        params: { path: { id: branchId } },
      })
      return (data as { data: BranchEquipmentItem[] } | null)?.data ?? []
    },
  })

  const { mutate: addToBranch, isPending: adding } = useMutation({
    mutationFn: async (equipmentId: string) => {
      const { error } = await api.POST('/api/v1/branches/{id}/equipment', {
        params: { path: { id: branchId } },
        body: { equipment_id: equipmentId, quantity },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-equipment', branchId] })
      setShowAdd(false)
      setSelectedId('')
      setQuantity(1)
      setNewName('')
    },
  })

  const { mutate: createAndAdd, isPending: creating } = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/equipment', {
        body: { business_id: businessId, name: newName.trim() },
      })
      if (error) throw error
      return (data as EquipmentItem).id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-catalog', businessId] })
      addToBranch(id)
    },
  })

  const { mutate: removeFromBranch } = useMutation({
    mutationFn: async (itemId: string) => {
      await api.DELETE('/api/v1/branches/{id}/equipment/{item_id}', {
        params: { path: { id: branchId, item_id: itemId } },
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['branch-equipment', branchId] }),
  })

  const items = branchItems ?? []
  const catalogItems = catalog ?? []
  const usedIds = new Set(items.map((i) => i.equipment_id))
  const available = catalogItems.filter((e) => !usedIds.has(e.id))
  const isPending = adding || creating

  return (
    <div className="flex flex-col gap-4">
      {/* Branch equipment list */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-3 bg-[#f8f9fa] rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-[#020905]">{item.equipment_name}</p>
                <p className="text-xs text-[rgba(2,9,5,0.45)]">{item.quantity} unit{item.quantity !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => removeFromBranch(item.id)}
                className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd ? (
        <div className="p-4 border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-lg flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('select')}
              className={`text-xs px-3 py-1.5 rounded-[4px] transition-colors ${mode === 'select' ? 'bg-[#1069d1] text-white' : 'bg-[rgba(2,9,5,0.06)] text-[rgba(2,9,5,0.6)]'}`}
            >
              Pick existing
            </button>
            <button
              onClick={() => setMode('create')}
              className={`text-xs px-3 py-1.5 rounded-[4px] transition-colors ${mode === 'create' ? 'bg-[#1069d1] text-white' : 'bg-[rgba(2,9,5,0.06)] text-[rgba(2,9,5,0.6)]'}`}
            >
              Create new
            </button>
          </div>

          <div className="flex items-center gap-3">
            {mode === 'select' ? (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] bg-white"
              >
                <option value="">Select equipment…</option>
                {available.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            ) : (
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Styling Chair"
                className="flex-1 px-3 py-2 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
              />
            )}
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-20 px-3 py-2 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => mode === 'select' ? addToBranch(selectedId) : createAndAdd()}
              disabled={isPending || (mode === 'select' ? !selectedId : !newName.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setSelectedId(''); setNewName(''); setQuantity(1) }}
              className="p-2 text-[rgba(2,9,5,0.4)] hover:text-[#020905] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[rgba(2,9,5,0.5)] border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-lg hover:border-[#1069d1] hover:text-[#1069d1] transition-colors w-fit"
        >
          <Plus className="size-4" />
          Add equipment
        </button>
      )}
    </div>
  )
}

// ─── Staff roles section ──────────────────────────────────────────────────────

function StaffRolesSection({ businessId, branchId }: { businessId: string; branchId: string }) {
  const queryClient = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [selectedId, setSelectedId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [quantity, setQuantity] = useState(1)

  const { data: catalog } = useQuery({
    queryKey: ['staff-roles-catalog', businessId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/staff-roles', {
        params: { query: { business_id: businessId } },
      })
      return (data as { data: StaffRoleItem[] } | null)?.data ?? []
    },
  })

  const { data: branchItems } = useQuery({
    queryKey: ['branch-staff-roles', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/staff-roles', {
        params: { path: { id: branchId } },
      })
      return (data as { data: BranchStaffRoleItem[] } | null)?.data ?? []
    },
  })

  const { mutate: addToBranch, isPending: adding } = useMutation({
    mutationFn: async (staffRoleId: string) => {
      const { error } = await api.POST('/api/v1/branches/{id}/staff-roles', {
        params: { path: { id: branchId } },
        body: { staff_role_id: staffRoleId, quantity },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-staff-roles', branchId] })
      setShowAdd(false)
      setSelectedId('')
      setQuantity(1)
      setNewTitle('')
    },
  })

  const { mutate: createAndAdd, isPending: creating } = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/api/v1/staff-roles', {
        body: { business_id: businessId, job_title: newTitle.trim() },
      })
      if (error) throw error
      return (data as StaffRoleItem).id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['staff-roles-catalog', businessId] })
      addToBranch(id)
    },
  })

  const { mutate: removeFromBranch } = useMutation({
    mutationFn: async (itemId: string) => {
      await api.DELETE('/api/v1/branches/{id}/staff-roles/{item_id}', {
        params: { path: { id: branchId, item_id: itemId } },
      })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['branch-staff-roles', branchId] }),
  })

  const items = branchItems ?? []
  const catalogItems = catalog ?? []
  const usedIds = new Set(items.map((i) => i.staff_role_id))
  const available = catalogItems.filter((r) => !usedIds.has(r.id))
  const isPending = adding || creating

  return (
    <div className="flex flex-col gap-4">
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-3 bg-[#f8f9fa] rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-[#020905]">{item.job_title}</p>
                <p className="text-xs text-[rgba(2,9,5,0.45)]">{item.quantity} person{item.quantity !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => removeFromBranch(item.id)}
                className="size-7 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.3)] hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd ? (
        <div className="p-4 border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-lg flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => setMode('select')}
              className={`text-xs px-3 py-1.5 rounded-[4px] transition-colors ${mode === 'select' ? 'bg-[#1069d1] text-white' : 'bg-[rgba(2,9,5,0.06)] text-[rgba(2,9,5,0.6)]'}`}
            >
              Pick existing
            </button>
            <button
              onClick={() => setMode('create')}
              className={`text-xs px-3 py-1.5 rounded-[4px] transition-colors ${mode === 'create' ? 'bg-[#1069d1] text-white' : 'bg-[rgba(2,9,5,0.06)] text-[rgba(2,9,5,0.6)]'}`}
            >
              Create new
            </button>
          </div>

          <div className="flex items-center gap-3">
            {mode === 'select' ? (
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="flex-1 px-3 py-2 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] bg-white"
              >
                <option value="">Select role…</option>
                {available.map((r) => (
                  <option key={r.id} value={r.id}>{r.job_title}</option>
                ))}
              </select>
            ) : (
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Hair Stylist"
                className="flex-1 px-3 py-2 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
              />
            )}
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-20 px-3 py-2 text-sm text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => mode === 'select' ? addToBranch(selectedId) : createAndAdd()}
              disabled={isPending || (mode === 'select' ? !selectedId : !newTitle.trim())}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 transition-colors"
            >
              {isPending ? 'Adding…' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAdd(false); setSelectedId(''); setNewTitle(''); setQuantity(1) }}
              className="p-2 text-[rgba(2,9,5,0.4)] hover:text-[#020905] transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[rgba(2,9,5,0.5)] border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-lg hover:border-[#1069d1] hover:text-[#1069d1] transition-colors w-fit"
        >
          <Plus className="size-4" />
          Add staff role
        </button>
      )}
    </div>
  )
}

// ─── Step ─────────────────────────────────────────────────────────────────────

interface Props {
  businessId: string
  branchId: string
  onNext: () => void
  onBack: () => void
}

export function StepTeamEquipment({ businessId, branchId, onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* Two columns: Equipment | Staff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equipment */}
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 flex flex-col gap-4">
          <div>
            <p className="font-heading font-semibold text-base text-[#020905]">Equipment</p>
            <p className="text-xs text-[rgba(2,9,5,0.45)] mt-0.5">
              Add equipment available at this branch with quantity
            </p>
          </div>
          <EquipmentSection businessId={businessId} branchId={branchId} />
        </div>

        {/* Staff roles */}
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 flex flex-col gap-4">
          <div>
            <p className="font-heading font-semibold text-base text-[#020905]">Staff Roles</p>
            <p className="text-xs text-[rgba(2,9,5,0.45)] mt-0.5">
              Add job roles and how many people fill each role
            </p>
          </div>
          <StaffRolesSection businessId={businessId} branchId={branchId} />
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[rgba(2,9,5,0.6)] hover:text-[#020905] transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
        >
          Continue to Services
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}
