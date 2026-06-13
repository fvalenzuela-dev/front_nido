import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import {
  validateCredentials,
  buildCookieOptions,
  buildSignOutCookies,
  sanitizeAuthError,
  signIn,
  resolveAuthGate,
} from './auth'
import type { AuthGateDeps } from './auth'

// ---------------------------------------------------------------------------
// Stub Supabase client helpers (no vi.mock — injectable pattern)
// ---------------------------------------------------------------------------

type SignInResult =
  | { data: { session: { access_token: string; refresh_token: string } }; error: null }
  | { data: { session: null }; error: { message: string } }

function makeOkClient(session: { access_token: string; refresh_token: string }) {
  return {
    auth: {
      signInWithPassword: () =>
        Promise.resolve({ data: { session }, error: null } as SignInResult),
    },
  } as unknown as SupabaseClient<Database>
}

function makeErrClient(message: string) {
  return {
    auth: {
      signInWithPassword: () =>
        Promise.resolve({
          data: { session: null },
          error: { message },
        } as SignInResult),
    },
  } as unknown as SupabaseClient<Database>
}

const throwClient = {
  auth: {
    signInWithPassword: () => {
      throw new Error('network failure')
    },
  },
} as unknown as SupabaseClient<Database>

const fakeSession = { access_token: 'tok-access', refresh_token: 'tok-refresh' }

// ---------------------------------------------------------------------------
// validateCredentials
// ---------------------------------------------------------------------------

describe('validateCredentials', () => {
  it('valid email and password → { valid: true, code: null }', () => {
    const result = validateCredentials('user@example.com', 'password123')
    expect(result.valid).toBe(true)
    expect(result.code).toBeNull()
  })

  it('empty email → { valid: false, code: "missing_fields" }', () => {
    const result = validateCredentials('', 'password123')
    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_fields')
  })

  it('whitespace-only email → { valid: false, code: "missing_fields" }', () => {
    const result = validateCredentials('   ', 'password123')
    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_fields')
  })

  it('empty password → { valid: false, code: "missing_fields" }', () => {
    const result = validateCredentials('user@example.com', '')
    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_fields')
  })

  it('whitespace-only password → { valid: false, code: "missing_fields" }', () => {
    const result = validateCredentials('user@example.com', '   ')
    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_fields')
  })

  it('non-string email (null) → { valid: false, code: "missing_fields" }', () => {
    const result = validateCredentials(null, 'password123')
    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_fields')
  })

  it('non-string password (undefined) → { valid: false, code: "missing_fields" }', () => {
    const result = validateCredentials('user@example.com', undefined)
    expect(result.valid).toBe(false)
    expect(result.code).toBe('missing_fields')
  })
})

// ---------------------------------------------------------------------------
// buildCookieOptions
// ---------------------------------------------------------------------------

describe('buildCookieOptions', () => {
  it('secure=true → { httpOnly: true, secure: true, sameSite: "lax", path: "/" }', () => {
    const opts = buildCookieOptions(true)
    expect(opts.httpOnly).toBe(true)
    expect(opts.secure).toBe(true)
    expect(opts.sameSite).toBe('lax')
    expect(opts.path).toBe('/')
  })

  it('secure=false → { httpOnly: true, secure: false, sameSite: "lax", path: "/" }', () => {
    const opts = buildCookieOptions(false)
    expect(opts.httpOnly).toBe(true)
    expect(opts.secure).toBe(false)
    expect(opts.sameSite).toBe('lax')
    expect(opts.path).toBe('/')
  })
})

// ---------------------------------------------------------------------------
// buildSignOutCookies
// ---------------------------------------------------------------------------

describe('buildSignOutCookies', () => {
  it('returns two entries: sb-access-token and sb-refresh-token, both maxAge 0', () => {
    const cookies = buildSignOutCookies()
    expect(cookies).toHaveLength(2)

    const names = cookies.map((c) => c.name)
    expect(names).toContain('sb-access-token')
    expect(names).toContain('sb-refresh-token')

    for (const cookie of cookies) {
      expect(cookie.options.maxAge).toBe(0)
      expect(cookie.options.path).toBe('/')
    }
  })
})

