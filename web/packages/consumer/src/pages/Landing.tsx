import { Link } from 'react-router-dom'
import { ChevronRight, Calendar, Clock, Star, Shield, Sparkles, Dumbbell, PawPrint } from 'lucide-react'
import { useAuthStore } from '@bookit/shared/stores'

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <span className="font-heading font-semibold text-lg text-slate-900">Bookit</span>

        <div className="hidden md:flex items-center gap-8">
          <a href="#how-it-works" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">How it works</a>
          <a href="#categories" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Services</a>
          <a href="#reviews" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">Reviews</a>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && user ? (
            <>
              <span className="text-sm text-slate-500 hidden md:block">{user.name}</span>
              <Link to="/account">
                <button className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-lg hover:bg-[#0d56b0] transition-colors">
                  My account
                </button>
              </Link>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
                  Log in
                </button>
              </Link>
              <Link to="/register">
                <button className="px-4 py-2 text-sm font-medium text-white bg-[#1069d1] rounded-lg hover:bg-[#0d56b0] transition-colors">
                  Sign up free
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const { isAuthenticated } = useAuthStore()

  return (
    <section className="bg-gradient-to-b from-[#f0f7ff] to-white px-6 md:px-10 pt-20 pb-28">
      <div className="max-w-[1200px] mx-auto flex flex-col items-center text-center gap-8">

        <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
          <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-slate-600">Available in Lithuania</span>
        </div>

        <div className="flex flex-col gap-5 max-w-[720px]">
          <p className="font-heading font-semibold text-[44px] md:text-[64px] leading-[1.1] tracking-[-1px] text-slate-900">
            Book beauty, sport & pet care — instantly
          </p>
          <p className="text-lg md:text-xl text-slate-500 leading-relaxed max-w-[540px] mx-auto">
            Find trusted local providers, pick a time that works for you, and confirm in seconds.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          {isAuthenticated ? (
            <Link to="/account">
              <button className="px-7 py-3.5 text-base font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors shadow-sm">
                Go to my account
              </button>
            </Link>
          ) : (
            <>
              <Link to="/register">
                <button className="px-7 py-3.5 text-base font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors shadow-sm">
                  Book your first appointment
                </button>
              </Link>
              <Link to="/login">
                <button className="px-7 py-3.5 text-base font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  Log in
                </button>
              </Link>
            </>
          )}
        </div>

        {/* Social proof strip */}
        <div className="flex items-center gap-6 flex-wrap justify-center pt-4">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
            ))}
            <span className="text-sm text-slate-500 ml-1">4.9 from 600+ reviews</span>
          </div>
          <span className="text-slate-300 hidden sm:block">·</span>
          <span className="text-sm text-slate-500">1,200+ bookings this month</span>
          <span className="text-slate-300 hidden sm:block">·</span>
          <span className="text-sm text-slate-500">120+ verified providers</span>
        </div>
      </div>
    </section>
  )
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    icon: Sparkles,
    label: 'Beauty',
    color: 'bg-pink-50 text-pink-500',
    border: 'border-pink-100',
    description: 'Hair, nails, skin & more',
    services: ['Haircut & styling', 'Manicure & pedicure', 'Facial treatments', 'Massage'],
  },
  {
    icon: Dumbbell,
    label: 'Sport',
    color: 'bg-amber-50 text-amber-500',
    border: 'border-amber-100',
    description: 'Courts, gyms & personal training',
    services: ['Tennis & padel', 'Personal trainer', 'Swimming pool', 'Yoga & pilates'],
  },
  {
    icon: PawPrint,
    label: 'Pet care',
    color: 'bg-emerald-50 text-emerald-500',
    border: 'border-emerald-100',
    description: 'Grooming, vet & walking',
    services: ['Dog grooming', 'Vet appointments', 'Dog walking', 'Pet sitting'],
  },
]

