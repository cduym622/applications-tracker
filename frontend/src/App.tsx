import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import ApplicationList from './pages/ApplicationList'
import ApplicationCreate from './pages/ApplicationCreate'
import ApplicationEdit from './pages/ApplicationEdit'
import ApplicationDetail from './pages/ApplicationDetail'

function RequireAuth() {
  const { signedIn } = useAuth()
  return signedIn ? <Outlet /> : <Navigate to="/login" replace />
}

function RedirectIfAuthed() {
  const { signedIn } = useAuth()
  return signedIn ? <Navigate to="/dashboard" replace /> : <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route element={<RedirectIfAuthed />}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/applications" element={<ApplicationList />} />
        <Route path="/applications/new" element={<ApplicationCreate />} />
        <Route path="/applications/:id" element={<ApplicationDetail />} />
        <Route path="/applications/:id/edit" element={<ApplicationEdit />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
