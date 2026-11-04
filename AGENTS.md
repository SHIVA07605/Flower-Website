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
- `src/components/shop/products.ts` is the single bouquet catalog for every section and for the AI finder — never duplicate product data elsewhere.
- Sections that the scroll trail should connect are direct children of `<PetalTrail>` and carry `data-trail-section`; the trail measures them to draw its path.
- The AI bouquet finder runs server-side only (`bouquet-finder.functions.ts` → `bouquet-finder.server.ts`) through Lovable AI Gateway Responses with streamed structured output; budget filtering happens in code (`pickCandidates`) before the model sees the catalog, so the model can never recommend an over-budget bouquet.
- Animations use GSAP (+ ScrollTrigger) inside `useEffect` with `gsap.context` cleanup, and respect `prefers-reduced-motion`.
