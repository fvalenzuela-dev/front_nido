import { defineMiddleware } from 'astro:middleware'
import { supabaseAdmin } from '@/lib/supabase'

export const onRequest = defineMiddleware(async ({ url, cookies, redirect }, next) => {
  const isAdminRoute = url.pathname.startsWith('/admin')

  if (isAdminRoute) {
    // DEV-only bypass: skip auth in `astro dev` so the admin panel can be
    // previewed before real Supabase Auth exists. `import.meta.env.DEV` is
    // false in build/preview/production, so the panel stays protected there.
    if (import.meta.env.DEV) {
      return next()
    }

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
