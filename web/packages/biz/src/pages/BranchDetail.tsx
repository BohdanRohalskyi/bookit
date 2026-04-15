import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Phone, Mail, Clock, Pencil,
  Building2, Users, Wrench, CalendarDays,
} from 'lucide-react'
import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'

type Branch = components['schemas']['Branch']
type BranchPhoto = components['schemas']['BranchPhoto']

// ─── Local types for catalog items ────────────────────────────────────────────

interface BranchEquipmentItem {
  id: string; equipment_name: string; quantity: number
}
interface BranchStaffRoleItem {
  id: string; job_title: string; quantity: number
}
interface BranchServiceItem {
  id: string
  service: { id: string; name: string; duration_minutes: number; price: number; currency: string }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BranchDetail() {
  const { businessId, branchId } = useParams<{ businessId: string; branchId: string }>()

  const { data: branch, isLoading } = useQuery({
    queryKey: ['branch', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}', {
        params: { path: { id: branchId! } },
      })
      return (data as Branch | null)
    },
    enabled: Boolean(branchId),
  })

  const { data: photos } = useQuery({
    queryKey: ['branch-photos', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/photos', {
        params: { path: { id: branchId! } },
      })
      return (data as { data: BranchPhoto[] } | null)?.data ?? []
    },
    enabled: Boolean(branchId),
  })

  const { data: schedule } = useQuery({
    queryKey: ['schedule', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/schedule', {
        params: { path: { id: branchId! } },
      })
      return data ?? null
    },
    enabled: Boolean(branchId),
  })

  const { data: branchEquipment } = useQuery({
    queryKey: ['branch-equipment', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/equipment', {
        params: { path: { id: branchId! } },
      })
      return (data as { data: BranchEquipmentItem[] } | null)?.data ?? []
    },
    enabled: Boolean(branchId),
  })

  const { data: branchStaffRoles } = useQuery({
    queryKey: ['branch-staff-roles', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/staff-roles', {
        params: { path: { id: branchId! } },
      })
      return (data as { data: BranchStaffRoleItem[] } | null)?.data ?? []
    },
    enabled: Boolean(branchId),
  })

  const { data: branchServices } = useQuery({
    queryKey: ['branch-services', branchId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/branches/{id}/services', {
        params: { path: { id: branchId! } },
      })
      return (data as { data: BranchServiceItem[] } | null)?.data ?? []
    },
    enabled: Boolean(branchId),
  })

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  if (isLoading) {
    return (
      <div className="max-w-3xl flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 h-24 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!branch) return null

  const openDays = schedule?.days?.filter((d) => d.is_open) ?? []

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to={`/dashboard/businesses/${businessId}/branches`}
            className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors mb-3"
          >
            <ArrowLeft className="size-4" />
            Branches
          </Link>
          <p className="font-heading font-semibold text-2xl text-[#020905]">{branch.name}</p>
          <div className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)] mt-1">
            <MapPin className="size-3.5" />
            {branch.address}, {branch.city}
          </div>
        </div>
        <Link
          to={`/dashboard/businesses/${businessId}/branches/${branchId}/edit`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors shrink-0"
        >
          <Pencil className="size-4" />
          Edit
        </Link>
      </div>

      {/* Photos */}
      {photos && photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {photos.slice(0, 8).map((photo: BranchPhoto) => (
            <img
              key={photo.id}
              src={photo.url}
              alt=""
              className="aspect-square w-full object-cover rounded-lg border border-[rgba(2,9,5,0.08)]"
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 grid grid-cols-2 gap-4">
        {branch.phone && (
          <div className="flex items-center gap-2 text-sm text-[rgba(2,9,5,0.6)]">
            <Phone className="size-4 shrink-0" />
            {branch.phone}
          </div>
        )}
        {branch.email && (
          <div className="flex items-center gap-2 text-sm text-[rgba(2,9,5,0.6)]">
            <Mail className="size-4 shrink-0" />
            {branch.email}
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-[rgba(2,9,5,0.6)]">
          <Clock className="size-4 shrink-0" />
          {branch.timezone}
        </div>
        <div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            branch.is_active
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}>
            {branch.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Schedule summary */}
      {openDays.length > 0 && (
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="size-4 text-[rgba(2,9,5,0.4)]" />
            <p className="font-heading font-semibold text-base text-[#020905]">Schedule</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {openDays.map((d) => (
              <div key={d.day_of_week} className="px-3 py-2 bg-[#f8f9fa] rounded-[6px]">
                <p className="text-xs font-medium text-[#020905]">{DAY_LABELS[d.day_of_week]}</p>
                <p className="text-xs text-[rgba(2,9,5,0.5)] mt-0.5">
                  {d.open_time} – {d.close_time}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Equipment & staff summary */}
      {((branchEquipment ?? []).length > 0 || (branchStaffRoles ?? []).length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(branchEquipment ?? []).length > 0 && (
            <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="size-4 text-[rgba(2,9,5,0.4)]" />
                <p className="font-heading font-semibold text-sm text-[#020905]">Equipment</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {(branchEquipment ?? []).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#020905]">{e.equipment_name}</span>
                    <span className="text-[rgba(2,9,5,0.4)] text-xs">×{e.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {(branchStaffRoles ?? []).length > 0 && (
            <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="size-4 text-[rgba(2,9,5,0.4)]" />
                <p className="font-heading font-semibold text-sm text-[#020905]">Staff Roles</p>
              </div>
              <div className="flex flex-col gap-1.5">
                {(branchStaffRoles ?? []).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-[#020905]">{s.job_title}</span>
                    <span className="text-[rgba(2,9,5,0.4)] text-xs">{s.quantity} person{s.quantity !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Services */}
      {(branchServices ?? []).length > 0 && (
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="size-4 text-[rgba(2,9,5,0.4)]" />
            <p className="font-heading font-semibold text-base text-[#020905]">Services</p>
          </div>
          <div className="flex flex-col gap-2">
            {(branchServices ?? []).map((bs) => (
              <div key={bs.id} className="flex items-center justify-between px-4 py-3 bg-[#f8f9fa] rounded-lg">
                <p className="text-sm font-medium text-[#020905]">{bs.service.name}</p>
                <div className="flex items-center gap-3 text-xs text-[rgba(2,9,5,0.5)]">
                  <span>{bs.service.duration_minutes} min</span>
                  <span>{bs.service.price} {bs.service.currency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
