import { defineMiddleware } from 'astro:middleware'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildCookieOptions, ACCESS_MAX_AGE, REFRESH_MAX_AGE } from '@/lib/auth'

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const isAdminRoute = url.pathname.startsWith('/admin')

  if (!isAdminRoute) {
    return next()
  }

  // Explicit server-only dev bypass. Set SKIP_ADMIN_AUTH=true in .env for
  // local development only. NEVER set this in production or Vercel preview.
  if (import.meta.env.SKIP_ADMIN_AUTH === 'true') {
    return next()
  }

  const accessToken = cookies.get('sb-access-token')?.value
  const refreshToken = cookies.get('sb-refresh-token')?.value

  // No tokens at all — redirect to login
  if (!accessToken || !refreshToken) {
    return redirect('/login')
  }

  // Attempt to validate the access token
  const admin = getSupabaseAdmin()
  const { data: { user }, error: getUserError } = await admin.auth.getUser(accessToken)

  if (!getUserError && user) {
    // Access token is valid — allow request
    return next()
  }

  // Access token invalid — attempt exactly ONE refresh using the refresh token
  const { data: refreshData, error: refreshError } = await admin.auth.refreshSession({
    refresh_token: refreshToken,
  })

  if (!refreshError && refreshData.session) {
    // Refresh succeeded — re-set both cookies with new tokens and allow request
    const isProduction = import.meta.env.PROD
    const cookieOptions = buildCookieOptions(isProduction)

    cookies.set('sb-access-token', refreshData.session.access_token, {
      ...cookieOptions,
      maxAge: ACCESS_MAX_AGE,
    })
    cookies.set('sb-refresh-token', refreshData.session.refresh_token, {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE,
    })

    return next()
  }

  // Both access and refresh tokens are invalid — force re-login
  return redirect('/login')
})
