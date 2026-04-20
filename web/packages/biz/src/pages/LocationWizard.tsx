import { useState } from 'react'
import { useParams, useNavigate, Link, Navigate } from 'react-router-dom'
import { Check, ArrowLeft } from 'lucide-react'
import { useSpaceStore } from '../stores/spaceStore'
import { useMyRole } from '../hooks/useMyRole'
import { StepBasicInfo } from '../components/wizard/StepBasicInfo'
import { StepSchedule } from '../components/wizard/StepSchedule'
import { StepTeamEquipment } from '../components/wizard/StepTeamEquipment'
import { StepServices } from '../components/wizard/StepServices'

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Info & Photos' },
  { label: 'Schedule' },
  { label: 'Team & Equipment' },
  { label: 'Services' },
]

interface TabProps {
  num: number
  label: string
  active: boolean
  done: boolean
  enabled: boolean
  onClick: () => void
}

function Tab({ num, label, active, done, enabled, onClick }: TabProps) {
  return (
    <button
      onClick={onClick}
      disabled={!enabled}
      className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
        active
          ? 'border-[#1069d1] text-[#1069d1]'
          : enabled
          ? 'border-transparent text-[rgba(2,9,5,0.5)] hover:text-[#020905] hover:border-[rgba(2,9,5,0.15)]'
          : 'border-transparent text-[rgba(2,9,5,0.2)] cursor-not-allowed'
      }`}
    >
      {done ? (
        <span className="size-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
          <Check className="size-3 text-green-600" />
        </span>
      ) : (
        <span
          className={`size-5 rounded-full text-xs flex items-center justify-center shrink-0 font-semibold ${
            active
              ? 'bg-[#1069d1] text-white'
              : 'bg-[rgba(2,9,5,0.08)] text-[rgba(2,9,5,0.4)]'
          }`}
        >
          {num}
        </span>
      )}
      {label}
    </button>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function LocationWizard() {
  const { locationId: paramLocationId } = useParams<{ locationId?: string }>()
  const navigate = useNavigate()
  const { businessId } = useSpaceStore()

  const isEdit = Boolean(paramLocationId)
  const { isOwner, isAdmin } = useMyRole()

  // Create: owner only. Edit: admin or owner.
  if (!isEdit && !isOwner) return <Navigate to="/dashboard/locations" replace />
  if (isEdit && !isAdmin) return <Navigate to="/dashboard/locations" replace />

  const [locationId, setLocationId] = useState<string | null>(paramLocationId ?? null)
  const [step, setStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    isEdit ? new Set([1]) : new Set()
  )

  const markComplete = (s: number) =>
    setCompletedSteps((prev) => new Set([...prev, s]))

  const canGoToStep = (s: number) => s === 1 || locationId !== null

  const goToStep = (s: number) => {
    if (canGoToStep(s)) setStep(s)
  }

  const handleLocationSaved = (id: string) => {
    setLocationId(id)
    markComplete(1)
    setStep(2)
  }

  const handleFinish = () => {
    navigate(`/dashboard/locations/${locationId}`)
  }

  return (
    <div className="flex flex-col gap-0 max-w-3xl">
      {/* Back link */}
      <Link
        to="/dashboard/locations"
        className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors mb-6"
      >
        <ArrowLeft className="size-4" />
        Locations
      </Link>

      <p className="font-heading font-semibold text-2xl text-[#020905] mb-6">
        {isEdit ? 'Edit Location' : 'New Location'}
      </p>

      {/* Tab bar */}
      <div className="flex border-b border-[rgba(2,9,5,0.08)] mb-8">
        {STEPS.map((s, idx) => {
          const num = idx + 1
          return (
            <Tab
              key={num}
              num={num}
              label={s.label}
              active={step === num}
              done={completedSteps.has(num)}
              enabled={canGoToStep(num)}
              onClick={() => goToStep(num)}
            />
          )
        })}
      </div>

      {/* Step content */}
      {step === 1 && (
        <StepBasicInfo
          businessId={businessId!}
          locationId={locationId}
          onSaved={handleLocationSaved}
        />
      )}
      {step === 2 && locationId && (
        <StepSchedule
          locationId={locationId}
          onNext={() => { markComplete(2); setStep(3) }}
          onBack={() => setStep(1)}
        />
      )}
      {step === 3 && locationId && (
        <StepTeamEquipment
          businessId={businessId!}
          locationId={locationId}
          onNext={() => { markComplete(3); setStep(4) }}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && locationId && (
        <StepServices
          businessId={businessId!}
          locationId={locationId}
          onFinish={handleFinish}
          onBack={() => setStep(3)}
        />
      )}
    </div>
  )
}
