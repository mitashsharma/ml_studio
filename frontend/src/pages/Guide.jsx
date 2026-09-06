import { BookOpen, Workflow, Terminal, ShieldCheck, Lightbulb } from 'lucide-react'
import { Card, CardHeader, PageHeader } from '../components/ui'

const PIPELINE = [
  {
    title: '1 · Profile',
    body: 'Every upload is parsed with pandas, then profiled: types, missing values, uniqueness, distributions, correlations and a 0-100 quality score.',
  },
  {
    title: '2 · Prepare',
    body: 'Numeric columns get median imputation + standardisation. Categorical columns get most-frequent imputation + one-hot encoding (unseen categories at predict time are ignored).',
  },
  {
    title: '3 · Split',
    body: 'A stratified train/test split (when possible) holds back the percentage you choose so the reported score reflects unseen data.',
  },
  {
    title: '4 · Fit & score',
    body: 'The scikit-learn pipeline is fitted, then evaluated with task-appropriate metrics plus optional k-fold cross-validation.',
  },
  {
    title: '5 · Explain & ship',
    body: 'Feature importance (native or permutation-based) is aggregated back to your original columns. The fitted pipeline is saved as a .joblib you can download and reuse.',
  },
]

const ENDPOINTS = [
  ['POST', '/api/auth/register', 'Create an account, returns a JWT'],
  ['POST', '/api/auth/login', 'Exchange credentials for a JWT'],
  ['GET', '/api/datasets', 'List your datasets'],
  ['POST', '/api/datasets', 'Multipart upload of a CSV/Excel/JSON file'],
  ['GET', '/api/datasets/:id', 'Dataset metadata + full profile'],
  ['GET', '/api/datasets/:id/preview', 'First N rows as JSON'],
  ['GET', '/api/algorithms', 'Catalogue of models and hyper-parameters'],
  ['POST', '/api/experiments', 'Train a model and get metrics back'],
  ['GET', '/api/experiments/:id', 'Metrics, charts and configuration'],
  ['POST', '/api/experiments/:id/predict', 'Score one row or a batch'],
  ['GET', '/api/experiments/:id/download', 'Download the fitted pipeline (.joblib)'],
]

const TIPS = [
  'Aim for at least a few hundred rows — small datasets produce noisy scores.',
  'If accuracy looks suspiciously perfect, check for a column that leaks the answer.',
  'Turn on cross-validation to see whether a score is stable or just a lucky split.',
  'Drop ID-like columns from the features: they add noise but no signal.',
  'For imbalanced classes, read balanced accuracy and per-class recall, not just accuracy.',
]

export default function Guide() {
  return (
    <>
      <PageHeader
        title="How ML Studio works"
        subtitle="A quick tour of the pipeline, the API and a few modelling tips."
        icon={BookOpen}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="The training pipeline" subtitle="What happens after you click Train" icon={Workflow} />
          <ol className="space-y-4 p-5">
            {PIPELINE.map((step) => (
              <li key={step.title} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-bold text-slate-800">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Modelling tips" icon={Lightbulb} />
            <ul className="space-y-3 p-5">
              {TIPS.map((tip) => (
                <li key={tip} className="flex gap-2.5 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Your data stays put" icon={ShieldCheck} />
            <p className="p-5 text-sm leading-relaxed text-slate-600">
              Files are stored under <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">instance/uploads/&lt;your-id&gt;/</code>{' '}
              on the machine running the server, models under{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">instance/artifacts/</code>. Nothing is
              sent to a third-party service, and every request is scoped to your account.
            </p>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="REST API"
          subtitle="Everything in the UI is available programmatically — send the JWT as a Bearer token"
          icon={Terminal}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {ENDPOINTS.map(([method, path, description]) => (
                <tr key={path + method} className="border-b border-slate-50">
                  <td className="w-20 px-5 py-3">
                    <span
                      className={`rounded-md px-2 py-1 font-mono text-[11px] font-bold ${
                        method === 'GET' ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-800">{path}</td>
                  <td className="px-4 py-3 text-slate-500">{description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 p-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Example</p>
          <pre className="overflow-x-auto rounded-xl bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
{`curl -X POST http://localhost:5000/api/experiments \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"dataset_id": 1, "target_column": "churn",
       "algorithm": "gradient_boosting_classifier",
       "cross_validation": true}'`}
          </pre>
        </div>
      </Card>
    </>
  )
}
