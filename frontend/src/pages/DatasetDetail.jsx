import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Sparkles,
  Table2,
  Gauge,
  AlertCircle,
  Copy,
  Layers,
  Activity,
} from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { api } from '../lib/api'
import { formatNumber, timeAgo } from '../lib/format'
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PageLoader,
  ProgressBar,
  StatCard,
} from '../components/ui'
import { useToast } from '../context/ToastContext'

const TYPE_TONES = { numeric: 'sky', categorical: 'brand', boolean: 'green', datetime: 'amber' }

function ColumnRow({ column, expanded, onToggle }) {
  return (
    <>
      <tr
        className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
        onClick={onToggle}
      >
        <td className="px-5 py-3">
          <p className="font-semibold text-slate-800">{column.name}</p>
          <p className="font-mono text-[11px] text-slate-400">{column.dtype}</p>
        </td>
        <td className="px-4 py-3">
          <Badge tone={TYPE_TONES[column.type] || 'slate'}>{column.type}</Badge>
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">{formatNumber(column.unique, 0)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-20">
              <ProgressBar
                value={column.missing_pct}
                tone={column.missing_pct > 20 ? 'bg-rose-400' : 'bg-amber-400'}
              />
            </div>
            <span className="text-xs font-medium text-slate-500">{column.missing_pct}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right text-xs font-medium text-brand-600">
          {expanded ? 'Hide' : 'Details'}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={5} className="px-5 py-4">
            {column.type === 'numeric' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Object.entries(column.stats || {}).map(([key, value]) => (
                    <div key={key} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {key}
                      </dt>
                      <dd className="font-mono text-sm text-slate-700">{formatNumber(value, 2)}</dd>
                    </div>
                  ))}
                </dl>
                {column.histogram && (
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={column.histogram}>
                        <XAxis dataKey="bin" hide />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }}
                          formatter={(v) => [v, 'rows']}
                        />
                        <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(column.top_values || []).map((item) => (
                  <span
                    key={item.value}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs ring-1 ring-slate-200"
                  >
                    <span className="font-semibold text-slate-700">{item.value}</span>
                    <span className="text-slate-400">{item.count}</span>
                  </span>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export default function DatasetDetail() {
  const { id } = useParams()
  const toast = useToast()
  const [dataset, setDataset] = useState(null)
  const [preview, setPreview] = useState(null)
  const [experiments, setExperiments] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    let active = true
    Promise.all([
      api.get(`/api/datasets/${id}`),
      api.get(`/api/datasets/${id}/preview?limit=25`),
      api.get(`/api/experiments?dataset_id=${id}`),
    ])
      .then(([d, p, e]) => {
        if (!active) return
        setDataset(d.dataset)
        setPreview(p)
        setExperiments(e.experiments)
      })
      .catch((err) => toast.error(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [id, toast])

  const correlations = useMemo(
    () => (dataset?.profile?.correlations || []).slice(0, 8),
    [dataset],
  )

  if (loading) return <PageLoader label="Profiling dataset…" />
  if (!dataset) return null

  const profile = dataset.profile || {}
  const quality = profile.quality_score ?? 0
  const qualityTone = quality >= 85 ? 'emerald' : quality >= 60 ? 'amber' : 'brand'

  return (
    <>
      <Link
        to="/datasets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> All datasets
      </Link>

      <PageHeader
        title={dataset.name}
        subtitle={`${dataset.original_filename} · added ${timeAgo(dataset.created_at)}`}
      >
        <Link to={`/train?dataset=${dataset.id}`} className="btn-primary">
          <Sparkles className="h-4 w-4" /> Train a model
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Table2} label="Rows" value={formatNumber(dataset.n_rows, 0)} tone="brand" />
        <StatCard icon={Layers} label="Columns" value={dataset.n_columns} tone="sky" />
        <StatCard
          icon={AlertCircle}
          label="Missing cells"
          value={`${profile.missing_pct ?? 0}%`}
          hint={`${formatNumber(profile.missing_cells ?? 0, 0)} cells`}
          tone="amber"
        />
        <StatCard
          icon={Gauge}
          label="Data quality"
          value={`${quality}/100`}
          hint={`${formatNumber(profile.duplicate_rows ?? 0, 0)} duplicate rows`}
          tone={qualityTone}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Columns"
            subtitle="Click a row to see distributions and summary statistics"
            icon={Layers}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3 font-bold">Column</th>
                  <th className="px-4 py-3 font-bold">Type</th>
                  <th className="px-4 py-3 font-bold">Unique</th>
                  <th className="px-4 py-3 font-bold">Missing</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(profile.columns || []).map((column) => (
                  <ColumnRow
                    key={column.name}
                    column={column}
                    expanded={expanded === column.name}
                    onToggle={() => setExpanded(expanded === column.name ? null : column.name)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Strongest correlations" subtitle="Numeric pairs" icon={Activity} />
            <div className="p-5">
              {correlations.length === 0 ? (
                <p className="text-sm text-slate-400">Needs at least two numeric columns.</p>
              ) : (
                <ul className="space-y-3">
                  {correlations.map((c) => (
                    <li key={`${c.a}-${c.b}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="truncate font-semibold text-slate-700">
                          {c.a} ↔ {c.b}
                        </span>
                        <span
                          className={`font-mono ${c.value > 0 ? 'text-emerald-600' : 'text-rose-500'}`}
                        >
                          {c.value.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar
                          value={Math.abs(c.value) * 100}
                          tone={c.value > 0 ? 'bg-emerald-400' : 'bg-rose-400'}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Experiments on this data" icon={Copy} />
            <div className="divide-y divide-slate-100">
              {experiments.length === 0 && (
                <p className="p-5 text-sm text-slate-400">No models trained on this dataset yet.</p>
              )}
              {experiments.slice(0, 6).map((e) => (
                <Link
                  key={e.id}
                  to={`/experiments/${e.id}`}
                  className="flex items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50"
                >
                  <span className="truncate text-sm font-semibold text-slate-700">{e.name}</span>
                  <span className="shrink-0 text-sm font-bold text-brand-600">
                    {e.primary_metric.value != null ? Number(e.primary_metric.value).toFixed(3) : '—'}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Data preview" subtitle="First 25 rows" icon={Table2} />
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                {preview?.columns?.map((c) => (
                  <th key={c} className="whitespace-nowrap px-4 py-3 font-bold">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview?.rows?.map((row, index) => (
                <tr key={index} className="border-b border-slate-50 even:bg-slate-50/50">
                  {preview.columns.map((c) => (
                    <td key={c} className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-slate-600">
                      {row[c] === null || row[c] === undefined ? (
                        <span className="text-slate-300">null</span>
                      ) : (
                        String(row[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
