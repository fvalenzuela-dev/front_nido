import { describe, it, expect } from 'vitest'
import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toPanelCard, fetchPanels, insertPanel } from './panels'
import type { PanelRow, PanelInsert } from './panels'

// Full fixture row — satisfies all non-null fields from paneles_sip Row type
const rowFixture: PanelRow = {
  id: 'abc-123',
  nombre: 'Panel SIP 100mm',
  descripcion: 'Descripción de prueba',
  espesor_mm: 100,
  ancho_mm: 1220,
  largo_mm: 2440,
  r_value: 3.5,
  peso_kg_m2: 12.0,
  precio_clp: 250000,
  stock: 10,
  publicado: true,
  imagenes: ['https://example.com/img.jpg'],
  archivos: [],
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

// Stub supabase clients using dependency injection (no vi.mock needed)
const okClient = {
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: [rowFixture], error: null }),
    }),
  }),
} as unknown as SupabaseClient<Database>

const dbErrClient = {
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: null, error: { message: 'RLS denied' } }),
    }),
  }),
} as unknown as SupabaseClient<Database>

const throwClient = {
  from: () => {
    throw new Error('no backend')
  },
} as unknown as SupabaseClient<Database>

// --- toPanelCard tests ---

describe('toPanelCard', () => {
  it('full row: returns correct espesorLabel, precioLabel (CLP), estadoLabel, mainImage', () => {
    const vm = toPanelCard(rowFixture)
    expect(vm.espesorLabel).toBe('100 mm')
    // CLP format: assert presence of $ and digit groups — avoids Node/locale NBSP brittleness
    expect(vm.precioLabel).toContain('$')
    expect(vm.precioLabel).toContain('250')
    expect(vm.estadoLabel).toBe('Publicado')
    expect(vm.mainImage).toBe(rowFixture.imagenes[0])
  })

  it('null precio_clp → precioLabel === "Sin precio"', () => {
    const vm = toPanelCard({ ...rowFixture, precio_clp: null })
    expect(vm.precioLabel).toBe('Sin precio')
  })

  it('empty imagenes → mainImage === null', () => {
    const vm = toPanelCard({ ...rowFixture, imagenes: [] })
    expect(vm.mainImage).toBeNull()
  })

  it('publicado false → estadoLabel === "Borrador"', () => {
    const vm = toPanelCard({ ...rowFixture, publicado: false })
    expect(vm.estadoLabel).toBe('Borrador')
  })
})

// --- fetchPanels tests ---

describe('fetchPanels', () => {
  it('success: returns panels array and null error', async () => {
    const result = await fetchPanels(okClient)
    expect(result.panels).toEqual([rowFixture])
    expect(result.error).toBeNull()
  })

  it('db-error: supabase returns { data: null, error } → empty panels + error string', async () => {
    const result = await fetchPanels(dbErrClient)
    expect(result.panels).toEqual([])
    expect(result.error).toBe('RLS denied')
  })

  it('thrown error: client throws → caught, empty panels + error string, does not reject', async () => {
    // Must not throw — fetchPanels catches all exceptions
    const result = await fetchPanels(throwClient)
    expect(result.panels).toEqual([])
    expect(result.error).toBe('no backend')
  })
})

// --- insertPanel tests ---

const insertPayload: PanelInsert = {
  nombre: 'Panel nuevo',
  espesor_mm: 100,
  ancho_mm: 1220,
  largo_mm: 2440,
  stock: 0,
  publicado: false,
  descripcion: null,
  r_value: null,
  peso_kg_m2: null,
  precio_clp: null,
  imagenes: [],
  archivos: [],
}

describe('insertPanel', () => {
  it('success: client insert returns no error → { error: null }', async () => {
    let received: unknown = null
    const client = {
      from: () => ({
        insert: (payload: unknown) => {
          received = payload
          return Promise.resolve({ error: null })
        },
      }),
    } as unknown as SupabaseClient<Database>

    const result = await insertPanel(client, insertPayload)
    expect(result.error).toBeNull()
    expect(received).toEqual(insertPayload)
  })

  it('db-error: insert returns { error } → { error: message }', async () => {
    const client = {
      from: () => ({
        insert: () => Promise.resolve({ error: { message: 'new row violates row-level security policy' } }),
      }),
    } as unknown as SupabaseClient<Database>

    const result = await insertPanel(client, insertPayload)
    expect(result.error).toBe('new row violates row-level security policy')
  })

  it('thrown error: client throws → caught, returns error string, does not reject', async () => {
    const client = {
      from: () => {
        throw new Error('no backend')
      },
    } as unknown as SupabaseClient<Database>

    const result = await insertPanel(client, insertPayload)
    expect(result.error).toBe('no backend')
  })
})
