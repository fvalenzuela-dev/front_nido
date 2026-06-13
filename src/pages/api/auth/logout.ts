export const prerender = false

import type { APIRoute } from 'astro'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildSignOutCookies } from '@/lib/auth'

export const POST: APIRoute = async ({ cookies, redirect }) => {
  // Best-effort: invalidate server-side session (ignore errors)
  const accessToken = cookies.get('sb-access-token')?.value
  if (accessToken) {
    try {
      await getSupabaseAdmin().auth.admin.signOut(accessToken)
    } catch {
      // Intentionally ignored — cookies are cleared regardless
    }
  }

  // Clear both session cookies (maxAge: 0 expires them immediately)
  for (const { name, options } of buildSignOutCookies()) {
    cookies.set(name, '', options)
  }

  return redirect('/login', 303)
}
