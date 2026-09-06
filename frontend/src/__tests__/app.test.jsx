import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '../App'
import { AuthProvider } from '../context/AuthContext'
import { ToastProvider } from '../context/ToastContext'

const OVERVIEW = {
  dataset_count: 2,
  experiment_count: 3,
  success_count: 3,
  failed_count: 0,
  total_rows: 2100,
  best_experiment: {
    id: 1,
    name: 'Churn risk',
    primary_metric: { label: 'Accuracy', value: 0.89 },
  },
  recent_experiments: [
    {
      id: 1,
      name: 'Churn risk',
      dataset_name: 'Customer Churn',
      task_type: 'classification',
      status: 'success',
      created_at: '2026-01-01T10:00:00',
      primary_metric: { label: 'Accuracy', value: 0.89 },
    },
  ],
  recent_datasets: [
    { id: 1, name: 'Customer Churn', n_rows: 1200, n_columns: 8, created_at: '2026-01-01T10:00:00' },
  ],
  score_history: [],
  task_breakdown: [],
}

const EXPERIMENT = {
  id: 1,
  name: 'Churn risk',
  dataset_id: 1,
  dataset_name: 'Customer Churn',
  task_type: 'classification',
  algorithm: 'random_forest_classifier',
  algorithm_label: 'Random Forest',
  target_column: 'churn',
  status: 'success',
  duration_ms: 420,
  created_at: '2026-01-01T10:00:00',
  primary_metric: { label: 'Accuracy', value: 0.89 },
  feature_columns: ['tenure_months', 'monthly_charges'],
  params: { test_size: 0.2, cross_validation: true, cv_folds: 5, hyperparams: { n_estimators: 200 } },
  metrics: {
    accuracy: 0.89,
    f1: 0.89,
    precision: 0.9,
    recall: 0.89,
    roc_auc: 0.96,
    balanced_accuracy: 0.89,
    train_rows: 960,
    test_rows: 240,
    n_features: 7,
    cv_mean: 0.88,
    cv_std: 0.02,
  },
  charts: {
    confusion_matrix: { labels: ['churned', 'retained'], matrix: [[121, 16], [10, 93]] },
    per_class: [
      { label: 'churned', precision: 0.92, recall: 0.88, f1: 0.9, support: 137 },
      { label: 'retained', precision: 0.85, recall: 0.9, f1: 0.88, support: 103 },
    ],
    class_distribution: [{ label: 'churned', count: 137 }],
    feature_importance: [{ feature: 'monthly_charges', importance: 32.1 }],
    cv_scores: [{ fold: 'Fold 1', score: 0.88 }],
  },
}

const ROUTES = {
  '/api/auth/me': { user: { id: 1, username: 'Ada Lovelace', email: 'ada@example.com' } },
  '/api/overview': OVERVIEW,
  '/api/datasets': { datasets: OVERVIEW.recent_datasets },
  '/api/datasets/samples': { samples: [{ key: 'iris_flowers', name: 'Iris Flowers', size: 3858 }] },
  '/api/experiments': { experiments: [EXPERIMENT] },
  '/api/experiments/1': { experiment: EXPERIMENT },
  '/api/algorithms': {
    classification: [
      {
        key: 'random_forest_classifier',
        label: 'Random Forest',
        task: 'classification',
        description: 'Robust ensemble',
        hyperparams: [{ name: 'n_estimators', label: 'Trees', type: 'int', default: 200 }],
      },
    ],
    regression: [],
  },
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.setItem('mlstudio.token', 'fake-token')
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      const path = String(url).split('?')[0]
      const body = ROUTES[path] ?? {}
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(body),
      })
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('ML Studio UI', () => {
  it('renders the dashboard for a signed-in user', async () => {
    renderAt('/')
    expect(await screen.findByText(/Hello, Ada/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Rows analysed')).toBeTruthy())
    expect(screen.getByText('Recent experiments')).toBeTruthy()
  })

  it('renders the datasets page with samples', async () => {
    renderAt('/datasets')
    expect(await screen.findByText('Sample datasets')).toBeTruthy()
    expect(await screen.findByText('Iris Flowers')).toBeTruthy()
  })

  it('renders the training wizard', async () => {
    renderAt('/train')
    expect(await screen.findByText('Pick a dataset')).toBeTruthy()
    expect(screen.getByText('Run summary')).toBeTruthy()
  })

  it('renders experiment metrics and the confusion matrix', async () => {
    renderAt('/experiments/1')
    expect(await screen.findByText('Confusion matrix')).toBeTruthy()
    expect(screen.getAllByText('89.0%').length).toBeGreaterThan(0)
    expect(screen.getByText('Per-class performance')).toBeTruthy()
  })

  it('redirects to login without a token', async () => {
    localStorage.clear()
    renderAt('/')
    expect((await screen.findAllByText('Sign in')).length).toBeGreaterThan(0)
  })
})
