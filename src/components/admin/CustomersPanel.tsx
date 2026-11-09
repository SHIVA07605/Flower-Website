import { useQuery } from "@tanstack/react-query";
import { Download, ShieldCheck } from "lucide-react";

import { formatPrice } from "@/components/shop/products";
import { Avatar } from "@/components/shop/UserMenu";
import { useAuth } from "@/hooks/use-auth";
import { listAdminCustomers, setCustomerRole } from "@/lib/admin.functions";
import { unwrap } from "@/lib/result";
import { EmptyState, ErrorNote, LoadingRows, Panel, useAdminAction } from "./shared";

const CUSTOMERS_KEY = ["admin", "customers"];

function downloadCsv(rows: { email: string; createdAt: string }[]) {
  const csv = ["email,subscribed_at", ...rows.map((r) => `${r.email},${r.createdAt}`)].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "reelmark-subscribers.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function CustomersPanel() {
  const { viewer } = useAuth();
  const query = useQuery({
    queryKey: CUSTOMERS_KEY,
    queryFn: async () => unwrap(await listAdminCustomers()),
  });
  const setRole = useAdminAction(
    (input: { id: string; role: "admin" | "user" }) => setCustomerRole({ data: input }),
    {
      success: (r) => (r.role === "admin" ? "Admin access granted." : "Admin access removed."),
      invalidate: [CUSTOMERS_KEY],
    },
  );

  if (query.isPending) return <LoadingRows />;
  if (query.isError) return <ErrorNote message={query.error.message} />;
  const { customers, subscribers } = query.data;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold">Customers</h2>
        <p className="text-sm text-ink-soft">
          Everyone who has signed in, with their orders. Guest orders are matched by email.
        </p>
      </div>

      <Panel className="!p-0 overflow-hidden">
        {customers.length === 0 ? (
          <EmptyState>No one has signed in yet.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-[#faf8f5] text-[0.7rem] font-bold uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Sign-in</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Spent</th>
                  <th className="px-4 py-3">Last seen</th>
                  <th className="px-4 py-3 text-right">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {customers.map((c) => {
                  const viaAllowlist = c.isAdmin && c.role !== "admin";
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={c.name ?? c.email ?? "?"} src={c.avatarUrl} size={32} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{c.name ?? "—"}</p>
                            <p className="truncate text-xs text-ink-soft">
                              {c.email ?? "No email"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs capitalize text-ink-soft">
                        {c.provider === "firebase" ? "Google" : "Email"}
                      </td>
                      <td className="px-4 py-3 font-semibold">{c.orders}</td>
                      <td className="px-4 py-3">{formatPrice(c.spent)}</td>
                      <td className="px-4 py-3 text-xs text-ink-soft">
                        {new Date(c.lastSeenAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.isAdmin && (
                          <span className="mr-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Admin
                          </span>
                        )}
                        {viaAllowlist ? (
                          <span className="text-xs text-ink-soft">owner or time-limited</span>
                        ) : c.id === viewer?.id ? (
                          <span className="text-xs text-ink-soft">You</span>
                        ) : !viewer?.isOwner ? null : (
                          <button
                            type="button"
                            disabled={setRole.isPending}
                            onClick={() => {
                              const next = c.role === "admin" ? "user" : "admin";
                              const prompt =
                                next === "admin"
                                  ? `Give ${c.email ?? "this account"} full admin access?`
                                  : `Remove admin access from ${c.email ?? "this account"}?`;
                              if (window.confirm(prompt)) setRole.mutate({ id: c.id, role: next });
                            }}
                            className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                          >
                            {c.role === "admin" ? "Remove admin" : "Make admin"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={`Newsletter subscribers (${subscribers.length})`}
        description="People who signed up for the Reelmark letter."
        actions={
          subscribers.length > 0 && (
            <button
              type="button"
              onClick={() => downloadCsv(subscribers)}
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download CSV
            </button>
          )
        }
      >
        {subscribers.length === 0 ? (
          <p className="text-sm text-ink-soft">No subscribers yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {subscribers.slice(0, 200).map((s) => (
              <li
                key={s.email}
                className="flex justify-between gap-2 border-b border-border/50 py-1.5"
              >
                <span className="truncate">{s.email}</span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {new Date(s.createdAt).toLocaleDateString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
