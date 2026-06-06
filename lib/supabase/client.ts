import { createBrowserClient } from '@supabase/ssr'

// Fallback placeholders let the app build without env vars set.
// At runtime on Netlify/locally the real values are always present.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'placeholder-anon-key'
  )
}
