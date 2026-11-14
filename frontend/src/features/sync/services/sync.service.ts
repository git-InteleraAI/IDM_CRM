import { supabase } from "../../../lib/supabase";
import type { Campaign } from "../../campaigns/types/campaign.types";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export type SyncTriggerType = "manual" | "scheduled" | "legacy";
export type SyncStatus = "running" | "success" | "failed";

export interface SyncLog {
  id: string;
  campaign_id: string;
  status: SyncStatus;
  trigger_type: SyncTriggerType;
  created_count: number;
  updated_count: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface CampaignSyncHistory {
  campaign_id: string;
  campaign_name: string;
  logs: SyncLog[];
}

async function authorizedFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error("Your login session has expired. Please log in again.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      payload && typeof payload.detail === "string"
        ? payload.detail
        : `Request failed with status ${response.status}.`;
    throw new Error(detail);
  }

  return payload as T;
}

export const syncService = {
  async getCampaignHistory(campaignId: string): Promise<CampaignSyncHistory> {
    return authorizedFetch<CampaignSyncHistory>(
      `/api/admin/campaigns/${encodeURIComponent(campaignId)}/sync-logs`
    );
  },

  async triggerManualSync(campaignId: string): Promise<Record<string, unknown>> {
    return authorizedFetch<Record<string, unknown>>(
      `/api/admin/campaigns/${encodeURIComponent(campaignId)}/sync`,
      { method: "POST" }
    );
  },
};

export function getNextSyncAt(campaign: Campaign): Date | null {
  if (campaign.status !== "active") return null;

  const reference = campaign.last_synced_at
    ? new Date(campaign.last_synced_at)
    : new Date(campaign.created_at);

  if (Number.isNaN(reference.getTime())) return null;

  return new Date(
    reference.getTime() + campaign.sync_interval_minutes * 60_000
  );
}