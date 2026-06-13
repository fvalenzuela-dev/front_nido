import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { signIn, ACCESS_MAX_AGE, REFRESH_MAX_AGE } from '@/lib/auth'
import type { LoginContext } from '@/pages/api/auth/login'
import { handleLoginPost, POST } from '@/pages/api/auth/login'

// ---------------------------------------------------------------------------
// Stubs — no vi.mock, injectable pattern
// ---------------------------------------------------------------------------

/** A minimal stub for cookies that records every set() call */
function makeCookieStub(): {
  get: (name: string) => undefined
  set: (name: string, value: string, options: Record<string, unknown>) => void
  _calls: Array<{ name: string; value: string; options: Record<string, unknown> }>
} {
  const setCalls: Array<{
    name: string
    value: string
    options: Record<string, unknown>
  }> = []

  return {
    get: (_name: string) => undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      setCalls.push({ name, value, options })
    },
    _calls: setCalls,
  }
}

/** A stub redirect function that returns a traceable Response */
function makeRedirectStub(): (url: string, status: number) => Response {
  return (url: string, status: number): Response =>
    new Response(null, { status, headers: { location: url } })
}

/** Make a stub request whose formData() resolves with given email/password */
function makeFormRequest(email: string | null, password: string | null): LoginContext['request'] {
  const formData = new FormData()
  if (email !== null) formData.append('email', email)
  if (password !== null) formData.append('password', password)

  return {
    formData: () => Promise.resolve(formData),
  }
}

/** Make a stub request whose formData() rejects */
function makeThrowingRequest(): LoginContext['request'] {
  return {
    formData: () => Promise.reject(new Error('formData parse failure')),
  }
}

/** A fake Supabase client whose signInWithPassword succeeds */
function makeOkClient(session: { access_token: string; refresh_token: string }) {
  return {
    auth: {
      signInWithPassword: () =>
        Promise.resolve({ data: { session }, error: null }),
    },
  } as unknown as SupabaseClient<Database>
}

/** A fake Supabase client whose signInWithPassword returns an auth error */
function makeErrClient(message: string) {
  return {
    auth: {
      signInWithPassword: () =>
        Promise.resolve({ data: { session: null }, error: { message } }),
    },
  } as unknown as SupabaseClient<Database>
}

/** A fake Supabase client whose signInWithPassword throws */
const throwingClient: SupabaseClient<Database> = {
  auth: {
    signInWithPassword: () => {
      throw new Error('network failure')
    },
  },
} as unknown as SupabaseClient<Database>

const fakeSession = { access_token: 'access-abc', refresh_token: 'refresh-xyz' }

// ---------------------------------------------------------------------------
// handleLoginPost — unit tests
// ---------------------------------------------------------------------------

