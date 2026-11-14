import { supabase } from "../../../lib/supabase";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"
).replace(/\/+$/, "");

const CLIENT_LOGO_BUCKET = "client-logos";

export interface Client {
  id: string;
  name: string;
  business_name: string;
  joining_date: string;
  location: string;
  monthly_reels_commitment: number;
  monthly_posts_commitment: number;
  contact_number: string;
  logo_url: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
}

export interface CreateClientAccountInput {
  name: string;
  business_name: string;
  joining_date: string;
  location: string;
  monthly_reels_commitment: number;
  monthly_posts_commitment: number;
  email: string;
  password: string;
  contact_number: string;
  logo_file: File;
}

export interface CreateClientAccountResult {
  client: Client;
  login: {
    user_id: string;
    email: string;
    role: string;
  };
}

export interface UpdateClientInput {
  name?: string;
  logo_url?: string | null;
  status?: "active" | "inactive";
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "Your login session has expired. Please log in again."
    );
  }

  return accessToken;
}

export const clientService = {
  async getAllClients(): Promise<Client[]> {
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, name, business_name, joining_date, location, monthly_reels_commitment, monthly_posts_commitment, contact_number, logo_url, status, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []) as Client[];
  },

  async createClientAccount(
    input: CreateClientAccountInput
  ): Promise<CreateClientAccountResult> {
    const name = input.name.trim();
    const businessName = input.business_name.trim();
    const location = input.location.trim();
    const email = input.email.trim().toLowerCase();
    const contactNumber = input.contact_number.trim();

    if (!name || !businessName || !location || !contactNumber) {
      throw new Error("Please complete all required client details.");
    }

    if (!input.logo_file) {
      throw new Error("Please select a client logo.");
    }

    // 1. Upload the client logo.
    const logoUrl = await this.uploadClientLogo(input.logo_file);

    // 2. Get the authenticated admin's access token.
    const accessToken = await getAccessToken();

    // 3. Create the client and linked login account through FastAPI.
    const response = await fetch(
      `${API_BASE_URL}/api/admin/clients`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          name,
          business_name: businessName,
          joining_date: input.joining_date,
          location,
          monthly_reels_commitment:
            input.monthly_reels_commitment,
          monthly_posts_commitment:
            input.monthly_posts_commitment,
          email,
          password: input.password,
          contact_number: contactNumber,
          logo_url: logoUrl,
        }),
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload?.detail ||
          "Unable to create the client account. Please try again."
      );
    }

    if (!payload?.client || !payload?.login) {
      throw new Error(
        "The server returned an unexpected client creation response."
      );
    }

    return {
      client: payload.client as Client,
      login: payload.login,
    };
  },

  async updateClient(
    clientId: string,
    input: UpdateClientInput
  ): Promise<Client> {
    const updates: UpdateClientInput & { updated_at: string } = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      const name = input.name.trim();

      if (!name) {
        throw new Error("Client name is required.");
      }

      updates.name = name;
    }

    if (input.logo_url !== undefined) {
      updates.logo_url = input.logo_url;
    }

    if (input.status !== undefined) {
      updates.status = input.status;
    }

    const { data, error } = await supabase
      .from("clients")
      .update(updates)
      .eq("id", clientId)
      .select(
        "id, name, business_name, joining_date, location, monthly_reels_commitment, monthly_posts_commitment, contact_number, logo_url, status, created_at, updated_at"
      )
      .single();

    if (error) throw error;

    return data as Client;
  },

  async uploadClientLogo(file: File): Promise<string> {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error(
        "Only PNG, JPG, JPEG and WebP images are allowed."
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Logo file size must not exceed 2 MB.");
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (
      !extension ||
      !["png", "jpg", "jpeg", "webp"].includes(extension)
    ) {
      throw new Error("Invalid logo file extension.");
    }

    const filePath = `${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from(CLIENT_LOGO_BUCKET)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(CLIENT_LOGO_BUCKET)
      .getPublicUrl(filePath);

    return data.publicUrl;
  },

  async setClientStatus(
    clientId: string,
    status: "active" | "inactive"
  ): Promise<Client> {
    return this.updateClient(clientId, { status });
  },
};