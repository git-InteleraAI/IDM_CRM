import { supabase } from "../../../lib/supabase";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

export interface Lead {
  id: string;
  campaign_id: string;
  source_lead_id: string;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  area: string | null;
  created_time: string | null;
  platform: string | null;
  meta_campaign_id: string | null;
  meta_campaign_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  form_id: string | null;
  form_name: string | null;
  source_status: string | null;
  priority: string | null;
  call_done_date: string | null;
  response: string | null;
  comments: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  raw_data?: Record<string, unknown>;
}

export interface LeadListResponse {
  items: Lead[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface LeadFilters {
  search?: string;
  campaign_id?: string;
  client_id?: string;
  page?: number;
  page_size?: number;
}

async function authorizedFetch<T>(path: string): Promise<T> {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "Your login session has expired. Please log in again."
    );
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
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

export const leadService = {
  async getLeads(
    filters: LeadFilters = {}
  ): Promise<LeadListResponse> {
    const params = new URLSearchParams();

    if (filters.search?.trim()) {
      params.set("search", filters.search.trim());
    }

    if (filters.campaign_id?.trim()) {
      params.set("campaign_id", filters.campaign_id.trim());
    }

    if (filters.client_id?.trim()) {
      params.set("client_id", filters.client_id.trim());
    }

    params.set("page", String(filters.page ?? 1));
    params.set("page_size", String(filters.page_size ?? 25));

    return authorizedFetch<LeadListResponse>(
      `/api/leads?${params.toString()}`
    );
  },

  async getLead(leadId: string): Promise<Lead> {
    return authorizedFetch<Lead>(
      `/api/leads/${encodeURIComponent(leadId)}`
    );
  },
};