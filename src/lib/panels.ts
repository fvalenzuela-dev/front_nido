import type { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// Canonical row type derived from generated Database types — stays aligned with supabase gen types.
// Intentionally NOT using the hand-written PanelSIP from src/types/producto.ts (ADR-1).
export type PanelRow = Database['public']['Tables']['paneles_sip']['Row']

// View-model produced by toPanelCard — all formatting/display decisions live here.
export interface PanelCardVM {
  id: string
  nombre: string
  espesorLabel: string     // e.g. "100 mm"
  precioLabel: string      // CLP formatted, or 'Sin precio' when precio_clp is null
  stock: number
  publicado: boolean
  estadoLabel: string      // 'Publicado' | 'Borrador'
  mainImage: string | null // imagenes[0] ?? null
}

export interface FetchPanelsResult {
  panels: PanelRow[]
  error: string | null
}

// Pure mapper — no Astro imports, runs under vitest/jsdom directly.
export function toPanelCard(row: PanelRow): PanelCardVM {
  const precioLabel =
    row.precio_clp !== null
      ? new Intl.NumberFormat('es-CL', {
          style: 'currency',
          currency: 'CLP',
          maximumFractionDigits: 0,
        }).format(row.precio_clp)
      : 'Sin precio'

  return {
    id: row.id,
    nombre: row.nombre,
    espesorLabel: `${row.espesor_mm} mm`,
    precioLabel,
    stock: row.stock,
    publicado: row.publicado,
    estadoLabel: row.publicado ? 'Publicado' : 'Borrador',
    mainImage: row.imagenes?.[0] ?? null,
  }
}

// Insert payload derived from generated Database types — stays aligned with
// supabase gen types. The route handler normalizes form input into this shape.
export type PanelInsert = Database['public']['Tables']['paneles_sip']['Insert']

// Injectable client (ADR-3) — pass the request-scoped anon client so RLS
// authorizes the INSERT by role (app_metadata.role). Never throws: Supabase
// errors and exceptions are caught and returned as { error }.
export async function insertPanel(
  client: SupabaseClient<Database>,
  payload: PanelInsert
): Promise<{ error: string | null }> {
  try {
    const { error } = await client.from('paneles_sip').insert(payload)
    if (error) {
      return { error: error.message }
    }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

// Injectable client — accepts the Supabase client as a parameter so tests can
// pass a hand-rolled stub without vi.mock hoisting (ADR-3).
// Never throws: all Supabase errors and exceptions are caught and returned as { panels: [], error }.
export async function fetchPanels(
  client: SupabaseClient<Database>
): Promise<FetchPanelsResult> {
  try {
    const { data, error } = await client
      .from('paneles_sip')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return { panels: [], error: error.message }
    }

    return { panels: data ?? [], error: null }
  } catch (e) {
    return {
      panels: [],
      error: e instanceof Error ? e.message : 'Error desconocido',
    }
  }
}
