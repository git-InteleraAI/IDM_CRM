import { Routes, Route, Navigate, Link } from "react-router-dom";

import LoginPage from "./features/auth/LoginPage";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import AdminLayout from "./layouts/AdminLayout";
import LogoutButton from "./features/auth/LogoutButton";

import ClientListPage from "./features/clients/pages/ClientListPage";
import CampaignListPage from "./features/campaigns/pages/CampaignListPage";
import AdminSyncDashboard from "./features/sync/pages/AdminSyncDashboard";
import AdminLeadManagementPage from "./features/leads/pages/AdminLeadManagementPage";

function ClientDashboard() {
  return (
    <div className="min-h-screen bg-slate-100 p-10">
      <div className="flex items-center justify-between rounded-xl bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Client Dashboard
          </h1>

          <p className="mt-2 text-slate-600">
            View campaigns and manage leads.
          </p>
        </div>

        <LogoutButton />
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-bold">
        404 - Page Not Found
      </h1>

      <Link
        to="/login"
        className="mt-4 inline-block text-blue-600"
      >
        Return to Login
      </Link>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/login" replace />}
      />

      <Route
        path="/login"
        element={<LoginPage />}
      />

      {/* Admin Portal */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRole="admin">
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={<AdminSyncDashboard />}
        />

        <Route
          path="clients"
          element={<ClientListPage />}
        />

        <Route
          path="campaigns"
          element={<CampaignListPage />}
        />

        <Route
          path="leads"
          element={<AdminLeadManagementPage />}
        />
      </Route>

      {/* Client Portal */}
      <Route
        path="/client"
        element={
          <ProtectedRoute allowedRole="client">
            <ClientDashboard />
          </ProtectedRoute>
        }
      />

      {/* Not Found */}
      <Route
        path="*"
        element={<NotFoundPage />}
      />
    </Routes>
  );
}

export default App;