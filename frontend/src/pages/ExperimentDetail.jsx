import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  Trash2,
  Gauge,
  Grid3x3,
  BarChart3,
  Wand2,
  Rocket,
  Repeat,
  Clock,
  Layers,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../lib/api'
import { formatNumber, formatPercent, timeAgo } from '../lib/format'
import {
  Badge,
  Card,
  CardHeader,
  PageHeader,
  PageLoader,
  Spinner,
  StatusBadge,
  TaskBadge,
} from '../components/ui'
import { useToast } from '../context/ToastContext'

const TABS = [
  { key: 'performance', label: 'Performance', icon: Gauge },
  { key: 'explain', label: 'Explainability', icon: BarChart3 },
  { key: 'predict', label: 'Live prediction', icon: Wand2 },
]

function MetricTile({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold tracking-tight ${tone}`}>{value}</p>
    </div>
  )
}

function ConfusionMatrix({ data }) {
  const { labels, matrix } = data
  const max = Math.max(...matrix.flat(), 1)

  return (
    <div className="overflow-x-auto p-5">
      <div className="inline-block min-w-full">
        <div className="flex">
          <div className="w-28 shrink-0" />
          <div className="flex-1">
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Predicted
            </p>
            <div className="flex gap-1.5">
              {labels.map((label) => (
                <div
                  key={label}
                  className="min-w-[72px] flex-1 truncate text-center text-xs font-semibold text-slate-600"
                  title={label}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
        {matrix.map((row, i) => (
          <div key={labels[i]} className="mt-1.5 flex items-center">
            <div
              className="w-28 shrink-0 truncate pr-3 text-right text-xs font-semibold text-slate-600"
              title={labels[i]}
            >
              {labels[i]}
            </div>
            <div className="flex flex-1 gap-1.5">
              {row.map((value, j) => {
                const intensity = value / max
                const correct = i === j
                return (
                  <div
                    key={j}
                    className="grid min-w-[72px] flex-1 place-items-center rounded-xl py-4 text-sm font-bold transition"
                    style={{
                      backgroundColor: correct
                        ? `rgba(16, 185, 129, ${0.12 + intensity * 0.6})`
                        : `rgba(244, 63, 94, ${0.06 + intensity * 0.45})`,
                      color: intensity > 0.55 ? '#fff' : '#0f172a',
                    }}
                    title={`True ${labels[i]} → predicted ${labels[j]}: ${value}`}
                  >
                    {value}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <p className="mt-3 text-xs text-slate-400">
          Rows are the true class, columns the prediction. Green diagonal = correct.
        </p>
      </div>
    </div>
  )
}

function PredictPanel({ experiment }) {
  const toast = useToast()
  const [schema, setSchema] = useState(null)
  const [values, setValues] = useState({})
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api
      .get(`/api/experiments/${experiment.id}/schema`)
      .then((data) => {
        setSchema(data)
        setValues(Object.fromEntries(data.features.map((f) => [f.name, f.default ?? ''])))
      })
      .catch((err) => toast.error(err.message))
  }, [experiment.id, toast])

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    try {
      const data = await api.post(`/api/experiments/${experiment.id}/predict`, { row: values })
      setResult(data)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!schema) return <PageLoader label="Loading model schema…" />

  const topProbabilities = result?.probabilities?.[0]?.slice(0, 4) || []

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader
          title="Score a new record"
          subtitle={`Fill in the features and predict "${schema.target}"`}
          icon={Wand2}
        />
        <form onSubmit={submit} className="p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {schema.features.map((feature) => (
              <div key={feature.name}>
                <label className="label">
                  {feature.name}
                  <span className="ml-2 font-normal text-xs text-slate-400">{feature.type}</span>
                </label>
                {feature.type === 'numeric' ? (
                  <input
                    type="number"
                    step="any"
                    className="input font-mono"
                    value={values[feature.name] ?? ''}
                    placeholder={`${formatNumber(feature.min, 1)} – ${formatNumber(feature.max, 1)}`}
                    onChange={(e) => setValues({ ...values, [feature.name]: e.target.value })}
                  />
                ) : (
                  <select
                    className="input"
                    value={values[feature.name] ?? ''}
                    onChange={(e) => setValues({ ...values, [feature.name]: e.target.value })}
                  >
                    {(feature.options || []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
          <button className="btn-primary mt-6" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
            {busy ? 'Predicting…' : 'Predict'}
          </button>
        </form>
      </Card>

      <Card className="self-start overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-sky-500 px-5 py-4 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Prediction</p>
          <p className="mt-2 truncate text-3xl font-extrabold">
            {result
              ? experiment.task_type === 'classification'
                ? result.predictions[0]
                : formatNumber(result.predictions[0], 2)
              : '—'}
          </p>
          <p className="mt-1 text-sm text-white/80">{schema.target}</p>
        </div>
        <div className="p-5">
          {topProbabilities.length > 0 ? (
            <ul className="space-y-3">
              {topProbabilities.map((p) => (
                <li key={p.label}>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="truncate text-slate-700">{p.label}</span>
                    <span className="text-slate-500">{formatPercent(p.probability)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-400"
                      style={{ width: `${p.probability * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">
              Submit the form to see the model&apos;s prediction
              {experiment.task_type === 'classification' ? ' and class probabilities' : ''}.
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

export default function ExperimentDetail() {
  const { id } = useParams()
  const toast = useToast()
  const navigate = useNavigate()
  const [experiment, setExperiment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('performance')

  useEffect(() => {
    api
      .get(`/api/experiments/${id}`)
      .then((data) => setExperiment(data.experiment))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [id, toast])

  const metricTiles = useMemo(() => {
    if (!experiment) return []
    const m = experiment.metrics || {}
    if (experiment.task_type === 'classification') {
      return [
        ['Accuracy', formatPercent(m.accuracy), 'text-brand-600'],
        ['F1 (weighted)', formatPercent(m.f1)],
        ['Precision', formatPercent(m.precision)],
        ['Recall', formatPercent(m.recall)],
        ['ROC AUC', m.roc_auc != null ? m.roc_auc.toFixed(3) : '—'],
        ['Balanced acc.', formatPercent(m.balanced_accuracy)],
      ]
    }
    return [
      ['R² score', m.r2 != null ? m.r2.toFixed(3) : '—', 'text-brand-600'],
      ['RMSE', formatNumber(m.rmse, 2)],
      ['MAE', formatNumber(m.mae, 2)],
      ['MAPE', m.mape != null ? `${m.mape.toFixed(1)}%` : '—'],
      ['Target mean', formatNumber(m.target_mean, 2)],
      ['Target σ', formatNumber(m.target_std, 2)],
    ]
  }, [experiment])

  if (loading) return <PageLoader label="Loading experiment…" />
  if (!experiment) return null

  const charts = experiment.charts || {}
  const metrics = experiment.metrics || {}
  const importance = (charts.feature_importance || []).slice(0, 12)

  const scatter = charts.actual_vs_predicted || []
  const diagonal = scatter.length
    ? {
        min: Math.min(...scatter.map((p) => Math.min(p.actual ?? 0, p.predicted ?? 0))),
        max: Math.max(...scatter.map((p) => Math.max(p.actual ?? 0, p.predicted ?? 0))),
      }
    : { min: 0, max: 1 }

  async function remove() {
    if (!window.confirm('Delete this experiment and its saved model?')) return
    try {
      await api.delete(`/api/experiments/${experiment.id}`)
      toast.success('Experiment deleted.')
      navigate('/experiments')
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <>
      <Link
        to="/experiments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> All experiments
      </Link>

      <PageHeader
        title={experiment.name}
        subtitle={
          <>
            {experiment.algorithm_label} · target{' '}
            <span className="font-mono text-slate-700">{experiment.target_column}</span> ·{' '}
            <Link to={`/datasets/${experiment.dataset_id}`} className="text-brand-600 hover:underline">
              {experiment.dataset_name}
            </Link>{' '}
            · {timeAgo(experiment.created_at)}
          </>
        }
      >
        <button
          className="btn-secondary"
          onClick={() =>
            api
              .download(`/api/experiments/${experiment.id}/download`, `${experiment.name}.joblib`)
              .catch((err) => toast.error(err.message))
          }
        >
          <Download className="h-4 w-4" /> Download model
        </button>
        <button className="btn-danger" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <TaskBadge task={experiment.task_type} />
        <StatusBadge status={experiment.status} />
        <Badge tone="slate">
          <Layers className="h-3 w-3" /> {metrics.n_features} features
        </Badge>
        <Badge tone="slate">
          <Grid3x3 className="h-3 w-3" /> {formatNumber(metrics.train_rows, 0)} train /{' '}
          {formatNumber(metrics.test_rows, 0)} test
        </Badge>
        <Badge tone="slate">
          <Clock className="h-3 w-3" /> {experiment.duration_ms} ms
        </Badge>
        {metrics.cv_mean != null && (
          <Badge tone="brand">
            <Repeat className="h-3 w-3" /> CV {metrics.cv_mean.toFixed(3)} ± {metrics.cv_std?.toFixed(3)}
          </Badge>
        )}
      </div>

      <div className="mb-6 flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200 sm:inline-flex">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === key ? 'bg-brand-600 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'performance' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
            {metricTiles.map(([label, value, tone]) => (
              <MetricTile key={label} label={label} value={value} tone={tone} />
            ))}
          </div>

          {experiment.task_type === 'classification' ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader title="Confusion matrix" subtitle="Test-set predictions" icon={Grid3x3} />
                {charts.confusion_matrix && <ConfusionMatrix data={charts.confusion_matrix} />}
              </Card>

              <Card>
                <CardHeader title="Per-class performance" icon={BarChart3} />
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="px-5 py-3 font-bold">Class</th>
                        <th className="px-4 py-3 font-bold">Precision</th>
                        <th className="px-4 py-3 font-bold">Recall</th>
                        <th className="px-4 py-3 font-bold">F1</th>
                        <th className="px-4 py-3 font-bold">Support</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(charts.per_class || []).map((row) => (
                        <tr key={row.label} className="border-b border-slate-50">
                          <td className="px-5 py-3 font-semibold text-slate-800">{row.label}</td>
                          <td className="px-4 py-3 text-slate-600">{formatPercent(row.precision)}</td>
                          <td className="px-4 py-3 text-slate-600">{formatPercent(row.recall)}</td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-brand-600">
                              {formatPercent(row.f1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{row.support}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="Actual vs predicted"
                  subtitle="Points near the dashed line are accurate"
                  icon={BarChart3}
                />
                <div className="h-80 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
                      <XAxis
                        type="number"
                        dataKey="actual"
                        name="Actual"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickLine={false}
                      />
                      <YAxis
                        type="number"
                        dataKey="predicted"
                        name="Predicted"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: '3 3' }}
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }}
                        formatter={(value) => Number(value).toFixed(2)}
                      />
                      <ReferenceLine
                        segment={[
                          { x: diagonal.min, y: diagonal.min },
                          { x: diagonal.max, y: diagonal.max },
                        ]}
                        stroke="#94a3b8"
                        strokeDasharray="6 6"
                        ifOverflow="extendDomain"
                      />
                      <Scatter
                        data={scatter}
                        fill="#6366f1"
                        fillOpacity={0.55}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Residual distribution"
                  subtitle={`Mean ${formatNumber(charts.residual_stats?.mean, 2)} · σ ${formatNumber(
                    charts.residual_stats?.std,
                    2,
                  )}`}
                  icon={BarChart3}
                />
                <div className="h-80 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.residual_histogram || []}>
                      <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="bin" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }}
                      />
                      <Bar dataKey="count" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {charts.cv_scores && (
            <Card>
              <CardHeader
                title="Cross-validation folds"
                subtitle={`Mean ${metrics.cv_mean?.toFixed(3)} · std ${metrics.cv_std?.toFixed(3)}`}
                icon={Repeat}
              />
              <div className="h-56 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={charts.cv_scores}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="fold" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="score" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === 'explain' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Feature importance"
              subtitle="Relative contribution of each column to the model's decisions"
              icon={BarChart3}
            />
            <div className="p-5" style={{ height: Math.max(260, importance.length * 38) }}>
              {importance.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={importance} layout="vertical" margin={{ left: 10, right: 24 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      width={130}
                      tick={{ fontSize: 12, fill: '#475569' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid #e2e8f0' }}
                      formatter={(value) => [`${value}%`, 'importance']}
                    />
                    <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
                      {importance.map((_, index) => (
                        <Cell
                          key={index}
                          fill={`rgba(99, 102, 241, ${1 - Math.min(index * 0.06, 0.65)})`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400">
                  Importance could not be computed for this model.
                </p>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Run configuration" icon={Layers} />
              <dl className="divide-y divide-slate-100 text-sm">
                {[
                  ['Algorithm', experiment.algorithm_label],
                  ['Task', experiment.task_type],
                  ['Target', experiment.target_column],
                  ['Test split', `${Math.round((experiment.params?.test_size || 0.2) * 100)}%`],
                  [
                    'Cross-validation',
                    experiment.params?.cross_validation
                      ? `${experiment.params.cv_folds} folds`
                      : 'Off',
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 px-5 py-3">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="truncate font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
                {Object.entries(experiment.params?.hyperparams || {}).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 px-5 py-3">
                    <dt className="font-mono text-xs text-slate-500">{key}</dt>
                    <dd className="font-mono text-xs font-semibold text-brand-600">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Features used" icon={Grid3x3} />
              <div className="flex flex-wrap gap-2 p-5">
                {(experiment.feature_columns || []).map((f) => (
                  <span
                    key={f}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'predict' && <PredictPanel experiment={experiment} />}
    </>
  )
}
