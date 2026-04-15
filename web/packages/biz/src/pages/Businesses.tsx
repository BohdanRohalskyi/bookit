import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, PlusCircle, Pencil } from 'lucide-react'
import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'

type Business = components['schemas']['Business']

// ─── Category labels ──────────────────────────────────────────────────────────

const categoryLabels: Record<string, string> = {
  beauty: 'Beauty',
  sport: 'Sport',
  pet_care: 'Pet Care',
}

// ─── Business card ────────────────────────────────────────────────────────────

function BusinessCard({ business }: { business: Business }) {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 flex flex-col gap-4">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="size-12 bg-[#e7f0fa] rounded-lg flex items-center justify-center shrink-0">
          <Building2 className="size-6 text-[#1069d1]" />
        </div>
        <span
          className={`text-xs px-2.5 py-1 rounded-full font-medium mt-0.5 ${
            business.is_active
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-gray-100 text-gray-500 border border-gray-200'
          }`}
        >
          {business.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-2">
        <p className="font-heading font-semibold text-[#020905]">{business.name}</p>
        <span className="text-xs text-[rgba(2,9,5,0.5)] bg-[#f2f2f2] rounded px-2 py-0.5 w-fit capitalize">
          {categoryLabels[business.category] ?? business.category}
        </span>
        {business.description && (
          <p className="text-sm text-[rgba(2,9,5,0.6)] leading-relaxed line-clamp-2">
            {business.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[rgba(2,9,5,0.06)] mt-auto">
        <p className="text-xs text-[rgba(2,9,5,0.35)]">
          Added{' '}
          {new Date(business.created_at).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
        <button
          disabled
          title="Coming soon"
          className="flex items-center gap-1.5 text-xs font-medium text-[rgba(2,9,5,0.3)] cursor-not-allowed"
        >
          <Pencil className="size-3.5" />
          Edit
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 animate-pulse flex flex-col gap-4">
      <div className="size-12 bg-gray-100 rounded-lg" />
      <div className="flex flex-col gap-2">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Businesses() {
  const { data, isLoading } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/businesses')
      return data ?? null
    },
  })

  const businesses = data?.data ?? []

  return (
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
          <Skeleton />
          <Skeleton />
          <Skeleton />
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
            <BusinessCard key={biz.id} business={biz} />
          ))}
        </div>
      )}
    </div>
  )
}
