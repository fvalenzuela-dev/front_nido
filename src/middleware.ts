import { defineMiddleware } from 'astro:middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const isAdminRoute = url.pathname.startsWith('/admin')

  if (isAdminRoute) {
    const accessToken = cookies.get('sb-access-token')?.value
    const refreshToken = cookies.get('sb-refresh-token')?.value

    if (!accessToken || !refreshToken) {
      return redirect('/login')
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken)

    if (error || !user) {
      return redirect('/login')
    }
  }

  return next()
})
