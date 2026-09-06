import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import { PageLoader } from './components/ui'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Datasets from './pages/Datasets'
import DatasetDetail from './pages/DatasetDetail'
import Train from './pages/Train'
import Experiments from './pages/Experiments'
import ExperimentDetail from './pages/ExperimentDetail'
import Guide from './pages/Guide'

function Protected({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader label="Starting ML Studio…" />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  return <Layout>{children}</Layout>
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <Login />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <Register />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <Protected>
            <Dashboard />
          </Protected>
        }
      />
      <Route
        path="/datasets"
        element={
          <Protected>
            <Datasets />
          </Protected>
        }
      />
      <Route
        path="/datasets/:id"
        element={
          <Protected>
            <DatasetDetail />
          </Protected>
        }
      />
      <Route
        path="/train"
        element={
          <Protected>
            <Train />
          </Protected>
        }
      />
      <Route
        path="/experiments"
        element={
          <Protected>
            <Experiments />
          </Protected>
        }
      />
      <Route
        path="/experiments/:id"
        element={
          <Protected>
            <ExperimentDetail />
          </Protected>
        }
      />
      <Route
        path="/guide"
        element={
          <Protected>
            <Guide />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
