import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { UserRole } from "./profile.service";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole: UserRole;
}

export default function ProtectedRoute({
  children,
  allowedRole,
}: ProtectedRouteProps) {
  const {
    user,
    profile,
    loading,
    profileLoading,
    profileError,
  } = useAuth();

  // Show blocking verification screen only during initial session check
  // or when an authenticated user's profile has not yet been loaded.
  // A background profile refresh when a profile is already present must not unmount children.
  if (loading || (!profile && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-600">Verifying access...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profileError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-600">
            Unable to verify your account
          </h1>
          <p className="mt-2 text-slate-600">
            {profileError || "Your user profile is unavailable."}
          </p>
        </div>
      </div>
    );
  }

  if (profile.role !== allowedRole) {
    const destination =
      profile.role === "admin" ? "/admin" : "/client";

    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}