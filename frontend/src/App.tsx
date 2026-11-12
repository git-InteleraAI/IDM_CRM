import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'

function LoginPage() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-3xl font-bold">Intelera DM Portal</h1>
      <p className="mt-3 text-slate-600">Login Page</p>
    </div>
  )
}

function AdminDashboard() {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      <p className="mt-2 text-slate-600">
        Manage clients, campaigns and leads.
      </p>
    </div>
  )
}

function ClientDashboard() {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Client Dashboard</h1>
      <p className="mt-2 text-slate-600">
        View campaigns and manage leads.
      </p>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
      <Link to="/login" className="mt-4 inline-block text-blue-600">
        Return to Login
      </Link>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/client" element={<ClientDashboard />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App