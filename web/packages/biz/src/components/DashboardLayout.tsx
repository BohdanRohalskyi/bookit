import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusCircle,
  Building2,
  CalendarCheck,
  Users,
  Calendar,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  ArrowUpRight,
} from 'lucide-react'
import { useAuthStore } from '@bookit/shared/stores'
import { useAppSwitch } from '@bookit/shared/hooks'

// ─── Nav config ──────────────────────────────────────────────────────────────

const activeNav = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', end: true },
  { icon: PlusCircle, label: 'Add Business', path: '/dashboard/businesses/new', end: false },
  { icon: Building2, label: 'Manage Businesses', path: '/dashboard/businesses', end: true },
]

const disabledNav = [
  { icon: CalendarCheck, label: 'Bookings' },
  { icon: Users, label: 'Team' },
  { icon: Calendar, label: 'Calendar' },
  { icon: FileText, label: 'Reports' },
  { icon: CreditCard, label: 'Payment' },
  { icon: Settings, label: 'Settings' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function DashboardLayout() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { switchTo } = useAppSwitch()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'

  useEffect(() => {
    if (!isAuthenticated) navigate('/login')
  }, [isAuthenticated, navigate])

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen bg-[#f8f9fa] overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 bg-[#020905] flex flex-col h-full">
        {/* Logo */}
        <Link
          to="/dashboard"
          className="h-16 flex items-center px-6 border-b border-white/10 shrink-0 gap-3"
        >
          <div className="size-8 bg-[#1069d1] rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">B</span>
          </div>
          <span className="text-white font-heading font-semibold text-base leading-none">
            Bookit Business
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto flex flex-col gap-0.5">
          {activeNav.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#1069d1] text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            )
          })}

          <div className="border-t border-white/10 my-3" />

          {disabledNav.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-white/25 cursor-not-allowed select-none"
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </div>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive ? 'bg-white/10' : 'hover:bg-white/5'
              }`
            }
          >
            <div className="size-9 bg-white/10 rounded-full flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-white">
                {user ? getInitials(user.name) : '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/40 truncate">{user?.email}</p>
            </div>
          </NavLink>
          <button
            onClick={() => { logout(); navigate('/') }}
            className="mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
          >
            <LogOut className="size-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 shrink-0 bg-white border-b border-[rgba(2,9,5,0.08)] flex items-center justify-end px-8 gap-6">
          <button
            onClick={() => switchTo(consumerUrl)}
            className="flex items-center gap-1.5 text-sm text-[rgba(2,9,5,0.5)] hover:text-[#020905] transition-colors"
          >
            Client app
            <ArrowUpRight className="size-3.5" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