// ---------------------------------------------------------------------------
// sanitizeAuthError
// ---------------------------------------------------------------------------

describe('sanitizeAuthError', () => {
  it('"invalid_credentials" → returns Spanish user-friendly string (non-empty)', () => {
    const msg = sanitizeAuthError('invalid_credentials')
    expect(msg.length).toBeGreaterThan(0)
    expect(msg).not.toBe('invalid_credentials') // not the raw code
  })

  it('"missing_fields" → returns Spanish user-friendly string (non-empty)', () => {
    const msg = sanitizeAuthError('missing_fields')
    expect(msg.length).toBeGreaterThan(0)
    expect(msg).not.toBe('missing_fields')
  })

  it('"server_error" → returns Spanish user-friendly string (non-empty)', () => {
    const msg = sanitizeAuthError('server_error')
    expect(msg.length).toBeGreaterThan(0)
    expect(msg).not.toBe('server_error')
  })

  it('unknown code → returns empty string', () => {
    const msg = sanitizeAuthError('UNKNOWN_XYZ')
    expect(msg).toBe('')
  })

  it('null → returns empty string', () => {
    const msg = sanitizeAuthError(null)
    expect(msg).toBe('')
  })

  it('empty string → returns empty string', () => {
    const msg = sanitizeAuthError('')
    expect(msg).toBe('')
  })
})

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

describe('signIn', () => {
  it('ok stub → returns { session, error: null }', async () => {
    const result = await signIn('user@example.com', 'pass', makeOkClient(fakeSession))
    expect(result.session).toEqual(fakeSession)
    expect(result.error).toBeNull()
  })

  it('error stub → returns { session: null, error: "invalid_credentials" }', async () => {
    const result = await signIn('user@example.com', 'wrong', makeErrClient('Invalid login credentials'))
    expect(result.session).toBeNull()
    expect(result.error).toBe('invalid_credentials')
  })

  it('error stub: raw Supabase message does not appear in error field', async () => {
    const result = await signIn('user@example.com', 'wrong', makeErrClient('Invalid login credentials'))
    expect(result.error).not.toBe('Invalid login credentials')
    expect(result.error).not.toContain('Invalid login credentials')
  })

  it('throwing stub → returns { session: null, error: "invalid_credentials" }, does not throw', async () => {
    const result = await signIn('user@example.com', 'pass', throwClient)
    expect(result.session).toBeNull()
    expect(result.error).toBe('invalid_credentials')
  })
})

// ---------------------------------------------------------------------------
// resolveAuthGate
// Pure helper that encapsulates all middleware branching logic.
// Receives auth state + injectable async ops; returns a decision (no I/O).
// ---------------------------------------------------------------------------

// Stub helpers for resolveAuthGate tests

function makeGetUser(
  result: { user: object | null; error: { message: string } | null }
): AuthGateDeps['getUser'] {
  return (_token: string) => Promise.resolve(result)
}

function makeRefreshSession(
  result:
    | { session: { access_token: string; refresh_token: string }; error: null }
    | { session: null; error: { message: string } }
): AuthGateDeps['refreshSession'] {
  return (_token: string) => Promise.resolve(result)
}

const validUser = { id: 'user-1', email: 'a@b.com' }
const newTokens = { access_token: 'new-access', refresh_token: 'new-refresh' }