describe('handleLoginPost', () => {
  // -------------------------------------------------------------------------
  // Missing / empty fields — getClient must NOT be called
  // -------------------------------------------------------------------------

  it('missing email → redirect /login?error=missing_fields (303), getClient not called', async () => {
    let getClientCalled = false
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    const res = await handleLoginPost(
      { request: makeFormRequest(null, 'pass'), cookies, redirect },
      {
        getClient: () => { getClientCalled = true; return makeOkClient(fakeSession) },
        isProduction: false,
        signIn,
      },
    )

    expect(res.headers.get('location')).toBe('/login?error=missing_fields')
    expect(res.status).toBe(303)
    expect(getClientCalled).toBe(false)
    expect(cookies._calls).toHaveLength(0)
  })

  it('empty email → redirect /login?error=missing_fields, getClient not called', async () => {
    let getClientCalled = false
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    const res = await handleLoginPost(
      { request: makeFormRequest('', 'pass'), cookies, redirect },
      {
        getClient: () => { getClientCalled = true; return makeOkClient(fakeSession) },
        isProduction: false,
        signIn,
      },
    )

    expect(res.headers.get('location')).toBe('/login?error=missing_fields')
    expect(getClientCalled).toBe(false)
  })

  it('missing password → redirect /login?error=missing_fields, getClient not called', async () => {
    let getClientCalled = false
    const redirect = makeRedirectStub()
    const cookies = makeCookieStub()

    const res = await handleLoginPost(
      { request: makeFormRequest('user@example.com', null), cookies, redirect },
      {
        getClient: () => { getClientCalled = true; return makeOkClient(fakeSession) },
        isProduction: false,
        signIn,
      },
    )

    expect(res.headers.get('location')).toBe('/login?error=missing_fields')
    expect(getClientCalled).toBe(false)
  })

  it('whitespace-only password → redirect /login?error=missing_fields, getClient not called', async () => {
    let getClientCalled = false
    const redirect = makeRedirectStub()
    const cookies = makeCookieStub()

    const res = await handleLoginPost(
      { request: makeFormRequest('user@example.com', '   '), cookies, redirect },
      {
        getClient: () => { getClientCalled = true; return makeOkClient(fakeSession) },
        isProduction: false,
        signIn,
      },
    )

    expect(res.headers.get('location')).toBe('/login?error=missing_fields')
    expect(getClientCalled).toBe(false)
  })

  // -------------------------------------------------------------------------
  // formData() throws → server_error
  // -------------------------------------------------------------------------

  it('formData() throws → redirect /login?error=server_error (303)', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    const res = await handleLoginPost(
      { request: makeThrowingRequest(), cookies, redirect },
      { getClient: () => makeOkClient(fakeSession), isProduction: false, signIn },
    )

    expect(res.headers.get('location')).toBe('/login?error=server_error')
    expect(res.status).toBe(303)
    expect(cookies._calls).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // signIn returns error → invalid_credentials
  // -------------------------------------------------------------------------

  it('signIn returns auth error → redirect /login?error=invalid_credentials (303)', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    const res = await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'wrongpass'), cookies, redirect },
      { getClient: () => makeErrClient('Invalid login credentials'), isProduction: false, signIn },
    )

    expect(res.headers.get('location')).toBe('/login?error=invalid_credentials')
    expect(res.status).toBe(303)
    expect(cookies._calls).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // deps.signIn itself throws (unexpected) → server_error
  // Note: when the *client* throws, signIn() in auth.ts absorbs it and returns
  // { error: 'invalid_credentials' } — that case is covered by the above test.
  // This test covers the outer try/catch by making deps.signIn itself throw.
  // -------------------------------------------------------------------------

  it('deps.signIn throws unexpectedly → redirect /login?error=server_error (303)', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    const res = await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'pass'), cookies, redirect },
      {
        getClient: () => throwingClient,
        isProduction: false,
        signIn: () => {
          throw new Error('unexpected signIn failure')
        },
      },
    )

    expect(res.headers.get('location')).toBe('/login?error=server_error')
    expect(res.status).toBe(303)
    expect(cookies._calls).toHaveLength(0)
  })

  // -------------------------------------------------------------------------
  // Success path — cookies + redirect /admin
  // -------------------------------------------------------------------------

  it('success → redirect /admin (303)', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    const res = await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'correctpass'), cookies, redirect },
      { getClient: () => makeOkClient(fakeSession), isProduction: false, signIn },
    )

    expect(res.headers.get('location')).toBe('/admin')
    expect(res.status).toBe(303)
  })

  it('success → sets sb-access-token cookie with ACCESS_MAX_AGE and correct name/value', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'correctpass'), cookies, redirect },
      { getClient: () => makeOkClient(fakeSession), isProduction: false, signIn },
    )

    const accessCall = cookies._calls.find((c) => c.name === 'sb-access-token')
    expect(accessCall).toBeDefined()
    expect(accessCall?.value).toBe(fakeSession.access_token)
    expect(accessCall?.options.maxAge).toBe(ACCESS_MAX_AGE)
  })

  it('success → sets sb-refresh-token cookie with REFRESH_MAX_AGE and correct name/value', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'correctpass'), cookies, redirect },
      { getClient: () => makeOkClient(fakeSession), isProduction: false, signIn },
    )

    const refreshCall = cookies._calls.find((c) => c.name === 'sb-refresh-token')
    expect(refreshCall).toBeDefined()
    expect(refreshCall?.value).toBe(fakeSession.refresh_token)
    expect(refreshCall?.options.maxAge).toBe(REFRESH_MAX_AGE)
  })

  it('success → both cookies have httpOnly=true, sameSite="lax", path="/"', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'correctpass'), cookies, redirect },
      { getClient: () => makeOkClient(fakeSession), isProduction: false, signIn },
    )

    for (const call of cookies._calls) {
      expect(call.options.httpOnly).toBe(true)
      expect(call.options.sameSite).toBe('lax')
      expect(call.options.path).toBe('/')
    }
  })

  // -------------------------------------------------------------------------
  // secure flag reflects isProduction
  // -------------------------------------------------------------------------

  it('isProduction=true → cookies have secure=true', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'correctpass'), cookies, redirect },
      { getClient: () => makeOkClient(fakeSession), isProduction: true, signIn },
    )

    for (const call of cookies._calls) {
      expect(call.options.secure).toBe(true)
    }
  })

  it('isProduction=false → cookies have secure=false', async () => {
    const cookies = makeCookieStub()
    const redirect = makeRedirectStub()

    await handleLoginPost(
      { request: makeFormRequest('user@example.com', 'correctpass'), cookies, redirect },
      { getClient: () => makeOkClient(fakeSession), isProduction: false, signIn },
    )

    for (const call of cookies._calls) {
      expect(call.options.secure).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Real POST wrapper — covers the wrapper line for missing-fields path
// (getClient is lazy so it's never triggered, no env vars needed)
// ---------------------------------------------------------------------------

describe('POST (real wrapper smoke test)', () => {
  it('missing fields → 303 redirect with missing_fields error (wrapper covered)', async () => {
    // Build a minimal APIContext-compatible object using unknown cast to avoid
    // satisfying private fields on AstroCookies and the full APIContext shape.
    const formData = new FormData()
    // No email or password — triggers missing_fields validation

    const ctx = {
      request: {
        formData: () => Promise.resolve(formData),
        // Minimal extra Request fields astro might inspect — unused by our handler
      } as unknown as Request,
      cookies: {
        get: () => undefined,
        set: () => undefined,
      },
      redirect: (url: string, status?: number) =>
        new Response(null, { status: status ?? 302, headers: { location: url } }),
    } as unknown as Parameters<typeof POST>[0]

    const res = await POST(ctx)

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/login?error=missing_fields')
  })
})
