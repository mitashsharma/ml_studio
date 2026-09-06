import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Database,
  FlaskConical,
  Trophy,
  Rows3,
  ArrowRight,
  Sparkles,
  Upload,
  TrendingUp,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../lib/api'
import { formatMetric, formatNumber, timeAgo } from '../lib/format'
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  PageLoader,
  StatCard,
  StatusBadge,
  TaskBadge,
} from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/api/overview')
      .then(setData)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [toast])

  if (loading) return <PageLoader label="Loading your workspace…" />
  if (!data) return null

  const hasWork = data.dataset_count > 0 || data.experiment_count > 0
  const best = data.best_experiment
  const history = (data.score_history || []).map((h, i) => ({
    ...h,
    index: i + 1,
    score: h.score ?? 0,
  }))

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.username?.split(' ')[0] || 'there'} 👋`}
        subtitle="Your machine learning workbench — datasets, experiments and model performance at a glance."
      >
        <Link to="/datasets" className="btn-secondary">
          <Upload className="h-4 w-4" /> Upload data
        </Link>
        <Link to="/train" className="btn-primary">
          <Sparkles className="h-4 w-4" /> Train a model
        </Link>
      </PageHeader>

      {!hasWork ? (
        <Card className="overflow-hidden">
          <div className="grid gap-8 p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <span className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                Getting started
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
                Train your first model in three steps
              </h2>
              <p className="mt-3 text-slate-500">
                No notebooks, no boilerplate. ML Studio cleans your data, encodes categories, picks a
                sensible split and reports everything you need to trust the result.
              </p>
              <Link to="/datasets" className="btn-primary mt-6">
                Start with a sample dataset <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ol className="space-y-4">
              {[
                {
                  title: 'Add a dataset',
                  body: 'Upload a CSV/Excel file or import one of five built-in samples.',
                },
                {
                  title: 'Pick a target column',
                  body: 'We detect whether it is a classification or regression problem for you.',
                },
                {
                  title: 'Compare and predict',
                  body: 'Review metrics, feature importance, then score new rows instantly.',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-2xl bg-slate-50 p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-800">{step.title}</p>
                    <p className="text-sm text-slate-500">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Database} label="Datasets" value={data.dataset_count} tone="brand" />
            <StatCard
              icon={FlaskConical}
              label="Experiments"
              value={data.experiment_count}
              hint={`${data.success_count} trained · ${data.failed_count} failed`}
              tone="sky"
            />
            <StatCard
              icon={Rows3}
              label="Rows analysed"
              value={formatNumber(data.total_rows, 0)}
              tone="emerald"
            />
            <StatCard
              icon={Trophy}
              label="Best score"
              value={best ? formatMetric(best.primary_metric.label, best.primary_metric.value) : '—'}
              hint={best ? best.name : 'Train a model to see this'}
              tone="amber"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Score history"
                subtitle="Primary metric of each successful run, oldest to newest"
                icon={TrendingUp}
              />
              <div className="h-72 p-4">
                {history.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="index"
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 1]}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          fontSize: 12,
                          boxShadow: '0 8px 24px -12px rgba(15,23,42,.25)',
                        }}
                        formatter={(value, _n, item) => [
                          Number(value).toFixed(3),
                          item.payload.metric,
                        ]}
                        labelFormatter={(_l, payload) => payload?.[0]?.payload?.name || ''}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fill="url(#scoreFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-center text-sm text-slate-400">
                    Train at least two models to see your progress curve.
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Recent datasets" icon={Database} />
              <div className="divide-y divide-slate-100">
                {data.recent_datasets.length === 0 && (
                  <p className="p-5 text-sm text-slate-400">No datasets yet.</p>
                )}
                {data.recent_datasets.map((d) => (
                  <Link
                    key={d.id}
                    to={`/datasets/${d.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{d.name}</p>
                      <p className="text-xs text-slate-500">
                        {formatNumber(d.n_rows, 0)} rows · {d.n_columns} cols
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Recent experiments"
              icon={FlaskConical}
              action={
                <Link to="/experiments" className="text-sm font-semibold text-brand-600 hover:underline">
                  View all
                </Link>
              }
            />
            {data.recent_experiments.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FlaskConical}
                  title="No experiments yet"
                  description="Train your first model to populate this list."
                  actionLabel="Train a model"
                  actionTo="/train"
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recent_experiments.map((e) => (
                  <Link
                    key={e.id}
                    to={`/experiments/${e.id}`}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-800">{e.name}</p>
                      <p className="text-xs text-slate-500">
                        {e.dataset_name} · {timeAgo(e.created_at)}
                      </p>
                    </div>
                    <TaskBadge task={e.task_type} />
                    <StatusBadge status={e.status} />
                    <div className="w-24 text-right">
                      <p className="text-lg font-extrabold text-slate-900">
                        {formatMetric(e.primary_metric.label, e.primary_metric.value)}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">
                        {e.primary_metric.label}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
