export const prerender = false

import type { APIRoute } from 'astro'
import { getSupabaseClient } from '@/lib/supabase'
import {
  validateCredentials,
  signIn,
  buildCookieOptions,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
} from '@/lib/auth'

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Parse form data
  let email: FormDataEntryValue | null = null
  let password: FormDataEntryValue | null = null

  try {
    const formData = await request.formData()
    email = formData.get('email')
    password = formData.get('password')
  } catch {
    return redirect('/login?error=server_error', 303)
  }

  // Validate credentials before calling Supabase
  const validation = validateCredentials(email, password)
  if (!validation.valid) {
    return redirect(`/login?error=${validation.code}`, 303)
  }

  // Attempt sign in using ANON client (SERVICE_KEY never used here)
  try {
    const isProduction = import.meta.env.PROD
    const result = await signIn(
      email as string,
      password as string,
      getSupabaseClient()
    )

    if (result.error || !result.session) {
      return redirect(`/login?error=${result.error ?? 'invalid_credentials'}`, 303)
    }

    const cookieOptions = buildCookieOptions(isProduction)

    cookies.set('sb-access-token', result.session.access_token, {
      ...cookieOptions,
      maxAge: ACCESS_MAX_AGE,
    })

    cookies.set('sb-refresh-token', result.session.refresh_token, {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE,
    })

    return redirect('/admin', 303)
  } catch {
    return redirect('/login?error=server_error', 303)
  }
}
