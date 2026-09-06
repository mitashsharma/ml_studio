import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Database,
  FlaskConical,
  Sparkles,
  LogOut,
  Menu,
  X,
  BookOpen,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/datasets', label: 'Datasets', icon: Database },
  { to: '/train', label: 'Train model', icon: Sparkles },
  { to: '/experiments', label: 'Experiments', icon: FlaskConical },
  { to: '/guide', label: 'Guide', icon: BookOpen },
]

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-500 text-white shadow-sm shadow-brand-500/30">
        <Sparkles className="h-5 w-5" />
      </span>
      <span className="text-lg font-extrabold tracking-tight text-slate-900">
        ML<span className="text-brand-600"> Studio</span>
      </span>
    </Link>
  )
}

function NavItems({ onNavigate }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={`h-[18px] w-[18px] ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600'}`}
              />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function UserCard({ user, onLogout }) {
  const initials = (user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-sky-500 text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{user?.username}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
        </div>
        <button
          onClick={onLogout}
          title="Sign out"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white hover:text-rose-500"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col justify-between border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div>
          <Logo />
          <div className="mt-8">
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Workspace
            </p>
            <NavItems />
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-sky-500 p-4 text-white">
            <p className="text-sm font-bold">Ready to experiment?</p>
            <p className="mt-1 text-xs text-white/80">
              Upload a CSV and train a model in under a minute.
            </p>
            <Link
              to="/train"
              className="mt-3 inline-flex rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-brand-700 transition hover:bg-white"
            >
              New experiment
            </Link>
          </div>
          <UserCard user={user} onLogout={handleLogout} />
        </div>
      </aside>

      {/* Topbar (mobile) */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-[57px] z-30 border-b border-slate-200 bg-white p-4 shadow-lg lg:hidden">
          <NavItems onNavigate={() => setMobileOpen(false)} />
          <div className="mt-4">
            <UserCard user={user} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <main key={location.pathname} className="animate-fade-up lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">{children}</div>
      </main>
    </div>
  )
}
