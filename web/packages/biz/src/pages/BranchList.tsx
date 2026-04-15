import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, PlusCircle, Pencil, Trash2, AlertTriangle, GitBranch, ArrowLeft } from 'lucide-react'
import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'

type Branch = components['schemas']['Branch']

// ─── Branch card ──────────────────────────────────────────────────────────────

interface BranchCardProps {
  branch: Branch
  businessId: string
  onDelete: () => void
  isDeleting: boolean
}

function BranchCard({ branch, businessId, onDelete, isDeleting }: BranchCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="font-heading font-semibold text-[#020905]">{branch.name}</p>
          <div className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)]">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{branch.address}, {branch.city}</span>
          </div>
          {branch.phone && (
            <p className="text-xs text-[rgba(2,9,5,0.45)]">{branch.phone}</p>
          )}
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
          branch.is_active
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'
        }`}>
          {branch.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {confirmDelete && (
        <div className="flex flex-col gap-3 p-3 bg-red-50 border border-red-200 rounded-[6px]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-600 shrink-0" />
            <p className="text-xs text-red-700 font-medium">Delete "{branch.name}"?</p>
          </div>
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

      <div className="flex items-center justify-between pt-2 border-t border-[rgba(2,9,5,0.06)]">
        <Link
          to={`/dashboard/businesses/${businessId}/branches/${branch.id}`}
          className="text-xs font-medium text-[#1069d1] hover:underline"
        >
          Manage →
        </Link>
        <div className="flex items-center gap-1">
          <Link
            to={`/dashboard/businesses/${businessId}/branches/${branch.id}/edit`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[rgba(2,9,5,0.6)] rounded-[4px] hover:bg-black/5 hover:text-[#020905] transition-colors"
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
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
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 animate-pulse flex flex-col gap-3">
      <div className="h-4 bg-gray-100 rounded w-2/3" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BranchList() {
  const { businessId } = useParams<{ businessId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['branches', businessId],
    queryFn: async () => {
      if (!businessId) return null
      const { data } = await api.GET('/api/v1/branches', {
        params: { query: { business_id: businessId } },
      })
      return data ?? null
    },
    enabled: Boolean(businessId),
  })

  const { mutate: deleteBranch } = useMutation({
    mutationFn: async (id: string) => {
      setDeletingId(id)
      const { error } = await api.DELETE('/api/v1/branches/{id}', {
        params: { path: { id } },
      })
      if (error) throw error
    },
    onSettled: () => setDeletingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches', businessId] }),
  })

  const branches = data?.data ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/dashboard/businesses')}
            className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors mb-3"
          >
            <ArrowLeft className="size-4" />
            Businesses
          </button>
          <p className="font-heading font-semibold text-2xl text-[#020905]">Branches</p>
          {!isLoading && (
            <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1">
              {branches.length === 0 ? 'No branches yet' : `${branches.length} branch${branches.length === 1 ? '' : 'es'}`}
            </p>
          )}
        </div>
        <Link
          to={`/dashboard/businesses/${businessId}/branches/new`}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors shrink-0"
        >
          <PlusCircle className="size-4" />
          Add Branch
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      ) : branches.length === 0 ? (
        <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg flex flex-col items-center gap-5 py-24 text-center">
          <GitBranch className="size-12 text-[rgba(2,9,5,0.15)]" strokeWidth={1.5} />
          <div>
            <p className="font-heading font-semibold text-lg text-[#020905]">No branches yet</p>
            <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1 max-w-xs mx-auto">
              Add your first branch to define where clients can book appointments
            </p>
          </div>
          <Link
            to={`/dashboard/businesses/${businessId}/branches/new`}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
          >
            <PlusCircle className="size-4" />
            Add your first branch
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              businessId={businessId!}
              onDelete={() => deleteBranch(branch.id)}
              isDeleting={deletingId === branch.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
