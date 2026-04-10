import { Link } from 'react-router-dom'
import { CalendarCheck, Zap, BarChart2, Clock, TrendingUp, Brain, ChevronRight } from 'lucide-react'
import { Button } from '@bookit/shared'
import { useAuthStore } from '@bookit/shared/stores'
import { useAppSwitch } from '@bookit/shared/hooks'

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { switchTo } = useAppSwitch()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'

  return (
    <nav className="bg-[#e7f0fa] h-[72px] shrink-0 w-full">
      <div className="max-w-[1280px] mx-auto px-8 md:px-16 h-full flex items-center justify-between">
        <span className="text-[#020905] font-semibold text-lg font-heading">Bookit Business</span>

        <div className="hidden md:flex items-center gap-8">
          <a href="#" className="text-[#020905] text-base hover:opacity-70 transition-opacity">Product</a>
          <a href="#" className="text-[#020905] text-base hover:opacity-70 transition-opacity">About us</a>
          <a href="#" className="text-[#020905] text-base hover:opacity-70 transition-opacity">Blog</a>
          <button
            onClick={() => switchTo(consumerUrl)}
            className="text-[#020905] text-base hover:opacity-70 transition-opacity"
          >
            Client app ↗
          </button>
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated && user ? (
            <>
              <span className="text-sm text-[#020905] hidden md:block">{user.name}</span>
              <Link to="/account">
                <button className="px-3 py-1.5 text-base font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors">
                  My account
                </button>
              </Link>
              <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
            </>
          ) : (
            <>
              <Link to="/register">
                <button className="px-3 py-1.5 text-base font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors">
                  Sign up
                </button>
              </Link>
              <Link to="/login">
                <button className="px-3 py-1.5 text-base font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors">
                  Login
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
  const { switchTo } = useAppSwitch()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'

  const scrollToFeatures = () => {
    document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className="bg-[#e7f0fa] px-8 md:px-16 py-20">
      <div className="max-w-[1280px] mx-auto">
        <div className="relative h-[480px] md:h-[640px] rounded-lg overflow-hidden bg-[#030213]">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a1a] to-[#1a1a3e]" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 h-full flex flex-col items-center justify-center px-8 md:px-16 text-center text-white gap-8">
            <div className="flex flex-col gap-6 max-w-[768px]">
              <h1 className="font-heading font-semibold text-[44px] md:text-[72px] leading-[1.2] tracking-[-0.72px]">
                One platform for all service businesses
              </h1>
              <p className="text-base md:text-lg leading-relaxed">
                Bookit unifies bookings across sports facilities, beauty professionals, and pet care
                providers. Built for providers who want to grow without the complexity.
              </p>
            </div>
            <div className="flex gap-4 items-center">
              {isAuthenticated ? (
                <button
                  onClick={() => switchTo(consumerUrl)}
                  className="px-4 py-2 text-base font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors"
                >
                  View Client App
                </button>
              ) : (
                <>
                  <Link to="/register">
                    <button className="px-4 py-2 text-base font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors">
                      Get started
                    </button>
                  </Link>
                  <button
                    onClick={scrollToFeatures}
                    className="px-4 py-2 text-base font-medium text-white border border-[rgba(255,255,255,0.4)] rounded-[6px] hover:bg-white/10 transition-colors"
                  >
                    See features
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Unified booking across verticals',
    description: 'Handle sports, beauty, and pet care bookings in one place',
  },
  {
    icon: Zap,
    title: 'Intelligent automation that works',
    description: 'Let the system handle scheduling, reminders, and customer follow-ups',
  },
  {
    icon: BarChart2,
    title: 'Built for providers first',
    description: 'No bloat, no confusion, just tools that actually help you grow',
  },
]

function Features() {
  return (
    <section id="features" className="bg-white px-8 md:px-16 py-28">
      <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-20">
        <div className="flex flex-col items-center gap-4 max-w-[768px] text-center">
          <span className="text-base font-semibold text-[#020905]">Features</span>
          <div className="flex flex-col gap-6">
            <h2 className="font-heading font-semibold text-[40px] md:text-[52px] leading-[1.2] tracking-[-0.52px] text-[#020905]">
              What makes Bookit work
            </h2>
            <p className="text-lg text-[#020905]">Everything you need to run your business</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="relative rounded-lg overflow-hidden bg-[#0d1117] min-h-[389px] flex flex-col"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#0d1117] to-[#1a1a3e]" />
              <div className="relative z-10 flex flex-col gap-6 p-8 h-full justify-between">
                <div className="flex flex-col gap-6">
                  <f.icon className="size-12 text-white" strokeWidth={1.5} />
                  <div className="flex flex-col gap-4 text-white">
                    <h3 className="font-heading font-semibold text-[28px] md:text-[36px] leading-[1.3] tracking-[-0.36px]">
                      {f.title}
                    </h3>
                    <p className="text-base leading-relaxed">{f.description}</p>
                  </div>
                </div>
                <button className="flex items-center gap-2 text-base font-medium text-white/80 hover:text-white transition-colors w-fit">
                  Explore <ChevronRight className="size-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '40%', label: 'More bookings on average' },
  { value: '8hrs', label: 'Saved per week on admin' },
  { value: '3x', label: 'Faster customer response time' },
]

function Stats() {
  return (
    <section className="bg-white px-8 md:px-16 py-28 border-t border-[rgba(2,9,5,0.1)]">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-20">
        <div className="flex flex-col md:flex-row gap-10 md:gap-20 items-start">
          <div className="flex-1">
            <h2 className="font-heading font-semibold text-[36px] md:text-[44px] leading-[1.2] tracking-[-0.44px] text-[#020905]">
              Providers are seeing real growth
            </h2>
          </div>
          <div className="flex-1">
            <p className="text-lg text-[#020905] leading-relaxed">
              Numbers that matter to your business
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STATS.map((s) => (
            <div key={s.value} className="relative pl-8 border-l border-[rgba(2,9,5,0.15)]">
              <p className="font-bold text-[64px] md:text-[80px] leading-[1.3] text-[#020905]">
                {s.value}
              </p>
              <p className="font-heading font-semibold text-[18px] md:text-[22px] tracking-[-0.22px] text-[#020905]">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Benefits ─────────────────────────────────────────────────────────────────

const BENEFITS = [
  {
    icon: Clock,
    title: 'Save time',
    description:
      'Automate your booking process and stop spending hours on manual scheduling. Let clients book themselves while you focus on delivering great service.',
  },
  {
    icon: TrendingUp,
    title: 'Grow faster',
    description:
      'Reach more clients, reduce no-shows with automated reminders, and turn one-time visitors into loyal regulars with built-in follow-up tools.',
  },
  {
    icon: Brain,
    title: 'Run smarter',
    description:
      'Get insights into your busiest hours, top-performing services, and client retention — all from a single dashboard built for service providers.',
  },
]

function Benefits() {
  return (
    <section className="bg-white px-8 md:px-16 py-28 border-t border-[rgba(2,9,5,0.1)]">
      <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-20">
        <div className="flex flex-col items-center gap-4 max-w-[768px] text-center">
          <span className="text-base font-semibold text-[#020905]">Benefits</span>
          <div className="flex flex-col gap-6">
            <h2 className="font-heading font-semibold text-[40px] md:text-[52px] leading-[1.2] tracking-[-0.52px] text-[#020905]">
              Built around how you work
            </h2>
            <p className="text-lg text-[#020905]">
              Everything you need to manage your business with less effort
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex flex-col gap-6 items-start">
              <b.icon className="size-10 text-[#020905]" strokeWidth={1.5} />
              <div className="flex flex-col gap-3 text-[#020905]">
                <h3 className="font-heading font-semibold text-xl">{b.title}</h3>
                <p className="text-base leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-6 items-center">
          <Link to="/login">
            <button className="px-4 py-2 text-base font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors">
              Get started
            </button>
          </Link>
          <button className="flex items-center gap-2 text-base font-medium text-[#020905] hover:opacity-70 transition-opacity">
            Learn more <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote: 'Bookit cut my admin work in half and doubled my bookings in three months.',
    name: 'Marcus Chen',
    role: 'Sports facility owner',
    initials: 'MC',
  },
  {
    quote: 'I can finally respond to clients instantly instead of playing catch-up all day.',
    name: 'Sarah Mitchell',
    role: 'Beauty professional',
    initials: 'SM',
  },
  {
    quote: 'Managing pet care bookings became simple, and my clients love the automatic reminders.',
    name: 'David Torres',
    role: 'Pet care provider',
    initials: 'DT',
  },
]

function Stars() {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="size-[18px]" viewBox="0 0 20 20" fill="#020905">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function Testimonials() {
  return (
    <section className="bg-[#f2f2f2] px-8 md:px-16 py-28">
      <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-20">
        <div className="flex flex-col items-center gap-6 max-w-[768px] text-center text-[#020905]">
          <h2 className="font-heading font-semibold text-[40px] md:text-[52px] leading-[1.2] tracking-[-0.52px]">
            Real stories
          </h2>
          <p className="text-lg">Providers across industries share their wins</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-[#f2f2f2] border border-[rgba(2,9,5,0.15)] rounded-lg p-8 flex flex-col gap-6"
            >
              <div className="flex flex-col gap-6">
                <Stars />
                <p className="text-lg text-[#020905] leading-relaxed">{t.quote}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-full bg-[#1069d1] flex items-center justify-center shrink-0">
                  <span className="text-white text-sm font-semibold">{t.initials}</span>
                </div>
                <div className="flex flex-col text-[#020905] text-base leading-relaxed">
                  <span className="font-semibold">{t.name}</span>
                  <span className="font-normal">{t.role}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    question: 'Does Bookit work for me?',
    answer:
      "Bookit works for sports facilities, beauty professionals, pet care providers, and any service business that takes bookings. If you're managing appointments and want to stop doing it manually, we're built for you.",
  },
  {
    question: 'How long does setup take?',
    answer:
      'Most providers are up and running within a day. You connect your calendar, set your availability, and the system takes it from there. No complicated training or technical knowledge required.',
  },
  {
    question: 'Can I manage multiple businesses?',
    answer:
      'Yes. Add as many businesses as you need to your account and manage them all from one dashboard. Switch between them instantly without logging in and out.',
  },
  {
    question: 'What about customer data?',
    answer:
      'Your customer data stays secure and encrypted. You own it completely and can export it anytime. We follow industry standards for privacy and never sell your information to third parties.',
  },
  {
    question: 'How much does it cost?',
    answer:
      'We offer flexible pricing based on your business size and needs. Start with our basic plan and scale up as you grow. There are no hidden fees or surprise charges.',
  },
]

function Faq() {
  return (
    <section className="bg-white px-8 md:px-16 py-28">
      <div className="max-w-[1280px] mx-auto flex flex-col items-center gap-20">
        <div className="flex flex-col items-center gap-6 max-w-[768px] text-center text-[#020905]">
          <h2 className="font-heading font-semibold text-[40px] md:text-[52px] leading-[1.2] tracking-[-0.52px]">
            Questions
          </h2>
          <p className="text-lg">Everything you need to know about getting started with Bookit</p>
        </div>

        <div className="flex flex-col gap-12 max-w-[768px] w-full text-[#020905]">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="flex flex-col gap-4">
              <p className="font-bold text-lg">{item.question}</p>
              <p className="text-base leading-relaxed">{item.answer}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-6 max-w-[560px] text-center text-[#020905]">
          <div className="flex flex-col gap-4">
            <h3 className="font-heading font-semibold text-[28px] md:text-[36px] leading-[1.3] tracking-[-0.36px]">
              Get in touch with us
            </h3>
            <p className="text-lg">Is Bookit right for me?</p>
          </div>
          <button className="px-4 py-2 text-base font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors">
            Contact
          </button>
        </div>
      </div>
    </section>
  )
}

// ─── CTA 1 ────────────────────────────────────────────────────────────────────

function Cta1() {
  return (
    <section className="bg-[#e7f0fa] px-8 md:px-16 py-28">
      <div className="max-w-[1280px] mx-auto">
        <div className="bg-[#e7f0fa] border border-[rgba(2,9,5,0.15)] rounded-lg overflow-hidden flex flex-col md:flex-row">
          <div className="flex-1 flex flex-col justify-center p-8 md:p-12 gap-8">
            <div className="flex flex-col gap-6 text-[#020905]">
              <h2 className="font-heading font-semibold text-[36px] md:text-[52px] leading-[1.2] tracking-[-0.52px]">
                Stop managing bookings manually
              </h2>
              <p className="text-lg leading-relaxed">
                Join providers who&apos;ve already simplified their business and started growing
              </p>
            </div>
            <div className="flex gap-4">
              <Link to="/register">
                <button className="px-4 py-2 text-base font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors">
                  Start
                </button>
              </Link>
              <button className="px-4 py-2 text-base font-medium text-[#020905] border border-[rgba(2,9,5,0.15)] rounded-[6px] hover:bg-black/5 transition-colors">
                Learn
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-[240px] md:min-h-[360px] bg-gradient-to-br from-[#c8d8f0] to-[#a0bde0]" />
        </div>
      </div>
    </section>
  )
}

// ─── Newsletter ───────────────────────────────────────────────────────────────

function Newsletter() {
  return (
    <section className="bg-white px-8 md:px-16 py-28">
      <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row gap-8 md:gap-8 items-center">
        <div className="flex-1 flex flex-col gap-6 text-[#020905]">
          <h2 className="font-heading font-semibold text-[36px] md:text-[44px] leading-[1.2] tracking-[-0.44px]">
            Stay in the loop
          </h2>
          <p className="text-lg leading-relaxed">
            Get tips, industry insights, and updates delivered to your inbox
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-4 w-full max-w-[513px]">
          <div className="flex gap-4 items-end">
            <div className="flex-1 relative pb-2 border-b border-[rgba(2,9,5,0.15)]">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full bg-transparent text-base text-[#020905] placeholder:text-[rgba(2,9,5,0.6)] outline-none"
              />
            </div>
            <button className="px-4 py-2 text-base font-medium text-white bg-[#1069d1] border border-[#1069d1] rounded-[6px] hover:bg-[#0d56b0] transition-colors shrink-0">
              Subscribe
            </button>
          </div>
          <p className="text-xs text-[#020905]">
            By subscribing you agree to our Terms and Conditions
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

const FOOTER_LINKS = ['Features', 'Pricing', 'Security', 'Integrations', 'Company']
const LEGAL_LINKS = ['Privacy policy', 'Terms of service', 'Cookies settings']

function FacebookIcon() {
  return (
    <svg className="size-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M18.896 0H1.104C.494 0 0 .494 0 1.104v17.792C0 19.506.494 20 1.104 20h9.578v-7.745H8.076V9.237h2.606V7.01c0-2.583 1.578-3.99 3.883-3.99 1.104 0 2.052.082 2.329.119v2.7h-1.598c-1.254 0-1.496.596-1.496 1.47v1.927h2.989l-.39 3.018h-2.6V20h5.098C19.506 20 20 19.506 20 18.896V1.104C20 .494 19.506 0 18.896 0z" />
    </svg>
  )
}


function XIcon() {
  return (
    <svg className="size-5" viewBox="0 0 18 16" fill="currentColor">
      <path d="M14.178.5h2.758L10.876 7.1 18 16h-5.63l-4.364-5.705L3.252 16H.49l6.47-7.398L0 .5h5.774l3.945 5.215L14.178.5zm-.968 13.858h1.528L4.867 2.063H3.23l9.98 12.295z" />
    </svg>
  )
}

function LinkedinIcon() {
  return (
    <svg className="size-5" viewBox="0 0 18 18" fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M0 1.293C0 .579.593 0 1.325 0h15.35C17.407 0 18 .579 18 1.293v15.414C18 17.421 17.407 18 16.675 18H1.325C.593 18 0 17.421 0 16.707V1.293zM5.383 15.13V6.944H2.697v8.186h2.686zM4.04 5.84a1.393 1.393 0 100-2.786 1.393 1.393 0 000 2.786zm11.09 9.29V10.67c0-2.34-.504-4.139-3.238-4.139-1.314 0-2.196.721-2.557 1.404h-.038V6.944H6.68v8.186h2.685v-4.052c0-1.136.215-2.234 1.622-2.234 1.387 0 1.407 1.297 1.407 2.307v3.979h2.737z" />
    </svg>
  )
}

function Footer() {
  const socialIcons = [FacebookIcon, XIcon, LinkedinIcon]

  return (
    <footer className="bg-white border-t border-[rgba(2,9,5,0.1)] px-8 md:px-16 py-8">
      <div className="max-w-[1280px] mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="font-heading font-semibold text-[#020905] text-base">
            Bookit Business
          </span>
          <div className="flex flex-wrap gap-6 md:gap-8 justify-center">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm font-semibold text-[#020905] hover:opacity-70 transition-opacity"
              >
                {link}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {socialIcons.map((Icon, i) => (
              <a key={i} href="#" className="text-[#020905] hover:opacity-70 transition-opacity">
                <Icon />
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-[rgba(2,9,5,0.1)]">
          <div className="flex flex-wrap gap-4 md:gap-6 justify-center">
            {LEGAL_LINKS.map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-[#020905] hover:opacity-70 transition-opacity"
              >
                {link}
              </a>
            ))}
          </div>
          <p className="text-sm text-[#020905]">
            &copy; {new Date().getFullYear()} Bookit. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col text-[#020905]">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Features />
        <Stats />
        <Benefits />
        <Testimonials />
        <Faq />
        <Cta1 />
        <Newsletter />
      </main>
      <Footer />
    </div>
  )
}
