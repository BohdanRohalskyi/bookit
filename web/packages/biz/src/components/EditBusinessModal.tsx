import { useRef, useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, ImagePlus } from 'lucide-react'
import { api, API_URL } from '@bookit/shared/api'
import { useAuthStore } from '@bookit/shared/stores'
import type { components } from '@bookit/shared/api'

type Business = components['schemas']['Business']

interface Props {
  business: Business
  onClose: () => void
}

export function EditBusinessModal({ business, onClose }: Props) {
  const queryClient = useQueryClient()

  const [name, setName] = useState(business.name)
  const [description, setDescription] = useState(business.description ?? '')
  const [isActive, setIsActive] = useState(business.is_active)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview)
    }
  }, [logoPreview])

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const removeLogo = () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const currentLogo = logoPreview ?? business.logo_url ?? null

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const nameChanged = name.trim() !== business.name
      const descChanged = (description || null) !== business.description
      const activeChanged = isActive !== business.is_active

      if (nameChanged || descChanged || activeChanged) {
        const { error } = await api.PUT('/api/v1/businesses/{id}', {
          params: { path: { id: business.id } },
          body: {
            ...(nameChanged ? { name: name.trim() } : {}),
            ...(descChanged ? { description: description || undefined } : {}),
            ...(activeChanged ? { is_active: isActive } : {}),
          },
        })
        if (error) throw error
      }

      if (!logoFile) return 'ok'

      if (logoFile) {
        const formData = new FormData()
        formData.append('file', logoFile)
        const token = useAuthStore.getState().getAccessToken()
        const res = await fetch(`${API_URL}/api/v1/businesses/${business.id}/logo`, {
          method: 'POST',
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) return 'logo_failed'
      }
      return 'ok'
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] })
      if (result === 'logo_failed') {
        setApiError('Details saved, but the logo could not be uploaded. Try again later.')
        return
      }
      onClose()
    },
    onError: () => {
      setApiError('Failed to save changes. Please try again.')
    },
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(2,9,5,0.08)]">
          <p className="font-heading font-semibold text-lg text-[#020905]">Edit Business</p>
          <button
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg text-[rgba(2,9,5,0.4)] hover:bg-black/5 hover:text-[#020905] transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 flex flex-col gap-5">
          {apiError && (
            <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
              {apiError}
            </div>
          )}

          {/* Logo */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">Logo</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex items-center gap-4">
              {currentLogo ? (
                <div className="relative size-20 shrink-0">
                  <img
                    src={currentLogo}
                    alt="Logo"
                    className="size-20 rounded-lg object-cover border-2 border-[rgba(2,9,5,0.15)]"
                  />
                  {logoFile && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 size-5 bg-[#020905] rounded-full flex items-center justify-center"
                    >
                      <X className="size-3 text-white" />
                    </button>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[rgba(2,9,5,0.5)] border-2 border-dashed border-[rgba(2,9,5,0.15)] rounded-[6px] hover:border-[#1069d1] hover:text-[#1069d1] transition-colors"
              >
                <ImagePlus className="size-4" />
                {currentLogo ? 'Replace' : 'Upload logo'}
              </button>
            </div>
            <p className="text-xs text-[rgba(2,9,5,0.35)]">JPEG, PNG or WebP · max 5 MB</p>
          </div>

          {/* Name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">Business name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 text-sm text-[#020905] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-[#020905]">
              Description <span className="text-[rgba(2,9,5,0.4)] font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 text-sm text-[#020905] placeholder:text-[rgba(2,9,5,0.35)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors resize-none"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-[#f8f9fa] rounded-[6px]">
            <div>
              <p className="text-sm font-medium text-[#020905]">Active</p>
              <p className="text-xs text-[rgba(2,9,5,0.45)] mt-0.5">
                Inactive businesses won't accept new bookings
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex size-12 w-10 h-6 items-center rounded-full transition-colors shrink-0 ${
                isActive ? 'bg-[#1069d1]' : 'bg-[rgba(2,9,5,0.15)]'
              }`}
            >
              <span
                className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[rgba(2,9,5,0.08)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { setApiError(null); mutate() }}
            disabled={isPending || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
