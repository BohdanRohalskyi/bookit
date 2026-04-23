import type { components } from '@bookit/shared/api'

type ServiceSearchResult = components['schemas']['ServiceSearchResult']

const CATEGORY_BADGE: Record<string, { label: string; className: string }> = {
  beauty:   { label: 'Beauty',   className: 'bg-rose-50 text-rose-600 border border-rose-100' },
  sport:    { label: 'Sport',    className: 'bg-blue-50 text-blue-600 border border-blue-100' },
  pet_care: { label: 'Pet care', className: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
}

const CATEGORY_EMOJI: Record<string, string> = {
  beauty:   '💇',
  sport:    '🏃',
  pet_care: '🐾',
}

export function ServiceCard({ service }: { service: ServiceSearchResult }) {
  const badge = CATEGORY_BADGE[service.category]

  return (
    <div className="flex gap-4 p-5 bg-white border border-slate-100 rounded-2xl hover:border-slate-200 hover:shadow-sm transition-all">
      {/* Cover image */}
      <div className="size-20 shrink-0 rounded-xl bg-slate-100 overflow-hidden">
        {service.cover_image_url ? (
          <img
            src={service.cover_image_url}
            alt={service.business_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {CATEGORY_EMOJI[service.category] ?? '📅'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{service.name}</p>
            <p className="text-sm text-slate-500 truncate">
              {service.business_name}
              {service.city ? ` · ${service.city}` : ''}
            </p>
          </div>
          {badge && (
            <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>

        {service.description && (
          <p className="text-sm text-slate-400 mt-1.5 line-clamp-1">{service.description}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>{service.duration_minutes} min</span>
            <span className="text-slate-300">·</span>
            <span className="font-semibold text-slate-900">€{Number(service.price).toFixed(2)}</span>
          </div>
          <button className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors">
            Book now
          </button>
        </div>
      </div>
    </div>
  )
}

export function ServiceCardSkeleton() {
  return (
    <div className="flex gap-4 p-5 bg-white border border-slate-100 rounded-2xl animate-pulse">
      <div className="size-20 shrink-0 rounded-xl bg-slate-100" />
      <div className="flex-1 flex flex-col gap-2.5 py-1">
        <div className="h-4 bg-slate-100 rounded w-1/3" />
        <div className="h-3 bg-slate-100 rounded w-1/4" />
        <div className="h-3 bg-slate-100 rounded w-2/3 mt-1" />
        <div className="flex items-center justify-between mt-auto">
          <div className="h-4 bg-slate-100 rounded w-24" />
          <div className="h-8 bg-slate-100 rounded w-24" />
        </div>
      </div>
    </div>
  )
}
