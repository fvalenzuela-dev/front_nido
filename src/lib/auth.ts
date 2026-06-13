import type { Database } from '@/types/supabase'
import type { SupabaseClient, Session } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabase'

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
// resolveAuthGate
//
// Pure, injectable middleware decision helper. Encapsulates all auth-gate
// branching so the real middleware.ts only handles I/O (cookie reads/writes,
// redirects) and delegates all decisions here.
//
// Decision flow (WARNING-3 fix):
//   1. skipAuth=true                       → allow (no Supabase call)
//   2. no refreshToken                     → redirect (nothing to recover with)
//   3. accessToken present → getUser()     → allow if valid user
//   4. getUser fails OR accessToken absent → refreshSession() (one attempt)
//        refresh ok  → set-cookies-and-allow (new tokens)
//        refresh fails/throws → redirect
//
// Rationale for step 4: per spec "Expired access token triggers single refresh"
// the gate MUST attempt a refresh whenever the access token is absent or
// invalid AND a refresh token is present. The previous implementation
// short-circuited to redirect when accessToken was absent (WARNING-3).
// ---------------------------------------------------------------------------

export interface AuthGateState {
  accessToken: string | undefined
  refreshToken: string | undefined
  skipAuth: boolean
}

export interface AuthGateDeps {
  /** Call Supabase getUser with the given access token. */
  getUser: (token: string) => Promise<{ user: object | null; error: { message: string } | null }>
  /** Call Supabase refreshSession with the given refresh token (one attempt). */
  refreshSession: (token: string) => Promise<
    | { session: { access_token: string; refresh_token: string }; error: null }
    | { session: null; error: { message: string } }
  >
}

export type AuthGateDecision =
  | { action: 'allow' }
  | { action: 'redirect-to-login' }
  | { action: 'set-cookies-and-allow'; accessToken: string; refreshToken: string }

export async function resolveAuthGate(
  state: AuthGateState,
  deps: AuthGateDeps
): Promise<AuthGateDecision> {
  // Step 1: explicit dev bypass — no Supabase call
  if (state.skipAuth) {
    return { action: 'allow' }
  }

  // Step 2: no refresh token → cannot recover, redirect immediately
  if (!state.refreshToken) {
    return { action: 'redirect-to-login' }
  }

  // Step 3: if we have an access token, try to validate it first
  if (state.accessToken) {
    try {
      const { user, error } = await deps.getUser(state.accessToken)
      if (!error && user) {
        return { action: 'allow' }
      }
      // getUser failed — fall through to refresh attempt (step 4)
    } catch {
      // getUser threw — fall through to refresh attempt
    }
  }

  // Step 4: access token absent, expired, or invalid — attempt exactly ONE refresh
  // (covers WARNING-3: previously we redirected when accessToken was absent even
  //  if refreshToken was present; now we always attempt the refresh)
  try {
    const refreshResult = await deps.refreshSession(state.refreshToken)
    if (!refreshResult.error && refreshResult.session) {
      return {
        action: 'set-cookies-and-allow',
        accessToken: refreshResult.session.access_token,
        refreshToken: refreshResult.session.refresh_token,
      }
    }
    return { action: 'redirect-to-login' }
  } catch {
    return { action: 'redirect-to-login' }
  }
}

// ---------------------------------------------------------------------------
// Legacy exports (kept for backward compatibility — do NOT remove)
// These use the admin client directly; not tested via unit tests.
// ---------------------------------------------------------------------------

export async function getSession(accessToken: string) {
  const { data, error } = await getSupabaseAdmin().auth.getUser(accessToken)
  return { user: data.user, error }
}

export async function signOut(accessToken: string) {
  return getSupabaseAdmin().auth.admin.signOut(accessToken)
}
