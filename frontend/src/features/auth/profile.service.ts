import { supabase } from "../../lib/supabase";

export type UserRole = "admin" | "client";

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  client_id: string | null;
}

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, client_id")
      .eq("id", userId)
      .single();

    if (error) {
      throw error;
    }

    if (data.role !== "admin" && data.role !== "client") {
      throw new Error("Invalid user role configured in the database.");
    }

    return data as UserProfile;
  },
};