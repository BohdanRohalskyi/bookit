import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, PlusCircle, Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'
import { EditBusinessModal } from '../components/EditBusinessModal'

type Business = components['schemas']['Business']

// ─── Category labels ──────────────────────────────────────────────────────────

const categoryLabels: Record<string, string> = {
  beauty: 'Beauty',
  sport: 'Sport',
  pet_care: 'Pet Care',
}

// ─── Business card ────────────────────────────────────────────────────────────

interface BusinessCardProps {
  business: Business
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}

function BusinessCard({ business, onEdit, onDelete, isDeleting }: BusinessCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg overflow-hidden flex flex-col">
      {/* Logo banner */}
      {business.logo_url ? (
        <img
          src={business.logo_url}
          alt={`${business.name} logo`}
          className="w-full h-32 object-cover"
        />
      ) : (
        <div className="w-full h-32 bg-[#e7f0fa] flex items-center justify-center">
          <Building2 className="size-10 text-[#1069d1]" strokeWidth={1.5} />
        </div>
      )}

      <div className="p-6 flex flex-col gap-4 flex-1">
        {/* Info */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5 min-w-0">
            <p className="font-heading font-semibold text-[#020905] truncate">{business.name}</p>
            <span className="text-xs text-[rgba(2,9,5,0.5)] bg-[#f2f2f2] rounded px-2 py-0.5 w-fit capitalize">
              {categoryLabels[business.category] ?? business.category}
            </span>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
              business.is_active
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-100 text-gray-500 border border-gray-200'
            }`}
          >
            {business.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>

        {business.description && (
          <p className="text-sm text-[rgba(2,9,5,0.6)] leading-relaxed line-clamp-2">
            {business.description}
          </p>
        )}

        {/* Delete confirm */}
        {confirmDelete && (
          <div className="flex flex-col gap-3 p-3 bg-red-50 border border-red-200 rounded-[6px]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-700 font-medium">Delete "{business.name}"?</p>
            </div>
            <p className="text-xs text-red-600">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                disabled={isDeleting}
                className="flex-1 py-1.5 text-xs font-medium text-white bg-red-600 rounded-[4px] hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-1.5 text-xs font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[4px] hover:bg-black/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[rgba(2,9,5,0.06)] mt-auto">
          <p className="text-xs text-[rgba(2,9,5,0.35)]">
            Added{' '}
            {new Date(business.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[rgba(2,9,5,0.6)] rounded-[4px] hover:bg-black/5 hover:text-[#020905] transition-colors"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isDeleting}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[rgba(2,9,5,0.4)] rounded-[4px] hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg overflow-hidden animate-pulse">
      <div className="w-full h-32 bg-gray-100" />
      <div className="p-6 flex flex-col gap-3">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Businesses() {
  const queryClient = useQueryClient()
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/businesses')
      return data ?? null
    },
  })

  const { mutate: deleteBusiness } = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id)
      const { error } = await api.DELETE('/api/v1/businesses/{id}', {
        params: { path: { id } },
      })
      if (error) throw error
    },
    onSettled: () => setDeletingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['businesses'] }),
  })

  const businesses = data?.data ?? []

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-heading font-semibold text-2xl text-[#020905]">Manage Businesses</p>
            {!isLoading && (
              <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1">
                {businesses.length === 0
                  ? 'No businesses yet'
                  : `${businesses.length} business${businesses.length === 1 ? '' : 'es'}`}
              </p>
            )}
          </div>
          <Link
            to="/dashboard/businesses/new"
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors shrink-0"
          >
            <PlusCircle className="size-4" />
            Add Business
          </Link>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton /><Skeleton /><Skeleton />
          </div>
        ) : businesses.length === 0 ? (
          <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg flex flex-col items-center gap-5 py-24 text-center">
            <Building2 className="size-12 text-[rgba(2,9,5,0.15)]" strokeWidth={1.5} />
            <div>
              <p className="font-heading font-semibold text-lg text-[#020905]">No businesses yet</p>
              <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1 max-w-xs mx-auto">
                Create your first business to start accepting bookings from clients
              </p>
            </div>
            <Link
              to="/dashboard/businesses/new"
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
            >
              <PlusCircle className="size-4" />
              Add your first business
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {businesses.map((biz) => (
              <BusinessCard
                key={biz.id}
                business={biz}
                onEdit={() => setEditingBusiness(biz)}
                onDelete={() => deleteBusiness(biz.id)}
                isDeleting={deletingId === biz.id}
              />
            ))}
          </div>
        )}
      </div>

      {editingBusiness && (
        <EditBusinessModal
          business={editingBusiness}
          onClose={() => setEditingBusiness(null)}
        />
      )}
    </>
  )
}
