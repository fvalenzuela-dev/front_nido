import { supabaseAdmin } from '@/lib/supabase'

export async function getSession(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
  return { user: data.user, error }
}

export async function signOut(accessToken: string) {
  return supabaseAdmin.auth.admin.signOut(accessToken)
}
