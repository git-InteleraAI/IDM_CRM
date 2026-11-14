import { useEffect, useState, type FormEvent } from "react";
import {
  clientService,
  type Client,
} from "../services/client.service";

interface EditClientModalProps {
  client: Client;
  onClose: () => void;
  onClientUpdated: (client: Client) => void;
}

export default function EditClientModal({
  client,
  onClose,
  onClientUpdated,
}: EditClientModalProps) {
  const [name, setName] = useState(client.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleLogoChange = (file: File | null) => {
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPG, JPEG and WebP images are allowed.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Logo file size must not exceed 2 MB.");
      return;
    }

    setError(null);
    setLogoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      setError("Please enter a client name.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let logoUrl = client.logo_url;

      if (logoFile) {
        logoUrl = await clientService.uploadClientLogo(logoFile);
      }

      const updatedClient = await clientService.updateClient(
        client.id,
        {
          name: name.trim(),
          logo_url: logoUrl,
        }
      );

      onClientUpdated(updatedClient);
    } catch (err) {
      console.error("Failed to update client:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update client. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-client-title"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2
          id="edit-client-title"
          className="text-xl font-bold text-slate-900"
        >
          Edit Client
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Update client information and branding.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="edit-client-name"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Client Name
            </label>

            <input
              id="edit-client-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="edit-client-logo"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Client Logo
            </label>

            <div className="flex items-center gap-4">
              {previewUrl || client.logo_url ? (
                <img
                  src={previewUrl || client.logo_url || ""}
                  alt="Client logo preview"
                  className="h-16 w-16 rounded-lg border border-slate-200 object-contain"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-50 text-xl font-bold text-blue-600">
                  {client.name.charAt(0).toUpperCase()}
                </div>
              )}

              <input
                id="edit-client-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={submitting}
                onChange={(event) =>
                  handleLogoChange(event.target.files?.[0] ?? null)
                }
                className="min-w-0 flex-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-medium file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            <p className="mt-2 text-xs text-slate-500">
              PNG, JPG or WebP. Maximum file size: 2 MB.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}