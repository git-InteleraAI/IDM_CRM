import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext";
import LogoutButton from "../features/auth/LogoutButton";

const navigationItems = [
  {
    name: "Dashboard",
    path: "/admin",
    icon: "▦",
    end: true,
  },
  {
    name: "Client Management",
    path: "/admin/clients",
    icon: "♙",
    end: false,
  },
  {
    name: "Campaign Management",
    path: "/admin/campaigns",
    icon: "▣",
    end: false,
  },
  {
    name: "Lead Management",
    path: "/admin/leads",
    icon: "☷",
    end: false,
  },
];

export default function AdminLayout() {
  const { profile } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 text-white">
        {/* Branding */}
        <div className="border-b border-slate-700 px-6 py-6">
          <h1 className="text-xl font-bold tracking-wide">
            INTELERA
          </h1>

          <p className="mt-1 text-xs text-slate-400">
            Digital Marketing Portal
          </p>
        </div>

        {/* Navigation */}
        <div className="px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Main Menu
          </p>

          <nav className="space-y-2">
            {navigationItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`
                }
              >
                <span className="text-lg">
                  {item.icon}
                </span>

                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Admin Profile */}
        <div className="mt-auto border-t border-slate-700 p-4">
          <p className="text-xs text-slate-400">
            Logged in as
          </p>

          <p className="mt-1 truncate text-sm font-semibold">
            {profile?.full_name || "Administrator"}
          </p>

          <p className="mb-4 mt-1 text-xs text-blue-400">
            Administrator
          </p>

          <LogoutButton />
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <h2 className="text-lg font-semibold text-slate-800">
            Admin Portal
          </h2>

          <span className="text-sm text-slate-500">
            Management Console
          </span>
        </header>

        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}