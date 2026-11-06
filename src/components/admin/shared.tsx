import { useRef, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadMedia } from "@/lib/admin.functions";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/lib/admin-types";
import { unwrap, type Result } from "@/lib/result";
import { announceStoreUpdate } from "@/lib/store-sync";

export const adminInput =
  "w-full rounded-xl border border-border bg-[#faf8f5] px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/15";

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-border bg-white p-5 shadow-sm sm:p-7 ${className}`}
    >
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>}
            {description && <p className="mt-0.5 text-xs text-ink-soft">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  // The hint (which may hold a button) stays outside the <label>.
  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-foreground/80">{label}</span>
        {children}
      </label>
      {hint && <div className="mt-1 text-[0.7rem] text-ink-soft">{hint}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="p-12 text-center text-sm text-ink-soft">{children}</div>;
}

export function LoadingRows() {
  return (
    <div className="space-y-2 p-4" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
    >
      {message}
    </p>
  );
}

/**
 * A mutation that shows the server's error message, refreshes the given admin queries and
 * tells open storefront tabs to reload.
 */
export function useAdminAction<TInput, TOutput>(
  action: (input: TInput) => Promise<Result<TOutput>>,
  opts: { success?: string | ((out: TOutput) => string); invalidate?: string[][] } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TInput) => unwrap(await action(input)),
    onSuccess: (out) => {
      for (const key of opts.invalidate ?? [])
        void queryClient.invalidateQueries({ queryKey: key });
      announceStoreUpdate();
      const message = typeof opts.success === "function" ? opts.success(out) : opts.success;
      if (message) toast.success(message);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/** Uploads a picture to Supabase Storage and hands back its public URL. */
export function ImageUploadButton({
  onUploaded,
  label = "Upload",
}: {
  onUploaded: (url: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!UPLOAD_TYPES.includes(file.type)) {
      toast.error("Choose a JPG, PNG, WebP, AVIF or GIF picture.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Pictures must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const result = await uploadMedia({ data: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onUploaded(result.data.url);
      toast.success("Picture uploaded — remember to save.");
    } catch {
      toast.error("The upload didn't go through. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_TYPES.join(",")}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {label}
      </button>
    </>
  );
}
