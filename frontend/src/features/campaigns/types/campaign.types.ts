export type CampaignStatus = "draft" | "active" | "completed";

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  status: CampaignStatus;
  sheet_url: string;
  spreadsheet_id: string;
  worksheet_gid: string | null;
  sync_interval_minutes: number;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignInput {
  client_id: string;
  name: string;
  status: CampaignStatus;
  sheet_url: string;
  spreadsheet_id: string;
  worksheet_gid: string | null;
  sync_interval_minutes: number;
}