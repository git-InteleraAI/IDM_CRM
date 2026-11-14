import { useCallback, useEffect, useMemo, useState } from "react";
import { campaignService } from "../../campaigns/services/campaign.service";
import type { Campaign } from "../../campaigns/types/campaign.types";
import {
  getNextSyncAt,
  syncService,
  type SyncLog,
} from "../services/sync.service";

interface CampaignMonitor {
  campaign: Campaign;
  logs: SyncLog[];
  error: string | null;
}

function formatDate(value: string | Date | null): string {
  if (!value) return "Not available";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusClasses(status?: string): string {
  if (status === "success") return "bg-emerald-50 text-emerald-700";
  if (status === "failed") return "bg-rose-50 text-rose-700";
  if (status === "running") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

function StatusPill({ status }: { status?: string }) {
  const label = status ? status.replaceAll("_", " ") : "No sync yet";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(status)}`}
    >
      {label}
    </span>
  );
}

export default function AdminSyncDashboard() {
  const [items, setItems] = useState<CampaignMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [syncingCampaignId, setSyncingCampaignId] = useState<string | null>(
    null
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const loadDashboard = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    setPageError(null);

    try {
      const campaigns = await campaignService.getAllCampaigns();

      const histories = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            const history = await syncService.getCampaignHistory(campaign.id);
            return {
              campaign,
              logs: history.logs ?? [],
              error: null,
            } satisfies CampaignMonitor;
          } catch (error) {
            return {
              campaign,
              logs: [],
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to load sync history.",
            } satisfies CampaignMonitor;
          }
        })
      );

      setItems(histories);
      setLastRefreshedAt(new Date());
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Unable to load campaign synchronization data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Defer the initial state update until after the effect has completed.
    const initialLoadId = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    const intervalId = window.setInterval(() => {
      void loadDashboard(true);
    }, 30_000);

    return () => {
      window.clearTimeout(initialLoadId);
      window.clearInterval(intervalId);
    };
  }, [loadDashboard]);

  const summary = useMemo(() => {
    const activeCampaigns = items.filter(
      (item) => item.campaign.status === "active"
    ).length;
    const failedRecent = items.filter(
      (item) => item.logs[0]?.status === "failed"
    ).length;
    const currentlyRunning = items.filter(
      (item) => item.logs[0]?.status === "running"
    ).length;

    return {
      total: items.length,
      activeCampaigns,
      failedRecent,
      currentlyRunning,
    };
  }, [items]);

  const handleManualSync = async (campaign: Campaign) => {
    const confirmed = window.confirm(
      `Start a manual Google Sheets sync for "${campaign.name}"?`
    );
    if (!confirmed) return;

    setSyncingCampaignId(campaign.id);
    setNotice(null);
    setPageError(null);

    try {
      await syncService.triggerManualSync(campaign.id);
      setNotice(`Manual sync completed for "${campaign.name}".`);
      await loadDashboard(true);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Manual sync failed."
      );
      await loadDashboard(true);
    } finally {
      setSyncingCampaignId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
        Loading campaign synchronization data…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Campaign Sync Monitoring
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Monitor Google Sheets synchronization, schedules, and recent activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span className="text-xs text-slate-500">
              Updated {formatDate(lastRefreshedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadDashboard(true)}
            disabled={refreshing}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {pageError}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Campaigns" value={summary.total} />
        <SummaryCard label="Active Campaigns" value={summary.activeCampaigns} />
        <SummaryCard label="Latest Failures" value={summary.failedRecent} />
        <SummaryCard label="Currently Running" value={summary.currentlyRunning} />
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-800">No campaigns found</h2>
          <p className="mt-2 text-sm text-slate-500">
            Create a campaign to start monitoring its synchronization.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {items.map(({ campaign, logs, error }) => {
            const latest = logs[0];
            const latestSuccess = logs.find((log) => log.status === "success");
            const nextSyncAt = getNextSyncAt(campaign);

            return (
              <section
                key={campaign.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">
                        {campaign.name}
                      </h2>
                      <StatusPill status={campaign.status} />
                      {latest && <StatusPill status={latest.status} />}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Campaign ID: {campaign.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleManualSync(campaign)}
                    disabled={
                      campaign.status !== "active" ||
                      syncingCampaignId === campaign.id ||
                      latest?.status === "running"
                    }
                    className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {syncingCampaignId === campaign.id
                      ? "Syncing…"
                      : "Sync Now"}
                  </button>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoBlock
                    label="Last Successful Sync"
                    value={
                      latestSuccess
                        ? formatDate(latestSuccess.completed_at)
                        : "No successful sync"
                    }
                  />
                  <InfoBlock
                    label="Next Scheduled Sync"
                    value={
                      campaign.status === "active"
                        ? formatDate(nextSyncAt)
                        : "Campaign is not active"
                    }
                  />
                  <InfoBlock
                    label="Sync Frequency"
                    value={`Every ${campaign.sync_interval_minutes} minutes`}
                  />
                  <InfoBlock
                    label="Latest Trigger"
                    value={latest?.trigger_type ?? "No sync history"}
                    capitalize
                  />
                </div>

                {error && (
                  <div className="mx-5 mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                    Sync history could not be loaded: {error}
                  </div>
                )}

                <div className="border-t border-slate-100">
                  <div className="flex items-center justify-between px-5 py-4">
                    <h3 className="text-sm font-semibold text-slate-800">
                      Recent Sync History
                    </h3>
                    <span className="text-xs text-slate-500">
                      Showing latest {logs.length} records
                    </span>
                  </div>

                  {logs.length === 0 ? (
                    <p className="px-5 pb-5 text-sm text-slate-500">
                      No synchronization records are available.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Started</th>
                            <th className="px-5 py-3 font-semibold">Trigger</th>
                            <th className="px-5 py-3 font-semibold">Status</th>
                            <th className="px-5 py-3 font-semibold">Created</th>
                            <th className="px-5 py-3 font-semibold">Updated</th>
                            <th className="px-5 py-3 font-semibold">Completed</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {logs.map((log) => (
                            <tr key={log.id} className="text-slate-700">
                              <td className="whitespace-nowrap px-5 py-3">
                                {formatDate(log.started_at)}
                              </td>
                              <td className="px-5 py-3 capitalize">
                                {log.trigger_type}
                              </td>
                              <td className="px-5 py-3">
                                <StatusPill status={log.status} />
                              </td>
                              <td className="px-5 py-3 tabular-nums">
                                {log.created_count}
                              </td>
                              <td className="px-5 py-3 tabular-nums">
                                {log.updated_count}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3">
                                {formatDate(log.completed_at)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {logs.some((log) => log.error_message) && (
                    <div className="space-y-2 px-5 pb-5">
                      {logs
                        .filter((log) => log.error_message)
                        .map((log) => (
                          <div
                            key={`${log.id}-error`}
                            className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700"
                          >
                            <strong>{formatDate(log.started_at)}:</strong>{" "}
                            {log.error_message}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Dashboard refreshes automatically every 30 seconds. Scheduled sync times
        are estimates based on the campaign's last successful sync and configured
        interval.
      </p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-semibold text-slate-800 ${
          capitalize ? "capitalize" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}