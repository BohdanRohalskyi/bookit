import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, CalendarCheck, TrendingUp, Users, PlusCircle, ChevronRight } from 'lucide-react'
import { api } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import { useMyRole } from '../hooks/useMyRole'
import type { components } from '@bookit/shared/api'

type Business = components['schemas']['Business']

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ElementType
  label: string
  value: string | number
  colorClass: string
}

function StatCard({ icon: Icon, label, value, colorClass }: StatCardProps) {
  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6 flex items-start gap-4">
      <div className={`size-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon className="size-5 text-white" />
      </div>
      <div>
        <p className="font-heading font-semibold text-2xl text-[#020905] leading-none">{value}</p>
        <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1">{label}</p>
      </div>
    </div>
  )
}

// ─── Business row ─────────────────────────────────────────────────────────────

const categoryLabels: Record<string, string> = {
  beauty: 'Beauty',
  sport: 'Sport',
  pet_care: 'Pet Care',
}

function BusinessRow({ business }: { business: Business }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="size-10 bg-[#e7f0fa] rounded-lg flex items-center justify-center shrink-0">
          <Building2 className="size-5 text-[#1069d1]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#020905]">{business.name}</p>
          <p className="text-xs text-[rgba(2,9,5,0.45)] capitalize mt-0.5">
            {categoryLabels[business.category] ?? business.category}
          </p>
        </div>
      </div>
      <span
        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          business.is_active
            ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-gray-100 text-gray-500 border border-gray-200'
        }`}
      >
        {business.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuthStore()
  const { isOwner } = useMyRole()

  const { data: businessList, isLoading } = useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/businesses')
      return data ?? null
    },
  })

  const businesses = businessList?.data ?? []

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <p className="font-heading font-semibold text-2xl text-[#020905]">
          Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </p>
        <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1">
          Here's an overview of your businesses
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={Building2}
          label="Businesses"
          value={isLoading ? '—' : businesses.length}
          colorClass="bg-[#1069d1]"
        />
        <StatCard icon={CalendarCheck} label="Total Bookings" value="—" colorClass="bg-emerald-500" />
        <StatCard icon={TrendingUp} label="Revenue this month" value="—" colorClass="bg-violet-500" />
        <StatCard icon={Users} label="Team Members" value="—" colorClass="bg-amber-500" />
      </div>

      {/* Businesses panel */}
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(2,9,5,0.06)]">
          <p className="font-heading font-semibold text-base text-[#020905]">Your Businesses</p>
          {isOwner && (
            <Link
              to="/dashboard/businesses/new"
              className="flex items-center gap-1.5 text-sm font-medium text-[#1069d1] hover:underline"
            >
              <PlusCircle className="size-4" />
              Add Business
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <p className="text-sm text-[rgba(2,9,5,0.4)]">Loading…</p>
          </div>
        ) : businesses.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 px-6 text-center">
            <Building2 className="size-10 text-[rgba(2,9,5,0.15)]" strokeWidth={1.5} />
            <div>
              <p className="font-medium text-[#020905]">No businesses yet</p>
              <p className="text-sm text-[rgba(2,9,5,0.45)] mt-1">
                Add your first business to start accepting bookings
              </p>
            </div>
            {isOwner && (
              <Link
                to="/dashboard/businesses/new"
                className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
              >
                Add Business
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[rgba(2,9,5,0.05)]">
            {businesses.slice(0, 5).map((biz) => (
              <BusinessRow key={biz.id} business={biz} />
            ))}
            {businesses.length > 5 && (
              <div className="px-6 py-3">
                <Link
                  to="/dashboard/businesses"
                  className="flex items-center gap-1 text-sm text-[#1069d1] hover:underline"
                >
                  View all {businesses.length} businesses
                  <ChevronRight className="size-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coming-soon placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { label: 'Upcoming Bookings', description: 'Booking management coming soon' },
          { label: 'Recent Activity', description: 'Activity feed coming soon' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-6"
          >
            <p className="font-heading font-semibold text-base text-[#020905] mb-1">{s.label}</p>
            <p className="text-sm text-[rgba(2,9,5,0.35)]">{s.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
