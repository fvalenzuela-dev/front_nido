import { defineMiddleware } from 'astro:middleware'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildCookieOptions, ACCESS_MAX_AGE, REFRESH_MAX_AGE, resolveAuthGate } from '@/lib/auth'
import type { AuthGateDeps } from '@/lib/auth'

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const isAdminRoute = url.pathname.startsWith('/admin')

  if (!isAdminRoute) {
    return next()
  }

  const accessToken = cookies.get('sb-access-token')?.value
  const refreshToken = cookies.get('sb-refresh-token')?.value

  // Build injectable deps that call the real Supabase admin client.
  // All cookie I/O and redirects remain here; only branching is in resolveAuthGate.
  const admin = getSupabaseAdmin()

  const deps: AuthGateDeps = {
    getUser: async (token) => {
      const { data, error } = await admin.auth.getUser(token)
      return { user: data.user, error: error ? { message: error.message } : null }
    },
    refreshSession: async (token) => {
      const { data, error } = await admin.auth.refreshSession({ refresh_token: token })
      if (error || !data.session) {
        return { session: null, error: { message: error?.message ?? 'Refresh failed' } }
      }
      return {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        },
        error: null,
      }
    },
  }

  // resolveAuthGate encapsulates all branching logic (WARNING-4 fix).
  // Behavior: skipAuth → allow; no refresh token → redirect; valid access token → allow;
  // access expired/absent + valid refresh → one refresh attempt → set-cookies-and-allow;
  // refresh fails/throws → redirect. (WARNING-3 fix: absent access token is now treated
  // the same as expired — refresh is attempted when a refresh token is present.)
  const decision = await resolveAuthGate(
    {
      accessToken,
      refreshToken,
      // Explicit server-only dev bypass. Set SKIP_ADMIN_AUTH=true in .env for
      // local development only. NEVER set this in production or Vercel preview.
      skipAuth: import.meta.env.SKIP_ADMIN_AUTH === 'true',
    },
    deps
  )

  if (decision.action === 'allow') {
    return next()
  }

  if (decision.action === 'set-cookies-and-allow') {
    const isProduction = import.meta.env.PROD
    const cookieOptions = buildCookieOptions(isProduction)

    cookies.set('sb-access-token', decision.accessToken, {
      ...cookieOptions,
      maxAge: ACCESS_MAX_AGE,
    })
    cookies.set('sb-refresh-token', decision.refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE,
    })

    return next()
  }

  // decision.action === 'redirect-to-login'
  return redirect('/login')
})
