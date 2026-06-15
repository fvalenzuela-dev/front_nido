export const prerender = false

import type { APIRoute } from 'astro'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { getSupabaseAdmin, getSupabaseForRequest } from '@/lib/supabase'
import { parsePanelForm } from '@/lib/panel-form'
import { insertPanel as defaultInsertPanel } from '@/lib/panels'

// ---------------------------------------------------------------------------
// Narrow context interface — only the fields the handler uses, so tests can
// pass plain objects (mirrors handleLoginPost in src/pages/api/auth/login.ts).
// ---------------------------------------------------------------------------

export interface CreatePanelContext {
  request: { formData: () => Promise<FormData> }
  cookies: { get: (name: string) => { value: string } | undefined }
  redirect: (url: string, status: number) => Response
}

// ---------------------------------------------------------------------------
// Deps — all external I/O injectable. getClient receives the user's access
// token so it builds the request-scoped anon client (RLS authorizes by role);
// it is only called after validation so early returns need no env vars.
// ---------------------------------------------------------------------------

export interface CreatePanelDeps {
  getClient: (accessToken: string | undefined) => SupabaseClient<Database>
  insertPanel: typeof defaultInsertPanel
}

const FORM_PATH = '/admin/productos/nuevo'
const SUCCESS_PATH = '/admin/productos'

export async function handleCreatePanelPost(
  context: CreatePanelContext,
  deps: CreatePanelDeps
): Promise<Response> {
  // Parse form data — failure means something is wrong server-side.
  let formData: FormData
  try {
    formData = await context.request.formData()
  } catch {
    return context.redirect(`${FORM_PATH}?error=server_error`, 303)
  }

  // Validate + normalize before touching Supabase.
  const parsed = parsePanelForm(formData)
  if (!parsed.ok) {
    return context.redirect(`${FORM_PATH}?error=${parsed.code}`, 303)
  }

  try {
    // Authorization is enforced by RLS via the user's role: read the access
    // token and build a request-scoped anon client. The wrapper falls back to
    // the service-key client only under the SKIP_ADMIN_AUTH dev bypass.
    const accessToken = context.cookies.get('sb-access-token')?.value
    const client = deps.getClient(accessToken)

    const { error } = await deps.insertPanel(client, parsed.value)
    if (error) {
      // Server-only log: el mensaje real de Supabase (p.ej. violación de RLS)
      // queda en los logs del servidor para diagnóstico; al cliente solo va el
      // código genérico db_error.
      console.error('[create-panel] insert rechazado por Supabase:', error)
      return context.redirect(`${FORM_PATH}?error=db_error`, 303)
    }

    return context.redirect(SUCCESS_PATH, 303)
  } catch (e) {
    console.error('[create-panel] excepción inesperada:', e)
    return context.redirect(`${FORM_PATH}?error=server_error`, 303)
  }
}

// ---------------------------------------------------------------------------
// POST — thin wrapper supplying real dependencies
// ---------------------------------------------------------------------------

export const POST: APIRoute = (ctx) =>
  handleCreatePanelPost(
    {
      request: ctx.request,
      cookies: {
        get: (name) => {
          const cookie = ctx.cookies.get(name)
          return cookie ? { value: cookie.value } : undefined
        },
      },
      redirect: (url, status) => ctx.redirect(url, status as Parameters<typeof ctx.redirect>[1]),
    },
    {
      getClient: (accessToken) =>
        accessToken ? getSupabaseForRequest(accessToken) : getSupabaseAdmin(),
      insertPanel: defaultInsertPanel,
    }
  )
