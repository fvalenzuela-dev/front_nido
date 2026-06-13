export const prerender = false

import type { APIRoute } from 'astro'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildSignOutCookies as defaultBuildSignOutCookies } from '@/lib/auth'
import type { buildSignOutCookies as BuildSignOutCookiesFn } from '@/lib/auth'

// ---------------------------------------------------------------------------
// Narrow context interface — only the fields the handler actually uses.
// Defined here (not imported from Astro) so tests can provide plain objects
// without satisfying every private field of AstroCookies / APIContext.
// ---------------------------------------------------------------------------

export interface LogoutContext {
  cookies: {
    get: (name: string) => { value: string } | undefined
    set: (name: string, value: string, options: Record<string, unknown>) => void
  }
  redirect: (url: string, status: number) => Response
}

// ---------------------------------------------------------------------------
// Deps interface — all external I/O is injectable so the handler is testable
// without real env vars. getAdmin is a factory (lazy) and is only called
// when an access token cookie exists, so tests on the no-token path are safe.
// ---------------------------------------------------------------------------

export interface LogoutDeps {
  getAdmin: () => SupabaseClient<Database>
  buildSignOutCookies: typeof BuildSignOutCookiesFn
}

// ---------------------------------------------------------------------------
// handleLogoutPost — exported pure-ish handler, fully unit-testable
// ---------------------------------------------------------------------------

export async function handleLogoutPost(
  context: LogoutContext,
  deps: LogoutDeps,
): Promise<Response> {
  // Best-effort: invalidate server-side session (errors ignored)
  // getAdmin() is only invoked here — after the token check — so tests that
  // exercise the no-token path never trigger it (no env vars needed).
  const accessToken = context.cookies.get('sb-access-token')?.value
  if (accessToken) {
    try {
      await deps.getAdmin().auth.admin.signOut(accessToken)
    } catch {
      // Intentionally ignored — cookies are cleared regardless
    }
  }

  // Clear both session cookies (maxAge: 0 expires them immediately)
  for (const { name, options } of deps.buildSignOutCookies()) {
    context.cookies.set(name, '', options)
  }

  return context.redirect('/login', 303)
}

// ---------------------------------------------------------------------------
// POST — thin wrapper that supplies real dependencies
// ---------------------------------------------------------------------------

export const POST: APIRoute = (ctx) =>
  handleLogoutPost(
    {
      cookies: {
        get: (name) => ctx.cookies.get(name),
        set: (name, value, options) =>
          ctx.cookies.set(name, value, options as Parameters<typeof ctx.cookies.set>[2]),
      },
      redirect: (url, status) => ctx.redirect(url, status as Parameters<typeof ctx.redirect>[1]),
    },
    {
      getAdmin: getSupabaseAdmin,
      buildSignOutCookies: defaultBuildSignOutCookies,
    },
  )