function Categories() {
  return (
    <section id="categories" className="bg-white px-6 md:px-10 py-24">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-14">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold text-[#1069d1] uppercase tracking-wider">Services</p>
          <p className="font-heading font-semibold text-[36px] md:text-[44px] leading-[1.15] tracking-[-0.5px] text-slate-900">
            Everything you need, one place to book
          </p>
          <p className="text-lg text-slate-500 max-w-[480px] mx-auto">
            Three verticals, hundreds of providers, one simple app.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.label}
              className={`bg-white border-2 ${cat.border} rounded-2xl p-8 flex flex-col gap-6 hover:shadow-md transition-shadow cursor-pointer group`}
            >
              <div className={`size-14 rounded-xl ${cat.color} flex items-center justify-center shrink-0`}>
                <cat.icon className="size-7" strokeWidth={1.8} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-heading font-semibold text-2xl text-slate-900">{cat.label}</p>
                <p className="text-slate-500 text-sm">{cat.description}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {cat.services.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="size-1.5 rounded-full bg-slate-300 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
              <button className="flex items-center gap-1 text-sm font-medium text-[#1069d1] group-hover:gap-2 transition-all mt-auto">
                Browse {cat.label.toLowerCase()} <ChevronRight className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    number: '01',
    icon: Sparkles,
    title: 'Choose a service',
    description: 'Browse beauty, sport, and pet care providers near you. Filter by category, location, or availability.',
  },
  {
    number: '02',
    icon: Calendar,
    title: 'Pick your time',
    description: 'See real-time availability and book the slot that fits your schedule — no phone calls, no waiting.',
  },
  {
    number: '03',
    icon: Clock,
    title: 'Show up & enjoy',
    description: 'Get an instant confirmation and reminder. Your provider is ready when you arrive.',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-50 px-6 md:px-10 py-24">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-14">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold text-[#1069d1] uppercase tracking-wider">How it works</p>
          <p className="font-heading font-semibold text-[36px] md:text-[44px] leading-[1.15] tracking-[-0.5px] text-slate-900">
            From search to booked in under a minute
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step) => (
            <div key={step.number} className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <span className="font-heading font-semibold text-[40px] leading-none text-slate-200 select-none">
                  {step.number}
                </span>
                <div className="size-10 rounded-lg bg-[#e8f0fc] flex items-center justify-center">
                  <step.icon className="size-5 text-[#1069d1]" strokeWidth={1.8} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-heading font-semibold text-xl text-slate-900">{step.title}</p>
                <p className="text-slate-500 leading-relaxed text-sm">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Why Bookit ───────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: Calendar,
    title: 'Real-time availability',
    description: 'No more back-and-forth. See exactly when providers are free and lock in your slot instantly.',
  },
  {
    icon: Shield,
    title: 'Verified providers',
    description: 'Every business on Bookit is verified. Read genuine reviews before you book.',
  },
  {
    icon: Clock,
    title: 'Instant confirmation',
    description: 'You get a confirmation the moment you book. No waiting, no uncertainty.',
  },
]

function WhyBookit() {
  return (
    <section className="bg-white px-6 md:px-10 py-24">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-14">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold text-[#1069d1] uppercase tracking-wider">Why Bookit</p>
          <p className="font-heading font-semibold text-[36px] md:text-[44px] leading-[1.15] tracking-[-0.5px] text-slate-900">
            Booking that actually works
          </p>
          <p className="text-lg text-slate-500 max-w-[440px] mx-auto">
            Built for people who value their time and want things to just work.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex flex-col gap-4 p-8 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="size-10 rounded-lg bg-[#e8f0fc] flex items-center justify-center">
                <b.icon className="size-5 text-[#1069d1]" strokeWidth={1.8} />
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-heading font-semibold text-lg text-slate-900">{b.title}</p>
                <p className="text-slate-500 text-sm leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const REVIEWS = [
  {
    quote: 'Booked a haircut in 30 seconds. No calls, no back-and-forth. This is how it should work.',
    name: 'Marta K.',
    role: 'Regular client · Beauty',
    initials: 'MK',
    color: 'bg-pink-100 text-pink-600',
  },
  {
    quote: 'Found a tennis court for Sunday morning, picked a time, confirmed. Done. Brilliant.',
    name: 'Lukas J.',
    role: 'Regular client · Sport',
    initials: 'LJ',
    color: 'bg-amber-100 text-amber-600',
  },
  {
    quote: "My dog's groomer is now just two taps away. Reminders are a great touch — never miss an appointment.",
    name: 'Aistė M.',
    role: 'Regular client · Pet care',
    initials: 'AM',
    color: 'bg-emerald-100 text-emerald-600',
  },
]

function Testimonials() {
  return (
    <section id="reviews" className="bg-slate-50 px-6 md:px-10 py-24">
      <div className="max-w-[1200px] mx-auto flex flex-col gap-14">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm font-semibold text-[#1069d1] uppercase tracking-wider">Reviews</p>
          <p className="font-heading font-semibold text-[36px] md:text-[44px] leading-[1.15] tracking-[-0.5px] text-slate-900">
            Clients love the simplicity
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {REVIEWS.map((r) => (
            <div key={r.name} className="bg-white rounded-2xl p-8 flex flex-col gap-6 shadow-sm border border-slate-100">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-700 leading-relaxed text-[15px] flex-1">&ldquo;{r.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-full ${r.color} flex items-center justify-center shrink-0`}>
                  <span className="text-xs font-semibold">{r.initials}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">{r.name}</span>
                  <span className="text-xs text-slate-400">{r.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function Cta() {
  const { isAuthenticated } = useAuthStore()

  return (
    <section className="bg-white px-6 md:px-10 py-24">
      <div className="max-w-[1200px] mx-auto">
        <div className="bg-[#f0f7ff] rounded-3xl px-8 md:px-16 py-16 flex flex-col items-center gap-8 text-center border border-[#d6e8fb]">
          <div className="flex flex-col gap-4 max-w-[540px]">
            <p className="font-heading font-semibold text-[36px] md:text-[48px] leading-[1.15] tracking-[-0.5px] text-slate-900">
              Your next appointment is two taps away
            </p>
            <p className="text-lg text-slate-500">
              Join thousands of people in Lithuania already booking through Bookit.
            </p>
          </div>
          {isAuthenticated ? (
            <Link to="/account">
              <button className="px-8 py-4 text-base font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors shadow-sm">
                Go to my account
              </button>
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/register">
                <button className="px-8 py-4 text-base font-medium text-white bg-[#1069d1] rounded-xl hover:bg-[#0d56b0] transition-colors shadow-sm">
                  Create free account
                </button>
              </Link>
              <Link to="/login">
                <button className="px-8 py-4 text-base font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
                  Log in
                </button>
              </Link>
            </div>
          )}
          <p className="text-xs text-slate-400">Free to use · No credit card required</p>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-white border-t border-slate-100 px-6 md:px-10 py-8">
      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="font-heading font-semibold text-slate-900">Bookit</span>
        <div className="flex flex-wrap gap-6 justify-center">
          {['Features', 'Pricing', 'Privacy policy', 'Terms'].map((link) => (
            <a key={link} href="#" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
              {link}
            </a>
          ))}
        </div>
        <p className="text-sm text-slate-400">
          &copy; {new Date().getFullYear()} Bookit. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Categories />
        <HowItWorks />
        <WhyBookit />
        <Testimonials />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
