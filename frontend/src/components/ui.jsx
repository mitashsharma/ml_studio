import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export function Spinner({ className = 'h-5 w-5' }) {
  return <Loader2 className={`${className} animate-spin`} />
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-400">
      <Spinner className="h-7 w-7" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

export function PageHeader({ title, subtitle, children, icon: Icon }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        {Icon && (
          <span className="hidden rounded-2xl bg-brand-50 p-3 text-brand-600 ring-1 ring-brand-100 sm:block">
            <Icon className="h-6 w-6" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[28px]">
            {title}
          </h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  )
}

export function Card({ className = '', children, ...rest }) {
  return (
    <div className={`card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-5 w-5 text-brand-500" />}
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

const BADGE_TONES = {
  brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
  green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
  rose: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
  slate: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  sky: 'bg-sky-50 text-sky-700 ring-1 ring-sky-100',
}

export function Badge({ tone = 'slate', children, className = '' }) {
  return <span className={`chip ${BADGE_TONES[tone]} ${className}`}>{children}</span>
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionTo, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
      {Icon && (
        <span className="mb-4 rounded-2xl bg-brand-50 p-4 text-brand-500">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {actionLabel &&
        (actionTo ? (
          <Link to={actionTo} className="btn-primary mt-5">
            {actionLabel}
          </Link>
        ) : (
          <button onClick={onAction} className="btn-primary mt-5">
            {actionLabel}
          </button>
        ))}
    </div>
  )
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'brand' }) {
  const tones = {
    brand: 'from-brand-500/10 to-brand-500/0 text-brand-600',
    sky: 'from-sky-500/10 to-sky-500/0 text-sky-600',
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600',
    amber: 'from-amber-500/10 to-amber-500/0 text-amber-600',
  }
  return (
    <Card className="relative overflow-hidden p-5">
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone]}`} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
          {Icon && <Icon className={`h-5 w-5 ${tones[tone].split(' ').pop()}`} />}
        </div>
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </Card>
  )
}

export function TaskBadge({ task }) {
  return task === 'classification' ? (
    <Badge tone="sky">Classification</Badge>
  ) : (
    <Badge tone="amber">Regression</Badge>
  )
}

export function StatusBadge({ status }) {
  if (status === 'success') return <Badge tone="green">Trained</Badge>
  if (status === 'failed') return <Badge tone="rose">Failed</Badge>
  return <Badge tone="slate">{status}</Badge>
}

export function ProgressBar({ value, tone = 'bg-brand-500' }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full ${tone} transition-all duration-700`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}