describe('resolveAuthGate', () => {
  // Scenario 1: skipAuth flag bypasses everything
  it('skipAuth=true → allow without calling getUser or refreshSession', async () => {
    let getUserCalled = false
    let refreshCalled = false

    const deps: AuthGateDeps = {
      getUser: (_t) => { getUserCalled = true; return Promise.resolve({ user: null, error: { message: 'should not be called' } }) },
      refreshSession: (_t) => { refreshCalled = true; return Promise.resolve({ session: null, error: { message: 'should not be called' } }) },
    }

    const result = await resolveAuthGate({ accessToken: undefined, refreshToken: undefined, skipAuth: true }, deps)
    expect(result.action).toBe('allow')
    expect(getUserCalled).toBe(false)
    expect(refreshCalled).toBe(false)
  })

  // Scenario 2: valid access token → allow
  it('valid access token (getUser succeeds) → allow, no refresh attempted', async () => {
    let refreshCalled = false

    const deps: AuthGateDeps = {
      getUser: makeGetUser({ user: validUser, error: null }),
      refreshSession: (_t) => { refreshCalled = true; return Promise.resolve({ session: null, error: { message: 'should not be called' } }) },
    }

    const result = await resolveAuthGate({ accessToken: 'valid-access', refreshToken: 'some-refresh', skipAuth: false }, deps)
    expect(result.action).toBe('allow')
    expect(refreshCalled).toBe(false)
  })

  // Scenario 3: both tokens absent → redirect-to-login (no getUser or refresh)
  it('both tokens absent → redirect-to-login without calling getUser or refreshSession', async () => {
    let getUserCalled = false
    let refreshCalled = false

    const deps: AuthGateDeps = {
      getUser: (_t) => { getUserCalled = true; return Promise.resolve({ user: null, error: { message: 'noop' } }) },
      refreshSession: (_t) => { refreshCalled = true; return Promise.resolve({ session: null, error: { message: 'noop' } }) },
    }

    const result = await resolveAuthGate({ accessToken: undefined, refreshToken: undefined, skipAuth: false }, deps)
    expect(result.action).toBe('redirect-to-login')
    expect(getUserCalled).toBe(false)
    expect(refreshCalled).toBe(false)
  })

  // Scenario 4: access token absent/expired + valid refresh → set-cookies-and-allow
  it('access token absent, valid refresh token → attempt refresh, set-cookies-and-allow', async () => {
    const deps: AuthGateDeps = {
      getUser: makeGetUser({ user: null, error: { message: 'Invalid token' } }),
      refreshSession: makeRefreshSession({ session: newTokens, error: null }),
    }

    const result = await resolveAuthGate({ accessToken: undefined, refreshToken: 'valid-refresh', skipAuth: false }, deps)
    expect(result.action).toBe('set-cookies-and-allow')
    if (result.action === 'set-cookies-and-allow') {
      expect(result.accessToken).toBe(newTokens.access_token)
      expect(result.refreshToken).toBe(newTokens.refresh_token)
    }
  })

  // Scenario 4b: access token expired (getUser fails) + valid refresh → set-cookies-and-allow
  it('access token expired (getUser fails), valid refresh token → one refresh, set-cookies-and-allow', async () => {
    let refreshCallCount = 0

    const deps: AuthGateDeps = {
      getUser: makeGetUser({ user: null, error: { message: 'JWT expired' } }),
      refreshSession: (_t) => {
        refreshCallCount++
        return Promise.resolve({ session: newTokens, error: null })
      },
    }

    const result = await resolveAuthGate({ accessToken: 'expired-access', refreshToken: 'valid-refresh', skipAuth: false }, deps)
    expect(result.action).toBe('set-cookies-and-allow')
    expect(refreshCallCount).toBe(1) // exactly ONE refresh attempt
    if (result.action === 'set-cookies-and-allow') {
      expect(result.accessToken).toBe(newTokens.access_token)
      expect(result.refreshToken).toBe(newTokens.refresh_token)
    }
  })

  // Scenario 5: expired access + invalid refresh → redirect-to-login
  it('expired access token + invalid refresh token → redirect-to-login', async () => {
    const deps: AuthGateDeps = {
      getUser: makeGetUser({ user: null, error: { message: 'JWT expired' } }),
      refreshSession: makeRefreshSession({ session: null, error: { message: 'Refresh token expired' } }),
    }

    const result = await resolveAuthGate({ accessToken: 'expired-access', refreshToken: 'invalid-refresh', skipAuth: false }, deps)
    expect(result.action).toBe('redirect-to-login')
  })

  // Scenario 6: refresh throws → redirect-to-login (does not propagate error)
  it('refreshSession throws → redirect-to-login, does not throw', async () => {
    const deps: AuthGateDeps = {
      getUser: makeGetUser({ user: null, error: { message: 'JWT expired' } }),
      refreshSession: (_t) => Promise.reject(new Error('network failure')),
    }

    const result = await resolveAuthGate({ accessToken: 'expired-access', refreshToken: 'valid-refresh', skipAuth: false }, deps)
    expect(result.action).toBe('redirect-to-login')
  })
})
