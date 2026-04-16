import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@bookit/shared/api'
import type { components } from '@bookit/shared/api'

type ScheduleDay = components['schemas']['ScheduleDay']

const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

interface LocalDay {
  day_of_week: number
  is_open: boolean
  open_time: string
  close_time: string
}

interface Props {
  locationId: string
  onNext: () => void
  onBack: () => void
}

export function StepSchedule({ locationId, onNext, onBack }: Props) {
  const queryClient = useQueryClient()
  const [days, setDays] = useState<LocalDay[] | null>(null)
  const [saved, setSaved] = useState(false)

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', locationId],
    queryFn: async () => {
      const { data } = await api.GET('/api/v1/locations/{id}/schedule', {
        params: { path: { id: locationId } },
      })
      return data ?? null
    },
  })

  const effectiveDays: LocalDay[] =
    days ??
    (schedule?.days?.map((d: ScheduleDay) => ({
      day_of_week: d.day_of_week,
      is_open: d.is_open,
      open_time: d.open_time ?? '09:00',
      close_time: d.close_time ?? '18:00',
    })) ??
      Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        is_open: i < 5,
        open_time: '09:00',
        close_time: '18:00',
      })))

  const updateDay = (idx: number, patch: Partial<LocalDay>) =>
    setDays(effectiveDays.map((d, i) => (i === idx ? { ...d, ...patch } : d)))

  const { mutate: save, isPending } = useMutation({
    mutationFn: async () => {
      const { error } = await api.PUT('/api/v1/locations/{id}/schedule/days', {
        params: { path: { id: locationId } },
        body: {
          days: effectiveDays.map((d) => ({
            day_of_week: d.day_of_week,
            is_open: d.is_open,
            open_time: d.is_open ? d.open_time : null,
            close_time: d.is_open ? d.close_time : null,
          })),
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', locationId] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleSaveAndNext = () => {
    save(undefined, { onSuccess: onNext })
  }

  if (isLoading) {
    return (
      <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8 animate-pulse">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded mb-2" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-white border border-[rgba(2,9,5,0.08)] rounded-lg p-8 flex flex-col gap-6">
      <div>
        <p className="font-heading font-semibold text-lg text-[#020905] mb-1">Working Schedule</p>
        <p className="text-sm text-[rgba(2,9,5,0.45)]">
          Set the regular weekly schedule for this location
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {effectiveDays.map((day, idx) => (
          <div
            key={day.day_of_week}
            className="flex items-center gap-4 py-3 px-4 bg-[#f8f9fa] rounded-lg"
          >
            <span className="text-sm font-medium text-[#020905] w-24 shrink-0">
              {DAY_LABELS[day.day_of_week]}
            </span>

            <button
              type="button"
              onClick={() => updateDay(idx, { is_open: !day.is_open })}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
                day.is_open ? 'bg-[#1069d1]' : 'bg-[rgba(2,9,5,0.15)]'
              }`}
            >
              <span
                className={`absolute top-1 left-1 size-4 bg-white rounded-full shadow transition-transform ${
                  day.is_open ? 'translate-x-4' : ''
                }`}
              />
            </button>

            {day.is_open ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={day.open_time}
                  onChange={(e) => updateDay(idx, { open_time: e.target.value })}
                  placeholder="09:00"
                  className="w-20 px-3 py-1.5 text-sm text-[#020905] bg-white border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
                />
                <span className="text-sm text-[rgba(2,9,5,0.4)]">–</span>
                <input
                  type="text"
                  value={day.close_time}
                  onChange={(e) => updateDay(idx, { close_time: e.target.value })}
                  placeholder="18:00"
                  className="w-20 px-3 py-1.5 text-sm text-[#020905] bg-white border border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1]"
                />
              </div>
            ) : (
              <span className="text-sm text-[rgba(2,9,5,0.35)] flex-1">Closed</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-[rgba(2,9,5,0.6)] hover:text-[#020905] transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => save()}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 disabled:opacity-60 transition-colors"
          >
            {saved && <Check className="size-4 text-green-600" />}
            {isPending ? 'Saving…' : saved ? 'Saved!' : 'Save'}
          </button>
          <button
            onClick={handleSaveAndNext}
            disabled={isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 transition-colors"
          >
            Save & Continue
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
