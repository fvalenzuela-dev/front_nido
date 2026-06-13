import type { Database } from '@/types/supabase'
import type { SupabaseClient, Session } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Auth error codes (whitelisted — only these may appear in ?error= params)
// ---------------------------------------------------------------------------

const AUTH_ERROR_CODES = ['invalid_credentials', 'missing_fields', 'server_error'] as const
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number]

// ---------------------------------------------------------------------------
// Cookie types
// ---------------------------------------------------------------------------

export interface CookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge?: number
}

export interface SignOutCookieEntry {
  name: string
  options: { path: '/'; maxAge: 0 }
}

// ---------------------------------------------------------------------------
// Session token maxAge constants
// ---------------------------------------------------------------------------

export const ACCESS_MAX_AGE = 3600          // 1 hour
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7  // 7 days

// ---------------------------------------------------------------------------
// validateCredentials
// Pre-validates email/password before calling Supabase. No side effects.
// ---------------------------------------------------------------------------

export function validateCredentials(
  email: unknown,
  password: unknown
): { valid: boolean; code: AuthErrorCode | null } {
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    email.trim() === '' ||
    password.trim() === ''
  ) {
    return { valid: false, code: 'missing_fields' }
  }
  return { valid: true, code: null }
}

// ---------------------------------------------------------------------------
// buildCookieOptions
// Returns base HttpOnly cookie options. Caller adds maxAge per cookie.
// ---------------------------------------------------------------------------

export function buildCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  }
}

// ---------------------------------------------------------------------------
// buildSignOutCookies
// Returns both session cookie entries with maxAge=0 for deletion.
// ---------------------------------------------------------------------------

export function buildSignOutCookies(): SignOutCookieEntry[] {
  return [
    { name: 'sb-access-token', options: { path: '/', maxAge: 0 } },
    { name: 'sb-refresh-token', options: { path: '/', maxAge: 0 } },
  ]
}

// ---------------------------------------------------------------------------
// sanitizeAuthError
// Maps whitelisted error codes to Spanish user-facing strings.
// Returns empty string for unknown/absent codes — never exposes raw Supabase text.
// ---------------------------------------------------------------------------

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  missing_fields: 'Completa correo y contraseña.',
  server_error: 'Ocurrió un error. Intenta nuevamente.',
}

export function sanitizeAuthError(code: string | null): string {
  if (!code) return ''
  const isWhitelisted = (AUTH_ERROR_CODES as readonly string[]).includes(code)
  if (!isWhitelisted) return ''
  return AUTH_ERROR_MESSAGES[code as AuthErrorCode]
}

// ---------------------------------------------------------------------------
// signIn
// Calls signInWithPassword with an injectable client (no module-level Supabase).
// Never throws — maps all errors to 'invalid_credentials'.
// ---------------------------------------------------------------------------

export async function signIn(
  email: string,
  password: string,
  client: SupabaseClient<Database>
): Promise<{ session: Session | null; error: AuthErrorCode | null }> {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error || !data.session) {
      return { session: null, error: 'invalid_credentials' }
    }
    return { session: data.session, error: null }
  } catch {
    return { session: null, error: 'invalid_credentials' }
  }
}

// ---------------------------------------------------------------------------
// Legacy exports (kept for backward compatibility — do NOT remove)
// These use the admin client directly; not tested via unit tests.
// ---------------------------------------------------------------------------

export async function getSession(accessToken: string) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken)
  return { user: data.user, error }
}

export async function signOut(accessToken: string) {
  const { getSupabaseAdmin } = await import('@/lib/supabase')
  return getSupabaseAdmin().auth.admin.signOut(accessToken)
}
