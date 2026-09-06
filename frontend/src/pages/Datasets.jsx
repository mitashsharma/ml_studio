import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Database,
  UploadCloud,
  FileSpreadsheet,
  Trash2,
  Sparkles,
  Download,
  PackageOpen,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatBytes, formatNumber, timeAgo } from '../lib/format'
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  PageLoader,
  Spinner,
} from '../components/ui'
import { useToast } from '../context/ToastContext'

export default function Datasets() {
  const toast = useToast()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [datasets, setDatasets] = useState([])
  const [samples, setSamples] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState('')

  const load = useCallback(async () => {
    try {
      const [dsRes, sampleRes] = await Promise.all([
        api.get('/api/datasets'),
        api.get('/api/datasets/samples'),
      ])
      setDatasets(dsRes.datasets)
      setSamples(sampleRes.samples)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  async function uploadFile(file) {
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { dataset } = await api.upload('/api/datasets', formData)
      toast.success(`${dataset.name} uploaded — ${formatNumber(dataset.n_rows, 0)} rows profiled.`)
      navigate(`/datasets/${dataset.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  async function importSample(key) {
    setImporting(key)
    try {
      const { dataset } = await api.post(`/api/datasets/samples/${key}`)
      toast.success(`${dataset.name} added to your workspace.`)
      navigate(`/datasets/${dataset.id}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setImporting('')
    }
  }

  async function remove(dataset) {
    if (!window.confirm(`Delete "${dataset.name}" and its experiments?`)) return
    try {
      await api.delete(`/api/datasets/${dataset.id}`)
      setDatasets((current) => current.filter((d) => d.id !== dataset.id))
      toast.success('Dataset deleted.')
    } catch (err) {
      toast.error(err.message)
    }
  }

  if (loading) return <PageLoader label="Loading datasets…" />

  return (
    <>
      <PageHeader
        title="Datasets"
        subtitle="Upload tabular files, inspect their health, and use them to train models."
        icon={Database}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Upload */}
        <div className="lg:col-span-2">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              uploadFile(e.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
              dragging
                ? 'border-brand-400 bg-brand-50'
                : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
            }`}
          >
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              {uploading ? <Spinner className="h-6 w-6" /> : <UploadCloud className="h-7 w-7" />}
            </span>
            <p className="text-base font-bold text-slate-800">
              {uploading ? 'Uploading and profiling…' : 'Drop a file here, or click to browse'}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              CSV, TSV, Excel or JSON · up to 32 MB · first row should contain column names
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.tsv,.xlsx,.xls,.json"
              className="hidden"
              onChange={(e) => uploadFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Samples */}
        <Card>
          <CardHeader title="Sample datasets" subtitle="Try ML Studio instantly" icon={PackageOpen} />
          <div className="divide-y divide-slate-100">
            {samples.map((sample) => (
              <div key={sample.key} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{sample.name}</p>
                  <p className="text-xs text-slate-500">{formatBytes(sample.size)}</p>
                </div>
                <button
                  className="btn-secondary px-3 py-1.5 text-xs"
                  onClick={() => importSample(sample.key)}
                  disabled={importing === sample.key}
                >
                  {importing === sample.key ? <Spinner className="h-3.5 w-3.5" /> : 'Import'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-8">
        {datasets.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No datasets yet"
            description="Upload a file above or import one of the built-in samples to get started."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {datasets.map((dataset) => (
              <Card key={dataset.id} className="group flex flex-col p-5 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <Link to={`/datasets/${dataset.id}`} className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-brand-700">
                      {dataset.name}
                    </h3>
                    <p className="truncate text-xs text-slate-500">{dataset.original_filename}</p>
                  </Link>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <FileSpreadsheet className="h-5 w-5" />
                  </span>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Rows', formatNumber(dataset.n_rows, 0)],
                    ['Columns', dataset.n_columns],
                    ['Runs', dataset.experiment_count],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-slate-50 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {label}
                      </dt>
                      <dd className="text-sm font-bold text-slate-800">{value}</dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 text-xs text-slate-400">
                  {formatBytes(dataset.file_size)} · added {timeAgo(dataset.created_at)}
                </p>

                <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <Link
                    to={`/train?dataset=${dataset.id}`}
                    className="btn-primary flex-1 px-3 py-2 text-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Train
                  </Link>
                  <Link to={`/datasets/${dataset.id}`} className="btn-secondary px-3 py-2 text-xs">
                    Explore
                  </Link>
                  <button
                    className="btn-ghost px-2 py-2"
                    title="Download"
                    onClick={() =>
                      api
                        .download(`/api/datasets/${dataset.id}/download`, dataset.original_filename)
                        .catch((err) => toast.error(err.message))
                    }
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-ghost px-2 py-2 text-slate-400 hover:text-rose-600"
                    title="Delete"
                    onClick={() => remove(dataset)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
