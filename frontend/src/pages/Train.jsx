import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Sparkles,
  Database,
  Target,
  Cpu,
  Check,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Wand2,
  Info,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatNumber } from '../lib/format'
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  PageLoader,
  Spinner,
  TaskBadge,
} from '../components/ui'
import { useToast } from '../context/ToastContext'

const STEPS = [
  { id: 1, label: 'Dataset', icon: Database },
  { id: 2, label: 'Target & features', icon: Target },
  { id: 3, label: 'Algorithm', icon: Cpu },
]

function Stepper({ step, onSelect, maxStep }) {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-2">
      {STEPS.map(({ id, label, icon: Icon }, index) => {
        const state = step === id ? 'current' : id < step ? 'done' : 'todo'
        return (
          <div key={id} className="flex items-center gap-2">
            <button
              disabled={id > maxStep}
              onClick={() => onSelect(id)}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${
                state === 'current'
                  ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
                  : state === 'done'
                    ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100'
                    : 'bg-white text-slate-400 ring-1 ring-slate-200'
              }`}
            >
              {state === 'done' ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              {label}
            </button>
            {index < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
          </div>
        )
      })}
    </div>
  )
}

export default function Train() {
  const toast = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [datasets, setDatasets] = useState([])
  const [catalogue, setCatalogue] = useState({ classification: [], regression: [] })
  const [loading, setLoading] = useState(true)

  const [step, setStep] = useState(1)
  const [datasetId, setDatasetId] = useState(null)
  const [profile, setProfile] = useState(null)
  const [target, setTarget] = useState('')
  const [features, setFeatures] = useState([])
  const [taskType, setTaskType] = useState('')
  const [algorithm, setAlgorithm] = useState('')
  const [hyperparams, setHyperparams] = useState({})
  const [testSize, setTestSize] = useState(0.2)
  const [crossValidation, setCrossValidation] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [training, setTraining] = useState(false)

  useEffect(() => {
    Promise.all([api.get('/api/datasets'), api.get('/api/algorithms')])
      .then(([d, a]) => {
        setDatasets(d.datasets)
        setCatalogue(a)
        const preselect = Number(searchParams.get('dataset'))
        if (preselect && d.datasets.some((x) => x.id === preselect)) {
          setDatasetId(preselect)
        }
      })
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [searchParams, toast])

  const loadProfile = useCallback(
    async (id) => {
      try {
        const { dataset } = await api.get(`/api/datasets/${id}`)
        setProfile(dataset)
        const columns = dataset.profile?.columns || []
        const suggested = columns[columns.length - 1]
        if (suggested) selectTarget(suggested, columns)
      } catch (err) {
        toast.error(err.message)
      }
    },
    [toast],
  )

  useEffect(() => {
    if (datasetId) loadProfile(datasetId)
  }, [datasetId, loadProfile])

  function selectTarget(column, columnsOverride) {
    const columns = columnsOverride || profile?.profile?.columns || []
    setTarget(column.name)
    setFeatures(columns.filter((c) => c.name !== column.name).map((c) => c.name))
    setTaskType(column.suggested_task)
    setAlgorithm('')
    setHyperparams({})
  }

  const algorithms = useMemo(() => catalogue[taskType] || [], [catalogue, taskType])
  const selectedAlgorithm = algorithms.find((a) => a.key === algorithm)

  useEffect(() => {
    if (!algorithm && algorithms.length) {
      const preferred =
        algorithms.find((a) => a.key.startsWith('random_forest')) || algorithms[0]
      setAlgorithm(preferred.key)
      setHyperparams(
        Object.fromEntries(preferred.hyperparams.map((h) => [h.name, h.default])),
      )
    }
  }, [algorithms, algorithm])

  function chooseAlgorithm(algo) {
    setAlgorithm(algo.key)
    setHyperparams(Object.fromEntries(algo.hyperparams.map((h) => [h.name, h.default])))
  }

  function toggleFeature(name) {
    setFeatures((current) =>
      current.includes(name) ? current.filter((f) => f !== name) : [...current, name],
    )
  }

  async function handleTrain() {
    setTraining(true)
    try {
      const { experiment } = await api.post('/api/experiments', {
        dataset_id: datasetId,
        target_column: target,
        feature_columns: features,
        task_type: taskType,
        algorithm,
        hyperparams,
        test_size: Number(testSize),
        cross_validation: crossValidation,
      })
      toast.success('Model trained successfully!')
      navigate(`/experiments/${experiment.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTraining(false)
    }
  }

  if (loading) return <PageLoader label="Preparing the studio…" />

  if (datasets.length === 0) {
    return (
      <>
        <PageHeader title="Train a model" icon={Sparkles} />
        <EmptyState
          icon={Database}
          title="You need a dataset first"
          description="Upload a CSV or import one of the built-in samples, then come back here."
          actionLabel="Go to datasets"
          actionTo="/datasets"
        />
      </>
    )
  }

  const columns = profile?.profile?.columns || []
  const maxStep = datasetId ? (target ? 3 : 2) : 1

  return (
    <>
      <PageHeader
        title="Train a model"
        subtitle="Three steps: choose data, choose what to predict, choose an algorithm."
        icon={Sparkles}
      />

      <Stepper step={step} onSelect={setStep} maxStep={maxStep} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Step 1 */}
          {step === 1 && (
            <Card>
              <CardHeader title="Pick a dataset" subtitle="Everything in your workspace" icon={Database} />
              <div className="grid gap-3 p-5 sm:grid-cols-2">
                {datasets.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setDatasetId(d.id)}
                    className={`rounded-2xl p-4 text-left transition ${
                      datasetId === d.id
                        ? 'bg-brand-50 ring-2 ring-brand-500'
                        : 'bg-white ring-1 ring-slate-200 hover:ring-brand-300'
                    }`}
                  >
                    <p className="truncate font-bold text-slate-800">{d.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatNumber(d.n_rows, 0)} rows · {d.n_columns} columns
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <Card>
                <CardHeader
                  title="What should the model predict?"
                  subtitle="We infer the task type from the column you pick"
                  icon={Target}
                />
                <div className="grid gap-2 p-5 sm:grid-cols-2">
                  {columns.map((column) => (
                    <button
                      key={column.name}
                      onClick={() => selectTarget(column)}
                      className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition ${
                        target === column.name
                          ? 'bg-brand-50 ring-2 ring-brand-500'
                          : 'bg-white ring-1 ring-slate-200 hover:ring-brand-300'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">
                          {column.name}
                        </span>
                        <span className="text-xs text-slate-500">
                          {column.unique} unique · {column.missing_pct}% missing
                        </span>
                      </span>
                      <TaskBadge task={column.suggested_task} />
                    </button>
                  ))}
                </div>
              </Card>

              {target && (
                <Card>
                  <CardHeader
                    title="Feature columns"
                    subtitle={`${features.length} of ${columns.length - 1} selected`}
                    icon={SlidersHorizontal}
                    action={
                      <button
                        className="text-xs font-semibold text-brand-600 hover:underline"
                        onClick={() =>
                          setFeatures(
                            features.length === columns.length - 1
                              ? []
                              : columns.filter((c) => c.name !== target).map((c) => c.name),
                          )
                        }
                      >
                        {features.length === columns.length - 1 ? 'Clear all' : 'Select all'}
                      </button>
                    }
                  />
                  <div className="flex flex-wrap gap-2 p-5">
                    {columns
                      .filter((c) => c.name !== target)
                      .map((column) => {
                        const active = features.includes(column.name)
                        return (
                          <button
                            key={column.name}
                            onClick={() => toggleFeature(column.name)}
                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                              active
                                ? 'bg-brand-600 text-white'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {active && <Check className="h-3.5 w-3.5" />}
                            {column.name}
                            <span className={active ? 'text-white/60' : 'text-slate-400'}>
                              {column.type.slice(0, 3)}
                            </span>
                          </button>
                        )
                      })}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <>
              <Card>
                <CardHeader
                  title="Choose an algorithm"
                  subtitle={`${taskType === 'classification' ? 'Classification' : 'Regression'} models`}
                  icon={Cpu}
                />
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  {algorithms.map((algo) => (
                    <button
                      key={algo.key}
                      onClick={() => chooseAlgorithm(algo)}
                      className={`rounded-2xl p-4 text-left transition ${
                        algorithm === algo.key
                          ? 'bg-brand-50 ring-2 ring-brand-500'
                          : 'bg-white ring-1 ring-slate-200 hover:ring-brand-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-slate-800">{algo.label}</p>
                        {algorithm === algo.key && <Check className="h-4 w-4 text-brand-600" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">{algo.description}</p>
                    </button>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Training options"
                  icon={SlidersHorizontal}
                  action={
                    <button
                      className="text-xs font-semibold text-brand-600 hover:underline"
                      onClick={() => setShowAdvanced((v) => !v)}
                    >
                      {showAdvanced ? 'Hide' : 'Show'} hyper-parameters
                    </button>
                  }
                />
                <div className="space-y-5 p-5">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="label mb-0">Test set size</label>
                      <span className="font-mono text-sm font-semibold text-brand-600">
                        {Math.round(testSize * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.4"
                      step="0.05"
                      value={testSize}
                      onChange={(e) => setTestSize(e.target.value)}
                      className="mt-3 w-full accent-brand-600"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Rows held back to measure real-world performance.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4">
                    <input
                      type="checkbox"
                      checked={crossValidation}
                      onChange={(e) => setCrossValidation(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-brand-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-slate-800">
                        5-fold cross-validation
                      </span>
                      <span className="text-xs text-slate-500">
                        Slower, but tells you how stable the score is across different splits.
                      </span>
                    </span>
                  </label>

                  {showAdvanced && selectedAlgorithm && (
                    <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
                      {selectedAlgorithm.hyperparams.length === 0 && (
                        <p className="text-sm text-slate-500">
                          This algorithm has no tunable parameters — it just works.
                        </p>
                      )}
                      {selectedAlgorithm.hyperparams.map((param) => (
                        <div key={param.name}>
                          <label className="label">{param.label}</label>
                          {param.type === 'select' ? (
                            <select
                              className="input"
                              value={hyperparams[param.name] ?? param.default}
                              onChange={(e) =>
                                setHyperparams({ ...hyperparams, [param.name]: e.target.value })
                              }
                            >
                              {param.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="number"
                              className="input"
                              min={param.min ?? undefined}
                              max={param.max ?? undefined}
                              step={param.step ?? undefined}
                              value={hyperparams[param.name] ?? param.default}
                              onChange={(e) =>
                                setHyperparams({ ...hyperparams, [param.name]: e.target.value })
                              }
                            />
                          )}
                          {param.help && <p className="mt-1 text-xs text-slate-400">{param.help}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}

          <div className="flex items-center justify-between">
            <button
              className="btn-secondary"
              disabled={step === 1}
              onClick={() => setStep(step - 1)}
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < 3 ? (
              <button
                className="btn-primary"
                disabled={(step === 1 && !datasetId) || (step === 2 && (!target || !features.length))}
                onClick={() => setStep(step + 1)}
              >
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button className="btn-primary" onClick={handleTrain} disabled={training || !algorithm}>
                {training ? <Spinner className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
                {training ? 'Training…' : 'Train model'}
              </button>
            )}
          </div>
        </div>

        {/* Summary rail */}
        <div className="lg:sticky lg:top-8 lg:self-start">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 to-sky-500 px-5 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-white/70">Run summary</p>
              <p className="mt-1 text-lg font-extrabold">
                {selectedAlgorithm?.label || 'Choose an algorithm'}
              </p>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              {[
                ['Dataset', profile?.name || '—'],
                ['Rows', profile ? formatNumber(profile.n_rows, 0) : '—'],
                ['Target', target || '—'],
                ['Features', features.length ? `${features.length} selected` : '—'],
                ['Test split', `${Math.round(testSize * 100)}%`],
                ['Cross-validation', crossValidation ? '5 folds' : 'Off'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-5 py-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="truncate font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="text-slate-500">Task</dt>
                <dd>{taskType ? <TaskBadge task={taskType} /> : <Badge>—</Badge>}</dd>
              </div>
            </dl>
            <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4 text-xs text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              <p>
                Missing values are imputed, categories one-hot encoded and numbers standardised
                automatically before training.{' '}
                <Link to="/guide" className="font-semibold text-brand-600 hover:underline">
                  How it works
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
