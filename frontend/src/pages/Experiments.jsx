import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FlaskConical, Sparkles, Trash2, Search, ArrowUpDown } from 'lucide-react'
import { api } from '../lib/api'
import { formatMetric, timeAgo } from '../lib/format'
import {
  Card,
  EmptyState,
  PageHeader,
  PageLoader,
  StatusBadge,
  TaskBadge,
} from '../components/ui'
import { useToast } from '../context/ToastContext'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'classification', label: 'Classification' },
  { key: 'regression', label: 'Regression' },
]

export default function Experiments() {
  const toast = useToast()
  const [experiments, setExperiments] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sortByScore, setSortByScore] = useState(false)

  useEffect(() => {
    api
      .get('/api/experiments')
      .then((data) => setExperiments(data.experiments))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [toast])

  const visible = useMemo(() => {
    let list = experiments.filter((e) => {
      const matchesQuery =
        !query ||
        e.name.toLowerCase().includes(query.toLowerCase()) ||
        (e.dataset_name || '').toLowerCase().includes(query.toLowerCase())
      const matchesFilter = filter === 'all' || e.task_type === filter
      return matchesQuery && matchesFilter
    })
    if (sortByScore) {
      list = [...list].sort(
        (a, b) => (b.primary_metric.value ?? -1) - (a.primary_metric.value ?? -1),
      )
    }
    return list
  }, [experiments, query, filter, sortByScore])

  async function remove(experiment) {
    if (!window.confirm(`Delete experiment "${experiment.name}"?`)) return
    try {
      await api.delete(`/api/experiments/${experiment.id}`)
      setExperiments((current) => current.filter((e) => e.id !== experiment.id))
      toast.success('Experiment deleted.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <PageLoader label="Loading experiments…" />

  return (
    <>
      <PageHeader
        title="Experiments"
        subtitle="Every training run, its configuration and its score — compare and iterate."
        icon={FlaskConical}
      >
        <Link to="/train" className="btn-primary">
          <Sparkles className="h-4 w-4" /> New experiment
        </Link>
      </PageHeader>

      {experiments.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="No experiments yet"
          description="Train your first model — it usually takes a few seconds."
          actionLabel="Train a model"
          actionTo="/train"
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-10"
                placeholder="Search by name or dataset…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    filter === f.key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSortByScore((v) => !v)}
              className={`btn-secondary text-xs ${sortByScore ? 'ring-brand-400 text-brand-700' : ''}`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortByScore ? 'Best score first' : 'Newest first'}
            </button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3 font-bold">Experiment</th>
                    <th className="px-4 py-3 font-bold">Task</th>
                    <th className="px-4 py-3 font-bold">Target</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 text-right font-bold">Score</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 transition hover:bg-slate-50">
                      <td className="px-5 py-3.5">
                        <Link to={`/experiments/${e.id}`} className="block">
                          <p className="font-semibold text-slate-800 hover:text-brand-700">{e.name}</p>
                          <p className="text-xs text-slate-500">
                            {e.dataset_name} · {timeAgo(e.created_at)} · {e.duration_ms} ms
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <TaskBadge task={e.task_type} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-slate-600">{e.target_column}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-base font-extrabold text-slate-900">
                          {formatMetric(e.primary_metric.label, e.primary_metric.value)}
                        </span>
                        <span className="ml-1 text-[11px] text-slate-400">
                          {e.primary_metric.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => remove(e)}
                          className="rounded-lg p-2 text-slate-300 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {visible.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                        No experiments match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
