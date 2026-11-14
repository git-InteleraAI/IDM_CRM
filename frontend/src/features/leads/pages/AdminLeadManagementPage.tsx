import { useCallback, useEffect, useState } from "react";
import {
  leadService,
  type Lead,
  type LeadListResponse,
} from "../services/lead.service";

function formatDate(value: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function LeadDetails({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const details: [string, string | null | undefined][] = [
    ["Name", lead.full_name],
    ["Phone", lead.phone_number],
    ["Email", lead.email],
    ["Area", lead.area],
    ["Platform", lead.platform?.toUpperCase()],
    ["Lead created", formatDate(lead.created_time)],
    ["Source status", lead.source_status],
    ["Priority", lead.priority],
    ["Campaign ID", lead.campaign_id],
    ["Source Lead ID", lead.source_lead_id],
    ["Meta campaign", lead.meta_campaign_name],
    ["Ad set", lead.adset_name],
    ["Ad", lead.ad_name],
    ["Form", lead.form_name],
    ["Call completed", lead.call_done_date],
    ["Response", lead.response],
    ["Reviewed at", formatDate(lead.reviewed_at)],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Lead Details
            </h2>
            <p className="text-sm text-slate-500">
              Contact and source information
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-5 p-6 sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {label}
              </p>
              <p className="mt-1 break-words text-sm text-slate-800">
                {value || "—"}
              </p>
            </div>
          ))}

          <div className="sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Comments
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {lead.comments || "—"}
            </p>
          </div>

          {lead.raw_data && (
            <details className="sm:col-span-2">
              <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                View original source data
              </summary>

              <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(lead.raw_data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminLeadManagementPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [clientId, setClientId] = useState("");
  const [page, setPage] = useState(1);

  const [data, setData] = useState<LeadListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await leadService.getLeads({
        search,
        campaign_id: campaignId,
        client_id: clientId,
        page,
        page_size: 25,
      });

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load leads."
      );
    } finally {
      setLoading(false);
    }
  }, [search, campaignId, clientId, page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadLeads();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadLeads]);

  async function openLead(leadId: string) {
    setDetailLoading(true);
    setError(null);

    try {
      const lead = await leadService.getLead(leadId);
      setSelectedLead(lead);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load lead details."
      );
    } finally {
      setDetailLoading(false);
    }
  }

  function applyFilters() {
    setPage(1);
    setSearch(searchInput);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setCampaignId("");
    setClientId("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-blue-700">
            Admin / Lead Management
          </p>

          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Lead Management
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Review and inspect leads imported from connected campaigns.
          </p>
        </div>

        <button
          onClick={() => void loadLeads()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total leads</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data?.total ?? "—"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Current page</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data
              ? `${data.page} / ${Math.max(data.total_pages, 1)}`
              : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Records shown</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {data?.items.length ?? "—"}
          </p>
        </div>
      </div>

      {/* Search and filters */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">
          Search and filters
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
            placeholder="Search name, phone or email"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <input
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            placeholder="Campaign UUID (optional)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <input
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="Client UUID (admin only)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <div className="flex gap-2">
            <button
              onClick={applyFilters}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Apply
            </button>

            <button
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          Client and campaign filters accept UUIDs in this first version.
        </p>
      </section>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* Leads table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">
            All Leads
          </h2>

          <span className="text-xs text-slate-500">
            Sorted by lead creation date
          </span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading leads…
          </div>
        ) : data?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Lead</th>
                    <th className="px-5 py-3 font-semibold">Contact</th>
                    <th className="px-5 py-3 font-semibold">Area</th>
                    <th className="px-5 py-3 font-semibold">Platform</th>
                    <th className="px-5 py-3 font-semibold">Lead date</th>
                    <th className="px-5 py-3 font-semibold">Response</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {data.items.map((lead) => (
                    <tr key={lead.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {lead.full_name || "Unnamed lead"}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {lead.source_lead_id}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="whitespace-nowrap text-slate-800">
                          {lead.phone_number || "—"}
                        </p>

                        <p className="mt-1 max-w-52 truncate text-xs text-slate-500">
                          {lead.email || "—"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {lead.area || "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {lead.platform?.toUpperCase() || "—"}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatDate(lead.created_time)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {lead.response?.replaceAll("_", " ") || "Not updated"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          onClick={() => void openLead(lead.id)}
                          className="font-semibold text-blue-700 hover:text-blue-900"
                        >
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {(page - 1) * 25 + 1}–
                {Math.min(page * 25, data.total)} of {data.total} leads
              </p>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <span className="text-sm text-slate-600">
                  Page {data.page} of {Math.max(data.total_pages, 1)}
                </span>

                <button
                  disabled={page >= data.total_pages}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-10 text-center">
            <p className="font-semibold text-slate-800">
              No leads found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try changing your search or filters.
            </p>
          </div>
        )}
      </section>

      {detailLoading && (
        <div className="fixed bottom-5 right-5 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          Loading lead details…
        </div>
      )}

      {selectedLead && (
        <LeadDetails
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  );
}