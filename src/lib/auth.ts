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
// Role-based authorization
//
// Authorization (who) is layered on top of authentication (valid token).
// The role lives in Supabase `app_metadata.role`, which is server-managed
// (NOT user-editable, unlike `user_metadata`) and travels inside the JWT, so
// the gate can read it from the user that getUser()/refreshSession() already
// return — no extra DB query per request.
//
// Route → allowed-roles rules are declarative and extensible: add new prefixes
// or roles (e.g. 'editor') here without touching the gate logic.
// ---------------------------------------------------------------------------

export type AppRole = 'admin'

interface RouteRoleRule {
  prefix: string
  roles: readonly AppRole[]
}

const ROUTE_ROLE_RULES: readonly RouteRoleRule[] = [{ prefix: '/admin', roles: ['admin'] }]

/**
 * Returns the roles allowed to access `pathname`, or null if the path is not
 * gated (public). Longest/first matching prefix wins.
 */
export function resolveAllowedRoles(pathname: string): readonly AppRole[] | null {
  const rule = ROUTE_ROLE_RULES.find((r) => pathname.startsWith(r.prefix))
  return rule ? rule.roles : null
}

/**
 * Safely reads `app_metadata.role` from an opaque user object. Returns the role
 * string, or null if absent or not a string (no spoofing via odd shapes).
 */
export function extractRole(user: unknown): string | null {
  if (!user || typeof user !== 'object') return null
  const meta = (user as { app_metadata?: unknown }).app_metadata
  if (!meta || typeof meta !== 'object') return null
  const role = (meta as { role?: unknown }).role
  return typeof role === 'string' ? role : null
}

/** True only when `role` is non-null and present in `allowed`. */
export function isRoleAuthorized(role: string | null, allowed: readonly string[]): boolean {
  return role !== null && allowed.includes(role)
}

// ---------------------------------------------------------------------------
// resolveAuthGate
//
// Pure, injectable middleware decision helper. Encapsulates all auth-gate
// branching so the real middleware.ts only handles I/O (cookie reads/writes,
// redirects) and delegates all decisions here.
//
// Decision flow (authentication + role authorization):
//   1. skipAuth=true                       → allow (no Supabase call)
//   2. no refreshToken                     → redirect (nothing to recover with)
//   3. accessToken present → getUser()     → if valid user:
//        role authorized   → allow
//        role unauthorized → forbidden (do NOT refresh — refresh won't change
//                            the role; the user simply lacks permission)
//        getUser fails     → fall through to step 4
//   4. getUser fails OR accessToken absent → refreshSession() (one attempt)
//        refresh ok + role authorized   → set-cookies-and-allow (new tokens)
//        refresh ok + role unauthorized → forbidden
//        refresh fails/throws           → redirect
//
// Rationale for step 4: per spec "Expired access token triggers single refresh"
// the gate MUST attempt a refresh whenever the access token is absent or
// invalid AND a refresh token is present.
//
// Authorization note: 'forbidden' is distinct from 'redirect-to-login'. A user
// with a valid session but the wrong role is authenticated, just not allowed —
// bouncing them to /login would loop. The caller maps 'forbidden' → HTTP 403.
// The role is read from `app_metadata.role` on the user object (see extractRole).
// ---------------------------------------------------------------------------

export interface AuthGateState {
  accessToken: string | undefined
  refreshToken: string | undefined
  skipAuth: boolean
  /** Roles allowed for the requested route (from resolveAllowedRoles). */
  allowedRoles: readonly string[]
}

export interface AuthGateDeps {
  /** Call Supabase getUser with the given access token. */
  getUser: (token: string) => Promise<{ user: object | null; error: { message: string } | null }>
  /** Call Supabase refreshSession with the given refresh token (one attempt). */
  refreshSession: (token: string) => Promise<
    | { session: { access_token: string; refresh_token: string }; user: object | null; error: null }
    | { session: null; user: null; error: { message: string } }
  >
}

export type AuthGateDecision =
  | { action: 'allow' }
  | { action: 'redirect-to-login' }
  | { action: 'forbidden' }
  | { action: 'set-cookies-and-allow'; accessToken: string; refreshToken: string }

type AccessCheck =
  | { status: 'valid'; role: string | null } // getUser succeeded with a user
  | { status: 'invalid' } // error, no user, or threw → caller should try refresh

async function checkAccessToken(accessToken: string, deps: AuthGateDeps): Promise<AccessCheck> {
  try {
    const { user, error } = await deps.getUser(accessToken)
    if (error || !user) return { status: 'invalid' }
    return { status: 'valid', role: extractRole(user) }
  } catch {
    return { status: 'invalid' }
  }
}

async function refreshAuthSession(
  refreshToken: string,
  allowedRoles: readonly string[],
  deps: AuthGateDeps
): Promise<AuthGateDecision> {
  try {
    const refreshResult = await deps.refreshSession(refreshToken)
    if (!refreshResult.error && refreshResult.session) {
      if (!isRoleAuthorized(extractRole(refreshResult.user), allowedRoles)) {
        return { action: 'forbidden' }
      }
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

  // Step 3: if we have an access token, validate it and authorize the role
  if (state.accessToken) {
    const check = await checkAccessToken(state.accessToken, deps)
    if (check.status === 'valid') {
      // Authenticated. Authorized only if the role is permitted; otherwise 403.
      // We do NOT fall through to refresh — refreshing won't grant a new role.
      return isRoleAuthorized(check.role, state.allowedRoles)
        ? { action: 'allow' }
        : { action: 'forbidden' }
    }
    // check.status === 'invalid' → token expired/invalid, fall through to refresh
  }

  // Step 4: access token absent, expired, or invalid — attempt exactly ONE refresh
  return refreshAuthSession(state.refreshToken, state.allowedRoles, deps)
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
