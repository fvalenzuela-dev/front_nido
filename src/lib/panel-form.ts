import type { Database } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Pure validation + normalization for the "create panel SIP" admin form.
// No Astro/Supabase imports — runs under vitest directly. The route handler
// (src/pages/api/admin/panels.ts) consumes parsePanelForm and persists the
// normalized payload with insertPanel.
// ---------------------------------------------------------------------------

export type PanelInsert = Database['public']['Tables']['paneles_sip']['Insert']

const PANEL_FORM_ERROR_CODES = [
  'missing_fields',
  'invalid_numbers',
  'db_error',
  'server_error',
] as const
export type PanelFormErrorCode = (typeof PANEL_FORM_ERROR_CODES)[number]

export type PanelFormResult =
  | { ok: true; value: PanelInsert }
  | { ok: false; code: 'missing_fields' | 'invalid_numbers' }

// Minimal shape the parser needs — FormData satisfies it, so do test stubs.
interface FormLike {
  get: (key: string) => FormDataEntryValue | null
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

/** Trimmed non-empty string, or null when absent/blank. */
function parseString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

type NumberField =
  | { state: 'empty' } // absent or blank → caller applies default/null
  | { state: 'ok'; value: number }
  | { state: 'invalid' } // present but not a valid number for the given rules

interface NumberRules {
  integer: boolean
  min: number
  max: number
}

// Límites del schema (CLAUDE.md §6) para evitar "numeric field overflow" en la DB:
// columnas INTEGER → int4; r_value DECIMAL(4,2) → 99.99; peso_kg_m2 DECIMAL(6,2) → 9999.99.
const INT4_MAX = 2147483647
const R_VALUE_MAX = 99.99
const PESO_MAX = 9999.99

function parseNumber(value: FormDataEntryValue | null, rules: NumberRules): NumberField {
  if (typeof value !== 'string') return { state: 'empty' }
  const trimmed = value.trim()
  if (trimmed === '') return { state: 'empty' }

  const n = Number(trimmed)
  if (!Number.isFinite(n)) return { state: 'invalid' }
  if (rules.integer && !Number.isInteger(n)) return { state: 'invalid' }
  if (n < rules.min || n > rules.max) return { state: 'invalid' }
  return { state: 'ok', value: n }
}

/** Checkbox semantics: present and truthy → true; absent → false. */
function parseBoolean(value: FormDataEntryValue | null): boolean {
  return typeof value === 'string' && value !== '' && value !== 'false' && value !== '0'
}

// ---------------------------------------------------------------------------
// parsePanelForm
// ---------------------------------------------------------------------------

export function parsePanelForm(formData: FormLike): PanelFormResult {
  const nombre = parseString(formData.get('nombre'))
  const espesor = parseNumber(formData.get('espesor_mm'), { integer: true, min: 1, max: INT4_MAX })

  // Required: nombre + espesor_mm. Blank/absent → missing_fields.
  if (nombre === null || espesor.state === 'empty') {
    return { ok: false, code: 'missing_fields' }
  }
  if (espesor.state === 'invalid') {
    return { ok: false, code: 'invalid_numbers' }
  }

  const ancho = parseNumber(formData.get('ancho_mm'), { integer: true, min: 1, max: INT4_MAX })
  const largo = parseNumber(formData.get('largo_mm'), { integer: true, min: 1, max: INT4_MAX })
  const stock = parseNumber(formData.get('stock'), { integer: true, min: 0, max: INT4_MAX })
  const rValue = parseNumber(formData.get('r_value'), { integer: false, min: 0, max: R_VALUE_MAX })
  const peso = parseNumber(formData.get('peso_kg_m2'), { integer: false, min: 0, max: PESO_MAX })
  const precio = parseNumber(formData.get('precio_clp'), { integer: true, min: 0, max: INT4_MAX })

  // Any present-but-invalid optional number rejects the whole form.
  for (const field of [ancho, largo, stock, rValue, peso, precio]) {
    if (field.state === 'invalid') {
      return { ok: false, code: 'invalid_numbers' }
    }
  }

  return {
    ok: true,
    value: {
      nombre,
      descripcion: parseString(formData.get('descripcion')),
      espesor_mm: espesor.value,
      ancho_mm: ancho.state === 'ok' ? ancho.value : 1220,
      largo_mm: largo.state === 'ok' ? largo.value : 2440,
      r_value: rValue.state === 'ok' ? rValue.value : null,
      peso_kg_m2: peso.state === 'ok' ? peso.value : null,
      precio_clp: precio.state === 'ok' ? precio.value : null,
      stock: stock.state === 'ok' ? stock.value : 0,
      publicado: parseBoolean(formData.get('publicado')),
      // Phase 1: uploads not implemented yet — arrays start empty (issue #8 scope).
      imagenes: [],
      archivos: [],
    },
  }
}

// ---------------------------------------------------------------------------
// panelFormErrorMessage — maps whitelisted codes to Spanish user-facing text.
// Returns '' for unknown/absent codes (never echoes a raw code).
// ---------------------------------------------------------------------------

const PANEL_FORM_ERROR_MESSAGES: Record<PanelFormErrorCode, string> = {
  missing_fields: 'Completa los campos obligatorios: nombre y espesor.',
  invalid_numbers: 'Revisa los campos numéricos: usa valores válidos dentro de los límites (R-value máx. 99,99; peso máx. 9999,99).',
  db_error: 'No se pudo guardar el panel. Intenta nuevamente.',
  server_error: 'Ocurrió un error. Intenta nuevamente.',
}

export function panelFormErrorMessage(code: string | null): string {
  if (!code) return ''
  const isKnown = (PANEL_FORM_ERROR_CODES as readonly string[]).includes(code)
  return isKnown ? PANEL_FORM_ERROR_MESSAGES[code as PanelFormErrorCode] : ''
}
