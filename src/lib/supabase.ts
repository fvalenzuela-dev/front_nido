import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

// Server-side client (SSR, API routes, middleware)
// Uses SERVICE KEY — bypasses RLS when needed for admin operations
// Lazily initialized to avoid build-time errors when env vars are not set.
let _supabaseAdmin: SupabaseClient<Database> | undefined

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient<Database>(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.SUPABASE_SERVICE_KEY  // no PUBLIC_ prefix — server-only
    )
  }
  return _supabaseAdmin
}

// Browser-side client (React islands, client components)
// Uses ANON KEY — protected by RLS
// Lazily initialized to avoid build-time errors when env vars are not set.
let _supabaseClient: SupabaseClient<Database> | undefined

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_supabaseClient) {
    _supabaseClient = createClient<Database>(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return _supabaseClient
}

// Request-scoped client (SSR only) — ANON KEY + the user's access token.
// RLS is enforced and policies evaluate with the user's JWT (app_metadata.role),
// so admin data access is authorized by ROLE, not by bypassing RLS with the
// service key. NOT cached: the token differs per request, so build a fresh
// client each call. Pass the `sb-access-token` cookie value.
export function getSupabaseForRequest(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    }
  )
}

// Convenience re-exports matching the CLAUDE.md reference API
// NOTE: these are getter functions, not direct instances, to allow build without real env vars.
// Usage: supabaseAdmin.auth.getUser(token) → call the getter first: getSupabaseAdmin().auth.getUser(token)
//
// For backward compatibility with direct usage pattern from CLAUDE.md §5, the exported
// objects delegate to the lazy getters on first property access.
export const supabaseAdmin: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

export const supabaseClient: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    return (getSupabaseClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
