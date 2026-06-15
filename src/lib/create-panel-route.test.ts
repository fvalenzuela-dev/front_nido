import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import type { CreatePanelContext } from '@/pages/api/admin/panels'
import { handleCreatePanelPost } from '@/pages/api/admin/panels'

// ---------------------------------------------------------------------------
// Stubs — injectable pattern, no vi.mock (mirrors login-route.test.ts)
// ---------------------------------------------------------------------------

function makeRedirectStub(): (url: string, status: number) => Response {
  return (url, status) => new Response(null, { status, headers: { location: url } })
}

function makeFormRequest(fields: Record<string, string>): CreatePanelContext['request'] {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.append(k, v)
  return { formData: () => Promise.resolve(fd) }
}

function makeThrowingRequest(): CreatePanelContext['request'] {
  return { formData: () => Promise.reject(new Error('formData parse failure')) }
}

function makeCookies(token: string | undefined): CreatePanelContext['cookies'] {
  return { get: (name) => (name === 'sb-access-token' && token ? { value: token } : undefined) }
}

const dummyClient = {} as unknown as SupabaseClient<Database>

const validFields = { nombre: 'Panel SIP 100', espesor_mm: '100' }

// ---------------------------------------------------------------------------
// handleCreatePanelPost
// ---------------------------------------------------------------------------

describe('handleCreatePanelPost', () => {
  it('formData() throws → redirect a /admin/productos/nuevo?error=server_error (303)', async () => {
    let getClientCalled = false
    const res = await handleCreatePanelPost(
      { request: makeThrowingRequest(), cookies: makeCookies('tok'), redirect: makeRedirectStub() },
      {
        getClient: () => { getClientCalled = true; return dummyClient },
        insertPanel: () => Promise.resolve({ error: null }),
      }
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/admin/productos/nuevo?error=server_error')
    expect(getClientCalled).toBe(false)
  })

  it('nombre ausente → missing_fields, no llama getClient ni insertPanel', async () => {
    let getClientCalled = false
    let insertCalled = false
    const res = await handleCreatePanelPost(
      { request: makeFormRequest({ espesor_mm: '100' }), cookies: makeCookies('tok'), redirect: makeRedirectStub() },
      {
        getClient: () => { getClientCalled = true; return dummyClient },
        insertPanel: () => { insertCalled = true; return Promise.resolve({ error: null }) },
      }
    )
    expect(res.headers.get('location')).toBe('/admin/productos/nuevo?error=missing_fields')
    expect(getClientCalled).toBe(false)
    expect(insertCalled).toBe(false)
  })

  it('número inválido → invalid_numbers, no inserta', async () => {
    let insertCalled = false
    const res = await handleCreatePanelPost(
      { request: makeFormRequest({ nombre: 'P', espesor_mm: 'abc' }), cookies: makeCookies('tok'), redirect: makeRedirectStub() },
      {
        getClient: () => dummyClient,
        insertPanel: () => { insertCalled = true; return Promise.resolve({ error: null }) },
      }
    )
    expect(res.headers.get('location')).toBe('/admin/productos/nuevo?error=invalid_numbers')
    expect(insertCalled).toBe(false)
  })

  it('insertPanel devuelve error → redirect ?error=db_error', async () => {
    const res = await handleCreatePanelPost(
      { request: makeFormRequest(validFields), cookies: makeCookies('tok'), redirect: makeRedirectStub() },
      {
        getClient: () => dummyClient,
        insertPanel: () => Promise.resolve({ error: 'RLS denied' }),
      }
    )
    expect(res.headers.get('location')).toBe('/admin/productos/nuevo?error=db_error')
  })

  it('insertPanel lanza → redirect ?error=server_error', async () => {
    const res = await handleCreatePanelPost(
      { request: makeFormRequest(validFields), cookies: makeCookies('tok'), redirect: makeRedirectStub() },
      {
        getClient: () => dummyClient,
        insertPanel: () => { throw new Error('boom') },
      }
    )
    expect(res.headers.get('location')).toBe('/admin/productos/nuevo?error=server_error')
  })

  it('éxito → redirect /admin/productos (303) con payload normalizado', async () => {
    let receivedPayload: unknown = null
    const res = await handleCreatePanelPost(
      {
        request: makeFormRequest({ nombre: 'Panel SIP 100', espesor_mm: '100', publicado: 'on' }),
        cookies: makeCookies('tok'),
        redirect: makeRedirectStub(),
      },
      {
        getClient: () => dummyClient,
        insertPanel: (_client, payload) => { receivedPayload = payload; return Promise.resolve({ error: null }) },
      }
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('/admin/productos')
    expect(receivedPayload).toMatchObject({
      nombre: 'Panel SIP 100',
      espesor_mm: 100,
      ancho_mm: 1220,
      largo_mm: 2440,
      publicado: true,
      imagenes: [],
      archivos: [],
    })
  })

  it('éxito → getClient recibe el access token de la cookie', async () => {
    let receivedToken: string | undefined = 'UNSET'
    await handleCreatePanelPost(
      { request: makeFormRequest(validFields), cookies: makeCookies('jwt-123'), redirect: makeRedirectStub() },
      {
        getClient: (token) => { receivedToken = token; return dummyClient },
        insertPanel: () => Promise.resolve({ error: null }),
      }
    )
    expect(receivedToken).toBe('jwt-123')
  })

  it('sin cookie (dev bypass) → getClient recibe undefined', async () => {
    let receivedToken: string | undefined = 'UNSET'
    await handleCreatePanelPost(
      { request: makeFormRequest(validFields), cookies: makeCookies(undefined), redirect: makeRedirectStub() },
      {
        getClient: (token) => { receivedToken = token; return dummyClient },
        insertPanel: () => Promise.resolve({ error: null }),
      }
    )
    expect(receivedToken).toBeUndefined()
  })
})
