import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, NavLink, useNavigate, Link, useLocation } from 'react-router-dom'
import { spaceFromOwned, spaceFromMembership } from '../api/staffApi'
import { useMemberships } from '../hooks/useMemberships'
import {
  LayoutDashboard,
  PlusCircle,
  Building2,
  MapPin,
  CalendarCheck,
  Users,
  UserCircle,
  CreditCard,
  Settings,
  LogOut,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react'
import { useAuthStore } from '@bookit/shared/stores'
import { useAppSwitch } from '@bookit/shared/hooks'
import { useSpaceStore } from '../stores/spaceStore'
import { useMyRole } from '../hooks/useMyRole'

// ─── Nav config ──────────────────────────────────────────────────────────────

type NavVisibility = 'all' | 'admin' | 'owner'

type ImplementedNavItem = {
  icon: React.ElementType
  label: string
  path: string
  end: boolean
  showTo: NavVisibility
}

type PlaceholderNavItem = {
  icon: React.ElementType
  label: string
  showTo: NavVisibility
}

type NavItem = ImplementedNavItem | PlaceholderNavItem

function isImplemented(item: NavItem): item is ImplementedNavItem {
  return 'path' in item
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',          path: '/dashboard',             end: true,  showTo: 'all' },
  { icon: Building2,       label: 'Manage Businesses',  path: '/dashboard/businesses',  end: true,  showTo: 'owner' },
  { icon: PlusCircle,      label: 'Add Business',       path: '/dashboard/businesses/new', end: false, showTo: 'owner' },
  { icon: MapPin,          label: 'Locations',          path: '/dashboard/locations',   end: true,  showTo: 'admin' },
  { icon: Users,           label: 'Team',               path: '/dashboard/staff',       end: true,  showTo: 'admin' },
  { icon: UserCircle,      label: 'My Profile',         path: '/dashboard/profile',     end: true,  showTo: 'all' },
  { icon: CalendarCheck,   label: 'Bookings',                                                        showTo: 'all' },
  { icon: CreditCard,      label: 'Payment',                                                         showTo: 'owner' },
  { icon: Settings,        label: 'Settings',                                                        showTo: 'owner' },
]

// ─── NotImplementedOverlay ────────────────────────────────────────────────────

function NotImplementedOverlay({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      setPos({ x: rect.right + 10, y: rect.top + rect.height / 2 })
    }
    setVisible(true)
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      <div className="absolute inset-0 rounded-lg cursor-not-allowed" />
      {visible &&
        createPortal(
          <div
            className="fixed px-2.5 py-1.5 bg-white text-[#020905] text-xs font-medium rounded-md shadow-lg whitespace-nowrap pointer-events-none z-[9999]"
            style={{ left: pos.x, top: pos.y, transform: 'translateY(-50%)' }}
          >
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-white" />
            Coming soon
          </div>,
          document.body,
        )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function isVisible(showTo: NavVisibility, isOwner: boolean, isAdmin: boolean): boolean {
  if (showTo === 'all') return true
  if (showTo === 'admin') return isAdmin
  if (showTo === 'owner') return isOwner
  return true
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { switchTo } = useAppSwitch()
  const consumerUrl = import.meta.env.VITE_CONSUMER_URL || 'https://pt-duo-bookit.web.app'

  const { businessId, businessName, role, clearSpace, setSpace } = useSpaceStore()
  // isOwner/isAdmin: if no space selected yet, default to owner (existing provider flow)
  const { isOwner, isAdmin } = useMyRole()
  const effectiveIsOwner = role === null ? true : isOwner
  const effectiveIsAdmin = role === null ? true : isAdmin

  const { data: memberships } = useMemberships({ enabled: !businessId })

  useEffect(() => {
    if (!isAuthenticated) navigate('/login')
  }, [isAuthenticated, navigate])

  // Smart workspace routing — only runs when no space is selected yet
  useEffect(() => {
    if (!isAuthenticated || businessId || !memberships) return

    const { owned, memberships: member } = memberships
    const total = owned.length + member.length

    if (total === 0) {
      if (!location.pathname.startsWith('/dashboard/businesses')) {
        navigate('/dashboard/businesses/new')
      }
    } else if (owned.length === 1 && member.length === 0) {
      setSpace(spaceFromOwned(owned[0]))
    } else if (owned.length === 0 && member.length === 1) {
      setSpace(spaceFromMembership(member[0]))
    } else {
      navigate('/spaces')
    }
  }, [isAuthenticated, businessId, memberships, location.pathname, navigate, setSpace])

  if (!isAuthenticated) return null

  const navLinkBase =
    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors'

  function handleLogout() {
    clearSpace()
    logout()
    navigate('/')
  }

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

        {/* Space indicator */}
        {businessName && (
          <button
            onClick={() => { clearSpace(); navigate('/spaces') }}
            className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 hover:bg-white/5 transition-colors group"
          >
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs text-white/40 leading-none mb-0.5">Current workspace</p>
              <p className="text-xs font-medium text-white/70 truncate">{businessName}</p>
            </div>
            <ChevronDown className="size-3.5 text-white/30 shrink-0 group-hover:text-white/50 transition-colors" />
          </button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto flex flex-col gap-0.5">
          {navItems
            .filter((item) => isVisible(item.showTo, effectiveIsOwner, effectiveIsAdmin))
            .map((item) => {
              const Icon = item.icon

              if (!isImplemented(item)) {
                return (
                  <NotImplementedOverlay key={item.label}>
                    <div className={`${navLinkBase} text-white/25 select-none`}>
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </div>
                  </NotImplementedOverlay>
                )
              }

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    `${navLinkBase} ${
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
              <p className="text-xs text-white/40 truncate">
                {role ? role.charAt(0).toUpperCase() + role.slice(1) : user?.email}
              </p>
            </div>
          </NavLink>
          <button
            onClick={handleLogout}
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
        <header className="h-16 shrink-0 bg-white border-b border-[rgba(2,9,5,0.08)] flex items-center justify-between px-8 gap-6">
          {businessName && (
            <p className="text-sm font-medium text-[#020905]">{businessName}</p>
          )}
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
