import { supabase } from "../../../lib/supabase";
import type {
  Campaign,
  CampaignInput,
  CampaignStatus,
} from "../types/campaign.types";

export const campaignService = {
  extractSpreadsheetDetails(sheetUrl: string): {
    spreadsheetId: string;
    worksheetGid: string | null;
  } {
    let url: URL;

    try {
      url = new URL(sheetUrl.trim());
    } catch {
      throw new Error("Please enter a valid Google Sheets URL.");
    }

    if (
      url.protocol !== "https:" ||
      !["docs.google.com", "www.docs.google.com"].includes(url.hostname)
    ) {
      throw new Error("Please enter a valid Google Sheets URL.");
    }

    const match = url.pathname.match(
      /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
    );

    if (!match) {
      throw new Error("Unable to extract the Google Spreadsheet ID.");
    }

    return {
      spreadsheetId: match[1],
      worksheetGid: url.searchParams.get("gid"),
    };
  },

  async getAllCampaigns(): Promise<Campaign[]> {
    const { data, error } = await supabase
      .from("campaigns")
      .select(
        "id, client_id, name, status, sheet_url, spreadsheet_id, worksheet_gid, sync_interval_minutes, last_synced_at, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []) as Campaign[];
  },

  async createCampaign(input: CampaignInput): Promise<Campaign> {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Campaign name is required.");
    }

    if (
      !Number.isInteger(input.sync_interval_minutes) ||
      input.sync_interval_minutes < 5 ||
      input.sync_interval_minutes > 1440
    ) {
      throw new Error("Sync interval must be between 5 and 1440 minutes.");
    }

    const details = this.extractSpreadsheetDetails(input.sheet_url);

    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        client_id: input.client_id,
        name,
        status: input.status,
        sheet_url: input.sheet_url.trim(),
        spreadsheet_id: details.spreadsheetId,
        worksheet_gid: input.worksheet_gid?.trim() || details.worksheetGid,
        sync_interval_minutes: input.sync_interval_minutes,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "This Google Spreadsheet is already assigned to another campaign."
        );
      }

      throw error;
    }

    return data as Campaign;
  },

  async updateCampaign(
    campaignId: string,
    input: CampaignInput
  ): Promise<Campaign> {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Campaign name is required.");
    }

    if (
      !Number.isInteger(input.sync_interval_minutes) ||
      input.sync_interval_minutes < 5 ||
      input.sync_interval_minutes > 1440
    ) {
      throw new Error("Sync interval must be between 5 and 1440 minutes.");
    }

    const details = this.extractSpreadsheetDetails(input.sheet_url);

    const { data, error } = await supabase
      .from("campaigns")
      .update({
        client_id: input.client_id,
        name,
        status: input.status,
        sheet_url: input.sheet_url.trim(),
        spreadsheet_id: details.spreadsheetId,
        worksheet_gid: input.worksheet_gid?.trim() || details.worksheetGid,
        sync_interval_minutes: input.sync_interval_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "This Google Spreadsheet is already assigned to another campaign."
        );
      }

      throw error;
    }

    return data as Campaign;
  },

  async updateCampaignStatus(
    campaignId: string,
    status: CampaignStatus
  ): Promise<Campaign> {
    const { data, error } = await supabase
      .from("campaigns")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .select()
      .single();

    if (error) throw error;

    return data as Campaign;
  },
};