export const prerender = false

import type { APIRoute } from 'astro'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getSupabaseClient } from '@/lib/supabase'
import {
  validateCredentials,
  signIn as defaultSignIn,
  buildCookieOptions,
  ACCESS_MAX_AGE,
  REFRESH_MAX_AGE,
} from '@/lib/auth'
import type { signIn as SignInFn } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Narrow context interface — only the fields the handler actually uses.
// Defined here (not imported from Astro) so tests can provide plain objects
// without satisfying every private field of AstroCookies / APIContext.
// ---------------------------------------------------------------------------

export interface LoginContext {
  request: { formData: () => Promise<FormData> }
  cookies: {
    set: (name: string, value: string, options: Record<string, unknown>) => void
  }
  redirect: (url: string, status: number) => Response
}

// ---------------------------------------------------------------------------
// Deps interface — all external I/O is injectable so the handler is testable
// without real env vars. getClient is a factory (lazy) so tests that exercise
// early-return paths (validation, formData errors) never trigger it.
// ---------------------------------------------------------------------------

export interface LoginDeps {
  getClient: () => SupabaseClient<Database>
  isProduction: boolean
  signIn: typeof SignInFn
}

// ---------------------------------------------------------------------------
// handleLoginPost — exported pure-ish handler, fully unit-testable
// ---------------------------------------------------------------------------

export async function handleLoginPost(
  context: LoginContext,
  deps: LoginDeps,
): Promise<Response> {
  // Parse form data — errors here mean something very wrong server-side
  let email: FormDataEntryValue | null = null
  let password: FormDataEntryValue | null = null

  try {
    const formData = await context.request.formData()
    email = formData.get('email')
    password = formData.get('password')
  } catch {
    return context.redirect('/login?error=server_error', 303)
  }

  // Validate credentials before calling Supabase
  const validation = validateCredentials(email, password)
  if (!validation.valid) {
    return context.redirect(`/login?error=${validation.code}`, 303)
  }

  // Attempt sign in using ANON client (SERVICE_KEY never used here)
  // getClient() is only called here — after validation — so tests on early-return
  // paths never trigger it and don't need real env vars.
  try {
    const result = await deps.signIn(
      email as string,
      password as string,
      deps.getClient(),
    )

    if (result.error || !result.session) {
      return context.redirect(`/login?error=${result.error ?? 'invalid_credentials'}`, 303)
    }

    const cookieOptions = buildCookieOptions(deps.isProduction)

    context.cookies.set('sb-access-token', result.session.access_token, {
      ...cookieOptions,
      maxAge: ACCESS_MAX_AGE,
    })

    context.cookies.set('sb-refresh-token', result.session.refresh_token, {
      ...cookieOptions,
      maxAge: REFRESH_MAX_AGE,
    })

    return context.redirect('/admin', 303)
  } catch {
    return context.redirect('/login?error=server_error', 303)
  }
}

// ---------------------------------------------------------------------------
// POST — thin wrapper that supplies real dependencies
// ---------------------------------------------------------------------------

export const POST: APIRoute = (ctx) =>
  handleLoginPost(
    {
      request: ctx.request,
      cookies: {
        set: (name, value, options) =>
          ctx.cookies.set(name, value, options as Parameters<typeof ctx.cookies.set>[2]),
      },
      redirect: (url, status) => ctx.redirect(url, status as Parameters<typeof ctx.redirect>[1]),
    },
    {
      getClient: getSupabaseClient,
      isProduction: import.meta.env.PROD,
      signIn: defaultSignIn,
    },
  )
