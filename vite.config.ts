// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Server-only secrets (no VITE_ prefix, never sent to the browser) are read from process.env
// at runtime. Hosting platforms inject them; for local `vite dev`, copy them from .env files.
const SERVER_ENV_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ADMIN_EMAILS",
  "LOVABLE_API_KEY",
  "SUPABASE_URL",
  "FIREBASE_PROJECT_ID",
];
if (!process.argv.includes("build")) {
  const fileEnv = loadEnv("development", process.cwd(), "");
  for (const key of SERVER_ENV_KEYS) {
    if (!process.env[key] && fileEnv[key]) process.env[key] = fileEnv[key];
  }
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // When building in Vercel environment, produce native Vercel output
  nitro: process.env["VERCEL"] ? { preset: "vercel" } : {},
  vite: {
    server: {
      port: 5173,
      strictPort: false,
      host: true,
    },
  },
});
