import { Link } from 'react-router-dom'
import { Sparkles, CheckCircle2 } from 'lucide-react'

const HIGHLIGHTS = [
  'Upload a CSV and get an instant data health report',
  '13 algorithms for classification and regression',
  'Confusion matrices, feature importance, residuals — no plotting code',
  'Live predictions and one-click model download',
]

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-sky-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="grid-paper absolute inset-0 opacity-30" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight">ML Studio</span>
          </div>
          <h2 className="mt-16 max-w-md text-4xl font-extrabold leading-tight tracking-tight">
            From raw spreadsheet to trained model in three clicks.
          </h2>
          <p className="mt-4 max-w-md text-white/80">
            A friendly workbench for tabular machine learning. Bring the data — ML Studio handles
            cleaning, encoding, training and evaluation.
          </p>
          <ul className="mt-10 space-y-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center gap-6 text-sm text-white/70">
          <span>Python · Flask · scikit-learn</span>
          <span>React · Vite · Tailwind</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-sky-500 text-white">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">ML Studio</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}

          <p className="mt-10 text-center text-xs text-slate-400">
            New here?{' '}
            <Link to="/register" className="font-semibold text-brand-600 hover:underline">
              Create a free workspace
            </Link>{' '}
            — everything runs locally on your machine.
          </p>
        </div>
      </div>
    </div>
  )
}
