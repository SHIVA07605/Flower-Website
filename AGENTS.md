<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- The storefront is one page (`src/routes/index.tsx`) composed of section components in `src/components/shop/`; keep each section in its own file so sections can be reordered.
- `src/components/shop/products.ts` is the single base bouquet catalog — never duplicate product data elsewhere. Admin edits (prices, photos, hidden or added bouquets) are stored only as overrides in the Supabase `products` table and merged by `mergeCatalog` (`src/lib/catalog.ts`). Sections, the bag and the AI finder read that merged catalog (`useStorefront()` on the client, `loadCatalog()` on the server) instead of importing `bouquets` directly.
- Storefront copy, pictures and billing rules live in `DEFAULT_SITE_CONTENT` (`src/lib/site-content.ts`); the `site_content` table stores only edits. Add new editable text there and expose it in `src/components/admin/ContentPanels.tsx`.
- The browser never writes to Supabase tables. Writes go through server functions (`src/lib/*.functions.ts` → `src/lib/server/*.server.ts`) that use `viewerMiddleware` to verify the caller's Firebase or Supabase token; admin access is decided on the server (`requireAdmin`): owners are the verified emails in `ADMIN_EMAILS` (`requireOwner`), and they grant other emails admin access, optionally until an end time, through the `admin_grants` table (Admin access tab). Only owners may add or remove admins; `profiles.role = 'admin'` is still honoured. Order totals are always recomputed on the server with `computeTotals`.
- Server functions wrap their work in `run()` (`src/lib/server/db.server.ts`). Shopper-facing ones use the default, which turns setup problems (`SetupError`: missing service key or tables) into a friendly message; admin ones pass `{ audience: "admin" }` so only admins see the setup instructions.
- Schema changes go in a new file under `supabase/migrations/`, keep every table's RLS enabled, and must be safe to re-run.
- Sections that the scroll trail should connect are direct children of `<PetalTrail>` and carry `data-trail-section`; the trail measures them to draw its path.
- The AI bouquet finder runs server-side only (`bouquet-finder.functions.ts` → `bouquet-finder.server.ts`) through Lovable AI Gateway Responses with streamed structured output; budget filtering happens in code (`pickCandidates`) before the model sees the catalog, so the model can never recommend an over-budget bouquet. Without `LOVABLE_API_KEY`, or when the gateway fails, the rule-based `matchBouquet` (`bouquet-finder.match.ts`) answers from the same budget-filtered candidates so shoppers always get a recommendation.
- Animations use GSAP (+ ScrollTrigger) inside `useEffect` with `gsap.context` cleanup, and respect `prefers-reduced-motion`.
