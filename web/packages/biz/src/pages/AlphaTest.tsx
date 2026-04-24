import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type ApiError } from '@bookit/shared/api'

const INPUT =
  'w-full px-4 py-3 text-base text-[#020905] placeholder:text-[rgba(2,9,5,0.4)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors bg-white'

export function AlphaTest() {
  const [email, setEmail] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const { error: apiError } = await api.POST('/api/v1/alpha-access', {
        body: { email, company_name: companyName, description },
      })
      if (apiError) {
        const err = apiError as ApiError
        setError(err.detail ?? err.title ?? 'Something went wrong. Please try again.')
      } else {
        setSuccess(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border-b border-[rgba(2,9,5,0.08)] h-[64px] flex items-center px-8">
        <div className="max-w-[1280px] mx-auto w-full flex items-center justify-between">
          <Link to="/" className="font-heading font-semibold text-lg text-[#020905]">
            Bookit Business
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-[#1069d1] hover:underline"
          >
            Login
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[480px]">
          {success ? (
            <div className="bg-white border border-[rgba(2,9,5,0.15)] rounded-xl p-10 text-center">
              <div className="size-14 bg-[#e7f0fa] rounded-full flex items-center justify-center mx-auto mb-5">
                <svg className="size-7 text-[#1069d1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-heading font-semibold text-xl text-[#020905] mb-2">
                Request received!
              </p>
              <p className="text-[rgba(2,9,5,0.6)] text-sm leading-relaxed">
                Thank you! We've received your request and will be in touch.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[rgba(2,9,5,0.15)] rounded-xl p-8">
              <div className="mb-7">
                <p className="font-heading font-semibold text-[28px] leading-[1.2] text-[#020905] mb-2">
                  Request alpha access
                </p>
                <p className="text-sm text-[rgba(2,9,5,0.6)]">
                  We're onboarding a limited number of businesses. Tell us about yourself and we'll be in touch.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error && (
                  <div className="px-4 py-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-[6px]">
                    {error}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <label htmlFor="alpha-email" className="text-sm font-medium text-[#020905]">
                    Email
                  </label>
                  <input
                    id="alpha-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className={INPUT}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="alpha-company" className="text-sm font-medium text-[#020905]">
                    Company name
                  </label>
                  <input
                    id="alpha-company"
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Fitness"
                    className={INPUT}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="alpha-desc" className="text-sm font-medium text-[#020905]">
                    Description
                  </label>
                  <textarea
                    id="alpha-desc"
                    required
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us about your business and what you're looking to achieve"
                    className="w-full px-4 py-3 text-base text-[#020905] placeholder:text-[rgba(2,9,5,0.4)] border-2 border-[rgba(2,9,5,0.15)] rounded-[6px] outline-none focus:border-[#1069d1] transition-colors bg-white resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 text-base font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? 'Sending…' : 'Request access'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
