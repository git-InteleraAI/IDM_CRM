import { createPortal } from "react-dom";
import { useEffect, useState, type FormEvent } from "react";
import {
  clientService,
  type Client,
} from "../services/client.service";

interface AddClientModalProps {
  onClose: () => void;
  onClientCreated: (client: Client) => void;
}

interface CreatedCredentials {
  email: string;
  password: string;
}

export default function AddClientModal({
  onClose,
  onClientCreated,
}: AddClientModalProps) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [location, setLocation] = useState("");
  const [reelsCommitment, setReelsCommitment] = useState("0");
  const [postsCommitment, setPostsCommitment] = useState("0");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] =
    useState<CreatedCredentials | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleLogoChange = (file: File | null) => {
    setError(null);

    if (!file) {
      setLogoFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Only PNG, JPG, JPEG and WebP images are allowed.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Logo file size must not exceed 2 MB.");
      return;
    }

    setLogoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!logoFile) {
      setError("Please select a client logo.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    const reels = Number(reelsCommitment);
    const posts = Number(postsCommitment);

    if (
      !Number.isInteger(reels) ||
      !Number.isInteger(posts) ||
      reels < 0 ||
      posts < 0
    ) {
      setError("Monthly commitments must be valid non-negative numbers.");
      return;
    }

    try {
      setSubmitting(true);

      const result = await clientService.createClientAccount({
        name: name.trim(),
        business_name: businessName.trim(),
        joining_date: joiningDate,
        location: location.trim(),
        monthly_reels_commitment: reels,
        monthly_posts_commitment: posts,
        email: email.trim().toLowerCase(),
        password,
        contact_number: contactNumber.trim(),
        logo_file: logoFile,
      });

      onClientCreated(result.client);

      // Keep the password only in this temporary success-screen state.
      setCredentials({
        email: result.login.email,
        password,
      });

      setPassword("");
    } catch (err) {
      console.error("Failed to create client account:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create client. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!credentials) return;

    const textToCopy =
      `Client Login Credentials\n` +
      `Email: ${credentials.email}\n` +
      `Temporary Password: ${credentials.password}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
    } catch {
      setError(
        "Unable to copy automatically. Please select and copy the credentials manually."
      );
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-client-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        {credentials ? (
          <>
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-700">
                  ✓
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Client Created Successfully!
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    The client account and login credentials are ready.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto p-6">
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-800">
                  Account created successfully
                </p>
                <p className="mt-1 text-sm text-green-700">
                  Copy these credentials and share them privately with the
                  client.
                </p>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Login Email
                </label>
                <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                  {credentials.email}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Temporary Password
                </label>
                <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800">
                  {credentials.password}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopyCredentials}
                className="w-full rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                {copied ? "✓ Credentials Copied" : "Copy Credentials"}
              </button>

              <p className="text-xs text-slate-500">
                Important: This password is shown only on this screen. Store
                or share it securely before closing this window. The client
                should change it after their first login.
              </p>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2
                  id="add-client-title"
                  className="text-xl font-bold text-slate-900"
                >
                  Add New Client
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Enter company details and create its client portal login.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close dialog"
                className="text-2xl text-slate-400 hover:text-slate-700 disabled:opacity-50"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-6 overflow-y-auto p-6">
                <div>
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
                    Company Information
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Client Name *
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter client name"
                        maxLength={150}
                        required
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Enter business name"
                        maxLength={200}
                        required
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Joining Date *
                      </label>
                      <input
                        type="date"
                        value={joiningDate}
                        onChange={(e) => setJoiningDate(e.target.value)}
                        required
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Location *
                      </label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City / Area"
                        maxLength={500}
                        required
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Contact Number *
                      </label>
                      <input
                        type="tel"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="Enter contact number"
                        maxLength={30}
                        required
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
                    Monthly Commitment
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Reels per Month *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={reelsCommitment}
                        onChange={(e) => setReelsCommitment(e.target.value)}
                        required
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Posts per Month *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={postsCommitment}
                        onChange={(e) => setPostsCommitment(e.target.value)}
                        required
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
                    Client Portal Login
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Login Email *
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="client@example.com"
                        maxLength={254}
                        required
                        autoComplete="off"
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Temporary Password *
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        minLength={8}
                        maxLength={128}
                        required
                        autoComplete="new-password"
                        disabled={submitting}
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        This password will be shown once after account creation.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
                    Client Branding
                  </h3>

                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Client Logo * (PNG, JPG or WebP; max 2 MB)
                  </label>

                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) =>
                      handleLogoChange(e.currentTarget.files?.[0] ?? null)
                    }
                    required={!logoFile}
                    disabled={submitting}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-medium file:text-blue-700 hover:file:bg-blue-100 disabled:bg-slate-100"
                  />

                  {previewUrl && (
                    <div className="mt-4 flex items-center gap-4 rounded-lg border border-slate-200 p-3">
                      <img
                        src={previewUrl}
                        alt="Client logo preview"
                        className="h-16 w-16 rounded-lg border border-slate-200 object-contain"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800">
                          Logo preview
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {logoFile?.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  New clients will be created with Active status. Login
                  credentials must be shared privately with the client.
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Creating Client..." : "Create Client"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}