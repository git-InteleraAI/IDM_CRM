import { useEffect, useMemo, useState } from "react";

import {
  clientService,
  type Client,
} from "../services/client.service";

import AddClientModal from "../components/AddClientModal";
import EditClientModal from "../components/EditClientModal";

export default function ClientListPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Fetch all clients
  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await clientService.getAllClients();
      setClients(data);
    } catch (err) {
      console.error("Failed to fetch clients:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load clients."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchClients();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // Search clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [clients, searchTerm]);

  // Dashboard statistics
  const activeCount = clients.filter(
    (client) => client.status === "active"
  ).length;

  const inactiveCount = clients.filter(
    (client) => client.status === "inactive"
  ).length;

  // Format created date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Handle newly created client
  const handleClientCreated = (client: Client) => {
    setClients((previousClients) => [
      client,
      ...previousClients,
    ]);
  };

  // Handle updated client
  const handleClientUpdated = (updatedClient: Client) => {
    setClients((previousClients) =>
      previousClients.map((client) =>
        client.id === updatedClient.id ? updatedClient : client
      )
    );

    setEditingClient(null);
  };

  // Activate or deactivate client
  const handleToggleStatus = async (client: Client) => {
    const newStatus =
      client.status === "active" ? "inactive" : "active";

    const confirmed = window.confirm(
      `Are you sure you want to ${
        newStatus === "inactive" ? "deactivate" : "activate"
      } ${client.name}?`
    );

    if (!confirmed) return;

    try {
      const updatedClient = await clientService.setClientStatus(
        client.id,
        newStatus
      );

      setClients((previousClients) =>
        previousClients.map((item) =>
          item.id === updatedClient.id ? updatedClient : item
        )
      );
    } catch (err) {
      console.error("Failed to update client status:", err);

      window.alert(
        err instanceof Error
          ? err.message
          : "Unable to update client status."
      );
    }
  };

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Client Management
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Create, manage and monitor your digital marketing clients.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          + Add New Client
        </button>
      </div>

      {/* Statistics */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total Clients</p>
          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            {clients.length}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active Clients</p>
          <h2 className="mt-2 text-3xl font-bold text-green-600">
            {activeCount}
          </h2>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Inactive Clients</p>
          <h2 className="mt-2 text-3xl font-bold text-red-600">
            {inactiveCount}
          </h2>
        </div>

      </div>

      {/* Client Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        {/* Table Header and Search */}
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              All Clients
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage your registered client accounts.
            </p>
          </div>

          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search clients..."
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:max-w-xs"
          />
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">

            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Created Date</th>
                <th className="px-6 py-4 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-16 text-center text-slate-500"
                  >
                    Loading clients...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <p className="font-medium text-red-600">
                      Failed to load clients
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      {error}
                    </p>

                    <button
                      type="button"
                      onClick={() => void fetchClients()}
                      className="mt-3 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Try again
                    </button>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <h3 className="font-semibold text-slate-800">
                      No clients found
                    </h3>

                    <p className="mt-2 text-sm text-slate-500">
                      {searchTerm
                        ? "No clients match your search."
                        : "Create your first client to get started."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr
                    key={client.id}
                    className="border-t border-slate-100 hover:bg-slate-50"
                  >
                    {/* Client Name and Logo */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {client.logo_url ? (
                          <img
                            src={client.logo_url}
                            alt={`${client.name} logo`}
                            className="h-10 w-10 rounded-lg border border-slate-200 object-contain"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 font-semibold text-blue-600">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <span className="font-medium text-slate-800">
                          {client.name}
                        </span>
                      </div>
                    </td>

                    {/* Client Status */}
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          client.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {client.status}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(client.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingClient(client)}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleStatus(client)}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                            client.status === "active"
                              ? "text-red-600 hover:bg-red-50"
                              : "text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {client.status === "active"
                            ? "Deactivate"
                            : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <AddClientModal
          onClose={() => setShowAddModal(false)}
          onClientCreated={handleClientCreated}
        />
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <EditClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onClientUpdated={handleClientUpdated}
        />
      )}

    </div>
  );
}