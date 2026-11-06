import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLogin, AdminNoAccess } from "@/components/admin/AdminLogin";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Reelmark" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

function Waiting({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf8f5]">
      <p className="flex items-center gap-3 text-sm font-medium text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
        {label}
      </p>
    </div>
  );
}

/**
 * The dashboard only renders for accounts the server confirms as admins; every action it
 * takes is checked again on the server, so hiding UI here is a convenience, not the guard.
 */
function AdminPage() {
  const { user, loading, viewerLoading, viewerError, isAdmin } = useAuth();

  if (loading) return <Waiting label="Loading…" />;
  if (!user) return <AdminLogin />;
  if (viewerLoading) return <Waiting label="Checking admin access…" />;
  if (!isAdmin) return <AdminNoAccess reason={viewerError} />;
  return <AdminDashboard />;
}
