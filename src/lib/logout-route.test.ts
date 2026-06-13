import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { buildSignOutCookies } from '@/lib/auth'
import type { LogoutContext } from '@/pages/api/auth/logout'
import { handleLogoutPost, POST } from '@/pages/api/auth/logout'

// ---------------------------------------------------------------------------
// Stubs — no vi.mock, injectable pattern
// ---------------------------------------------------------------------------

/** A minimal stub for cookies that records every set() call and can return a value for get() */
function makeCookieStub(accessTokenValue?: string): LogoutContext['cookies'] & {
  _calls: Array<{ name: string; value: string; options: Record<string, unknown> }>
} {
  const setCalls: Array<{
    name: string
    value: string
    options: Record<string, unknown>
  }> = []

  return {
    get: (name: string): { value: string } | undefined => {
      if (name === 'sb-access-token' && accessTokenValue !== undefined) {
        return { value: accessTokenValue }
      }
      return undefined
    },
    set: (name: string, value: string, options: Record<string, unknown>) => {
      setCalls.push({ name, value, options })
    },
    _calls: setCalls,
  }
}

/** Stub redirect that returns a traceable Response */
function makeRedirectStub(): (url: string, status: number) => Response {
  return (url: string, status: number): Response =>
    new Response(null, { status, headers: { location: url } })
}

/** Make a stub admin client whose auth.admin.signOut resolves normally */
function makeOkAdminClient(): SupabaseClient<Database> {
  return {
    auth: {
      admin: {
        signOut: (_token: string) => Promise.resolve({ data: {}, error: null }),
      },
    },
  } as unknown as SupabaseClient<Database>
}

/** Make a stub admin client whose auth.admin.signOut throws */
function makeThrowingAdminClient(): SupabaseClient<Database> {
  return {
    auth: {
      admin: {
        signOut: (_token: string) => {
          throw new Error('admin signOut network failure')
        },
      },
    },
  } as unknown as SupabaseClient<Database>
}

// ---------------------------------------------------------------------------
// handleLogoutPost — unit tests
// ---------------------------------------------------------------------------

describe('handleLogoutPost', () => {
  // -------------------------------------------------------------------------
  // No access token — getAdmin must NOT be called
  // -------------------------------------------------------------------------

  it('no access token cookie → getAdmin NOT called, both cookies cleared, redirect /login (303)', async () => {
    let getAdminCalled = false
    const cookies = makeCookieStub(undefined) // no token
    const redirect = makeRedirectStub()

    const res = await handleLogoutPost(
      { cookies, redirect },
      {
        getAdmin: () => { getAdminCalled = true; return makeOkAdminClient() },
        buildSignOutCookies,
      },
    )

    expect(getAdminCalled).toBe(false)
    expect(res.headers.get('location')).toBe('/login')
    expect(res.status).toBe(303)

    // Both cookies must be cleared (maxAge: 0)
    const names = cookies._calls.map((c) => c.name)
    expect(names).toContain('sb-access-token')
    expect(names).toContain('sb-refresh-token')
    for (const call of cookies._calls) {
      expect(call.options.maxAge).toBe(0)
    }
  })

  // -------------------------------------------------------------------------
  // Access token present, signOut succeeds
  // -------------------------------------------------------------------------

  it('access token present, signOut succeeds → cookies cleared, redirect /login (303)', async () => {
    let getAdminCalled = false
    const cookies = makeCookieStub('valid-access-token')
    const redirect = makeRedirectStub()

    const res = await handleLogoutPost(
      { cookies, redirect },
      {
        getAdmin: () => { getAdminCalled = true; return makeOkAdminClient() },
        buildSignOutCookies,
      },
    )

    expect(getAdminCalled).toBe(true)
    expect(res.headers.get('location')).toBe('/login')
    expect(res.status).toBe(303)

    const names = cookies._calls.map((c) => c.name)
    expect(names).toContain('sb-access-token')
    expect(names).toContain('sb-refresh-token')
    for (const call of cookies._calls) {
      expect(call.options.maxAge).toBe(0)
    }
  })

  // -------------------------------------------------------------------------
  // Access token present, signOut throws — error is swallowed, cookies still cleared
  // -------------------------------------------------------------------------

  it('access token present, signOut throws → error swallowed, cookies still cleared, redirect /login', async () => {
    const cookies = makeCookieStub('some-access-token')
    const redirect = makeRedirectStub()

    // Should not throw even when admin client throws
    const res = await handleLogoutPost(
      { cookies, redirect },
      {
        getAdmin: () => makeThrowingAdminClient(),
        buildSignOutCookies,
      },
    )

    expect(res.headers.get('location')).toBe('/login')
    expect(res.status).toBe(303)

    // Cookies must still be cleared despite the throw
    const names = cookies._calls.map((c) => c.name)
    expect(names).toContain('sb-access-token')
    expect(names).toContain('sb-refresh-token')
    for (const call of cookies._calls) {
      expect(call.options.maxAge).toBe(0)
    }
  })

  // -------------------------------------------------------------------------
  // Cleared cookie attributes
  // -------------------------------------------------------------------------

  it('cleared cookies use path="/"', async () => {
    const cookies = makeCookieStub(undefined)
    const redirect = makeRedirectStub()

    await handleLogoutPost(
      { cookies, redirect },
      { getAdmin: () => makeOkAdminClient(), buildSignOutCookies },
    )

    for (const call of cookies._calls) {
      expect(call.options.path).toBe('/')
    }
  })

  it('cleared cookie values are empty string', async () => {
    const cookies = makeCookieStub(undefined)
    const redirect = makeRedirectStub()

    await handleLogoutPost(
      { cookies, redirect },
      { getAdmin: () => makeOkAdminClient(), buildSignOutCookies },
    )

    for (const call of cookies._calls) {
      expect(call.value).toBe('')
    }
  })
})

// ---------------------------------------------------------------------------
// Real POST wrapper — covers the wrapper line for the no-token path
// (getAdmin is lazy and only invoked when an access token is present,
//  so no env vars are needed for this smoke test)
// ---------------------------------------------------------------------------

describe('POST (real wrapper smoke test)', () => {
  it('no access token cookie → 303 redirect to /login (wrapper covered)', async () => {
    const ctx = {
      cookies: {
        get: (_name: string) => undefined,
        set: (_name: string, _value: string, _options: unknown) => undefined,
      },
      redirect: (url: string, status?: number) =>
        new Response(null, { status: status ?? 302, headers: { location: url } }),
    } as unknown as Parameters<typeof POST>[0]

    const res = await POST(ctx)

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/login')
  })
})
